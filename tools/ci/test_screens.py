"""Tests of the list of pictures and of the publishing script. Run: python3 -m unittest tools/ci/test_screens.py"""

import importlib.util
import pathlib
import re
import struct
import subprocess
import sys
import tempfile
import unittest
import zlib

HERE = pathlib.Path(__file__).resolve().parent


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, HERE / file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


screens = load("screens", "screens.py")
publish = load("publish", "publish-screens.py")


def png(width=4, height=4):
    def chunk(kind, body):
        return struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + b"\x00\x00\x00" * width for _ in range(height))
    return (
        publish.PNG_SIGNATURE
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )


class ListTest(unittest.TestCase):
    def test_names_are_unique_and_follow_the_pattern(self):
        names = [shot.name for shot in screens.SHOTS]
        self.assertEqual(len(names), len(set(names)))
        for name in names:
            self.assertRegex(name, r"^(intro|ecran)-[a-z0-9-]+-(fr|en|ar)-(clair|sombre)\.png$")

    def test_every_introduction_page_is_photographed_in_french_and_arabic(self):
        for language in ("fr", "ar"):
            for page in range(1, screens.ONBOARDING_PAGES + 1):
                self.assertIn(f"intro-{page:02d}-{language}-clair.png", screens.EXPECTED)
        self.assertIn(f"intro-{screens.ONBOARDING_PAGES:02d}-fr-sombre.png", screens.EXPECTED)

    def test_the_introduction_is_photographed_before_the_app_is_filled(self):
        seeded = [i for i, shot in enumerate(screens.SHOTS) if shot.seed]
        plain = [i for i, shot in enumerate(screens.SHOTS) if shot.screen == "onboarding"]
        self.assertLess(max(plain), min(seeded))

    def test_plan_has_nine_fields_without_empty_ones(self):
        for line in screens.plan().splitlines():
            fields = line.split("\t")
            self.assertEqual(len(fields), 9)
            self.assertTrue(all(fields))
            self.assertRegex(fields[0], r"^[a-z0-9-]+$")


class PublishTest(unittest.TestCase):
    def run_publish(self, incoming_files):
        with tempfile.TemporaryDirectory() as tmp:
            incoming = pathlib.Path(tmp, "in")
            incoming.mkdir()
            for name, data in incoming_files.items():
                (incoming / name).write_bytes(data)
            out = pathlib.Path(tmp, "out")
            result = subprocess.run(
                [sys.executable, str(HERE / "publish-screens.py"), str(incoming), str(out), "--run", "1", "--sha", "abcdef1"],
                capture_output=True,
                text=True,
            )
            kept = sorted(p.name for p in out.glob("*")) if out.exists() else []
            readme = (out / "README.md").read_text(encoding="utf-8") if (out / "README.md").exists() else ""
            return result, kept, readme

    def test_keeps_only_listed_whole_pngs_and_captions_them(self):
        good = "intro-01-fr-clair.png"
        result, kept, readme = self.run_publish(
            {
                good: png(),
                "intro-02-fr-clair.png": png()[:-5],  # cut short
                "not-listed.png": png(),
                "sim-build.log": b"secret?",
            }
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(kept, ["README.md", good])
        self.assertIn(screens.EXPECTED[good], readme)
        self.assertIn("Images manquantes", readme)
        self.assertNotIn("not-listed", readme)

    def test_fails_when_nothing_is_valid(self):
        result, kept, _ = self.run_publish({"intro-01-fr-clair.png": b"GIF89a"})
        self.assertEqual(result.returncode, 1)

    def test_png_size_refuses_trailing_bytes(self):
        self.assertEqual(publish.png_size(png(5, 6)), (5, 6))
        self.assertIsNone(publish.png_size(png() + b"x"))


if __name__ == "__main__":
    unittest.main()
