"""Tests of the crash report and of how it is published. Run: python3 -m unittest tools/ci/test_crash_report.py"""

import importlib.util
import json
import pathlib
import subprocess
import sys
import tempfile
import unittest

HERE = pathlib.Path(__file__).resolve().parent


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, HERE / file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


report = load("crash_report", "crash-report.py")
publish = load("publish", "publish-screens.py")

DONE = "2026-11-25T18:00:50.000Z auto-run: DONE (handles: kept)\n"
PROGRESS = (
    "2026-11-25T18:00:01.000Z auto-run: start\n"
    "2026-11-25T18:00:10.000Z pager: swipe 3/15 from page 3\n"
)

IPS_HEADER = json.dumps({"app_name": "Jannatuk", "bug_type": "309"})
IPS_BODY = json.dumps(
    {
        "procName": "Jannatuk",
        "exception": {"type": "EXC_CRASH", "signal": "SIGABRT"},
        "termination": {"namespace": "SIGNAL", "indicator": "Abort trap: 6"},
        "asi": {"libsystem_c.dylib": ["abort() called"]},
        "faultingThread": 1,
        "usedImages": [{"name": "Jannatuk"}, {"name": "libsystem_kernel.dylib"}],
        "threads": [
            {"id": 1, "frames": []},
            {
                "id": 2,
                "triggered": True,
                "name": "com.facebook.react.JavaScript",
                "frames": [
                    {"imageIndex": 1, "imageOffset": 4660, "symbol": "__pthread_kill"},
                    {"imageIndex": 0, "imageOffset": 9000},
                ],
            },
        ],
        "lastExceptionBacktrace": [{"imageIndex": 0, "imageOffset": 123, "symbol": "objc_exception_throw"}],
    }
)
IPS = IPS_HEADER + "\n" + IPS_BODY


class ProgressTest(unittest.TestCase):
    def test_reads_where_the_run_got_to(self):
        progress = report.parse_progress(PROGRESS)
        self.assertFalse(progress["finished"])
        self.assertIn("swipe 3/15", progress["last"])
        self.assertTrue(report.parse_progress(PROGRESS + DONE)["finished"])

    def test_an_empty_or_missing_log_is_not_finished(self):
        self.assertFalse(report.parse_progress("")["finished"])
        self.assertFalse(report.parse_progress(None)["finished"])
        self.assertEqual(report.parse_progress(None)["last"], "(no progress file: the app never started the run)")


class IpsTest(unittest.TestCase):
    def test_keeps_the_exception_and_the_frames_of_the_thread_that_crashed(self):
        lines = report.summarize_ips(IPS)
        text = "\n".join(lines)
        self.assertIn("EXC_CRASH", text)
        self.assertIn("SIGABRT", text)
        self.assertIn("abort() called", text)
        self.assertIn("com.facebook.react.JavaScript", text)
        self.assertIn("__pthread_kill", text)
        self.assertIn("Jannatuk+9000", text)
        self.assertIn("objc_exception_throw", text)

    def test_does_not_choke_on_what_is_not_a_crash_report(self):
        self.assertIn("unreadable", "\n".join(report.summarize_ips("not json at all")).lower())
        self.assertIn("unreadable", "\n".join(report.summarize_ips("{}\n[1,2]")).lower())


class VerdictTest(unittest.TestCase):
    def build(self, **overrides):
        arguments = dict(progress=PROGRESS + DONE, closure=None, ips=[], log=None, alive=True)
        arguments.update(overrides)
        return report.build_report(**arguments)

    def test_ok_when_the_app_lived_to_the_end(self):
        verdict, text = self.build()
        self.assertEqual(verdict, "OK")
        self.assertTrue(text.startswith("VERDICT: OK\n"))

    def test_crash_when_the_process_died_whatever_else_is_known(self):
        verdict, text = self.build(progress=PROGRESS, alive=False)
        self.assertEqual(verdict, "CRASH")
        self.assertIn("swipe 3/15", text)
        self.assertIn("no JavaScript record", text)

    def test_crash_when_a_crash_report_exists_even_if_the_process_is_back(self):
        verdict, text = self.build(ips=[IPS])
        self.assertEqual(verdict, "CRASH")
        self.assertIn("EXC_CRASH", text)

    def test_crash_with_the_javascript_record_when_the_app_wrote_one(self):
        record = json.dumps({"message": "x is not a function", "stack": "at Foo", "route": "/onboarding"})
        verdict, text = self.build(closure=record, alive=False)
        self.assertEqual(verdict, "CRASH")
        self.assertIn("x is not a function", text)
        self.assertIn("/onboarding", text)
        self.assertNotIn("no JavaScript record", text)

    def test_incomplete_when_alive_but_the_run_never_ended(self):
        verdict, _ = self.build(progress=PROGRESS)
        self.assertEqual(verdict, "INCOMPLETE")

    def test_the_report_is_small_and_made_of_printable_text(self):
        verdict, text = self.build(log="line\x00\x1b[31m red\n" * 100000, alive=False)
        self.assertLessEqual(len(text.encode()), report.MAX_REPORT_BYTES)
        self.assertNotIn("\x00", text)
        self.assertNotIn("\x1b", text)


class CommandLineTest(unittest.TestCase):
    def test_prints_the_verdict_and_writes_the_report(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = pathlib.Path(tmp)
            (folder / "progress.txt").write_text(PROGRESS, encoding="utf-8")
            (folder / "Jannatuk-1.ips").write_text(IPS, encoding="utf-8")
            result = subprocess.run(
                [
                    sys.executable, str(HERE / "crash-report.py"),
                    "--progress", str(folder / "progress.txt"),
                    "--closure", str(folder / "missing.json"),
                    "--ips-dir", str(folder),
                    "--log", str(folder / "missing.log"),
                    "--alive", "0",
                    "--out", str(folder / "crash-report.txt"),
                ],
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(result.stdout.strip(), "CRASH")
            written = (folder / "crash-report.txt").read_text(encoding="utf-8")
            self.assertTrue(written.startswith("VERDICT: CRASH\n"))
            self.assertIn("EXC_CRASH", written)


class PublishTest(unittest.TestCase):
    def run_publish(self, files):
        png = load("screens_tests", "test_screens.py").png  # the picture helper lives with its tests

        with tempfile.TemporaryDirectory() as tmp:
            incoming = pathlib.Path(tmp, "in")
            incoming.mkdir()
            (incoming / "intro-01-fr-clair.png").write_bytes(png())
            for name, data in files.items():
                (incoming / name).write_bytes(data)
            out = pathlib.Path(tmp, "out")
            result = subprocess.run(
                [sys.executable, str(HERE / "publish-screens.py"), str(incoming), str(out), "--run", "1", "--sha", "abcdef1"],
                capture_output=True,
                text=True,
            )
            kept = sorted(p.name for p in out.glob("*")) if out.exists() else []
            readme = (out / "README.md").read_text(encoding="utf-8") if (out / "README.md").exists() else ""
            body = (out / "crash-report.txt").read_text(encoding="utf-8") if (out / "crash-report.txt").exists() else None
            return result, kept, readme, body

    def test_keeps_the_report_when_it_is_text_in_the_expected_shape_and_says_the_verdict(self):
        good = b"VERDICT: CRASH\nProcess alive: no\n\x1b[31mred\x00\n"
        result, kept, readme, body = self.run_publish({"crash-report.txt": good})
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("crash-report.txt", kept)
        self.assertIn("CRASH", readme)
        self.assertNotIn("\x1b", body)
        self.assertNotIn("\x00", body)

    def test_refuses_a_report_that_is_not_text_or_too_big_or_not_in_shape(self):
        for bad in (b"\xff\xfe\x00binary", b"VERDICT: OK\n" + b"x" * 400_000, b"hello\n", b"VERDICT: <script>\n"):
            result, kept, readme, body = self.run_publish({"crash-report.txt": bad})
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertNotIn("crash-report.txt", kept, bad[:20])
            self.assertIsNone(body)

    def test_does_not_keep_the_other_files_of_the_crash_hunt(self):
        result, kept, _, _ = self.run_publish(
            {"simulator-log.txt": b"secret?", "Jannatuk-1.ips": b"{}", "auto-run-progress.txt": b"x"}
        )
        self.assertEqual(kept, ["README.md", "intro-01-fr-clair.png"])


if __name__ == "__main__":
    sys.path.insert(0, str(HERE))
    unittest.main()
