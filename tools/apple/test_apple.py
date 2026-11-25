"""Tests of the Apple scripts against a pretend App Store Connect, on any machine.

    python3 -m unittest discover -s tools/apple -p "test_*.py"

What needs a Mac (the keychain, codesign, the export) is not covered here: it is checked by the
workflow itself, step by step, each time it runs.
"""

from __future__ import annotations

import base64
import contextlib
import datetime as dt
import importlib
import io
import json
import os
import subprocess
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import asc  # noqa: E402
import prepare  # noqa: E402
import testflight  # noqa: E402

install_signing = importlib.import_module("install-signing")

BUNDLE = "com.example.app"


class Pretend(BaseHTTPRequestHandler):
    """Answers like App Store Connect for the few calls the scripts make. State lives on the server object."""

    def log_message(self, *args):  # silence
        pass

    def reply(self, code: int, body: dict) -> None:
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        state = self.server.state
        state["calls"].append(("GET", self.path))
        if not self.headers.get("Authorization", "").startswith("Bearer "):
            return self.reply(401, {"errors": [{"code": "NOT_AUTHORIZED", "detail": "no token"}]})
        path = self.path.split("?")[0]
        if path == "/v1/bundleIds":
            return self.reply(200, {"data": state["bundles"]})
        if path == "/v1/apps":
            return self.reply(200, {"data": state["apps"]})
        if path == "/v1/apps/APP1/betaGroups":
            return self.reply(200, {"data": state["groups"]})
        if path == "/v1/users":
            return self.reply(200, {"data": state["users"]})
        if path.startswith("/v1/betaGroups/") and path.endswith("/betaTesters"):
            return self.reply(200, {"data": state["testers"]})
        if path == "/v1/builds":
            answer = state["builds"].pop(0) if len(state["builds"]) > 1 else state["builds"][0]
            return self.reply(200, {"data": answer})
        return self.reply(404, {"errors": [{"code": "NOT_FOUND", "detail": path}]})

    def do_POST(self):
        state = self.server.state
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))) or b"{}")
        state["calls"].append(("POST", self.path, body))
        path = self.path.split("?")[0]
        if path in state["refuse"]:
            return self.reply(state["refuse"][path], {"errors": [{"code": "ENTITY_ERROR", "detail": "refused someone@example.org"}]})
        if path == "/v1/bundleIds":
            item = {"type": "bundleIds", "id": "B1", "attributes": body["data"]["attributes"]}
            state["bundles"].append(item)
            return self.reply(201, {"data": item})
        if path == "/v1/betaGroups":
            item = {"type": "betaGroups", "id": "G1", "attributes": body["data"]["attributes"]}
            state["groups"].append(item)
            return self.reply(201, {"data": item})
        if path == "/v1/betaTesters":
            item = {"type": "betaTesters", "id": "T1", "attributes": body["data"]["attributes"]}
            state["testers"].append(item)
            return self.reply(201, {"data": item})
        return self.reply(404, {"errors": [{"code": "NOT_FOUND", "detail": path}]})


def build(state: str, minutes_ago: float = 1) -> list[dict]:
    uploaded = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=minutes_ago)).isoformat()
    return [{"type": "builds", "id": "BUILD1", "attributes": {"version": "20260101.5", "processingState": state, "uploadedDate": uploaded}}]


class WithPretendApple(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.folder = tempfile.mkdtemp()
        key = os.path.join(cls.folder, "key.p8")
        subprocess.run(["openssl", "genpkey", "-algorithm", "EC", "-pkeyopt", "ec_paramgen_curve:P-256", "-out", key], check=True, capture_output=True)
        subprocess.run(["openssl", "pkey", "-in", key, "-pubout", "-out", os.path.join(cls.folder, "pub.pem")], check=True, capture_output=True)
        cls.key_file = key
        cls.server = HTTPServer(("127.0.0.1", 0), Pretend)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.real_api = asc.API
        asc.API = f"http://127.0.0.1:{cls.server.server_port}/v1"
        os.environ.update(
            APPLE_KEY_ID="ABCDEFGH12",
            APPLE_ISSUER_ID="69a6de70-03db-47e3-e053-5b8c7c11a4d1",
            APP_STORE_CONNECT_API_KEY=Path(key).read_text(),
        )
        for name in ("GITHUB_OUTPUT", "GITHUB_STEP_SUMMARY", "RUNNER_TEMP"):
            os.environ.pop(name, None)

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        asc.API = cls.real_api

    def setUp(self):
        self.server.state = {
            "calls": [],
            "refuse": {},
            "bundles": [],
            "apps": [],
            "groups": [],
            "testers": [],
            "users": [{"id": "U1", "attributes": {"username": "owner@example.org", "firstName": "First", "lastName": "Last", "roles": ["ACCOUNT_HOLDER", "ADMIN"]}}],
            "builds": [build("VALID")],
        }

    def run_script(self, module, *arguments: str) -> tuple[int, str]:
        out = io.StringIO()
        argv, sys.argv = sys.argv, [module.__name__, *arguments]
        try:
            with contextlib.redirect_stdout(out):
                try:
                    code = module.main()
                except asc.AppleError as error:
                    code = asc.fail(error)
        finally:
            sys.argv = argv
        return code, out.getvalue()


class Token(WithPretendApple):
    def test_the_token_is_one_apple_can_verify(self):
        for _ in range(20):
            token = asc.make_token("ABCDEFGH12", "69a6de70-03db-47e3-e053-5b8c7c11a4d1", self.key_file)
            head, body, signature = token.split(".")
            raw = base64.urlsafe_b64decode(signature + "=" * (-len(signature) % 4))
            self.assertEqual(len(raw), 64)

            def integer(value: bytes) -> bytes:
                number = int.from_bytes(value, "big")
                data = number.to_bytes((number.bit_length() + 8) // 8 or 1, "big")
                return b"\x02" + bytes([len(data)]) + data

            pair = integer(raw[:32]) + integer(raw[32:])
            path = os.path.join(self.folder, "signature.der")
            Path(path).write_bytes(b"\x30" + bytes([len(pair)]) + pair)
            check = subprocess.run(
                ["openssl", "dgst", "-sha256", "-verify", os.path.join(self.folder, "pub.pem"), "-signature", path],
                input=f"{head}.{body}".encode(),
                capture_output=True,
            )
            self.assertEqual(check.stdout.strip(), b"Verified OK")
        payload = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
        self.assertEqual(payload["aud"], "appstoreconnect-v1")
        self.assertLessEqual(payload["exp"] - payload["iat"], 20 * 60)

    def test_a_key_that_is_not_a_p8_is_refused_without_being_shown(self):
        os.environ["APP_STORE_CONNECT_API_KEY"] = "not a key, and secret"
        try:
            with self.assertRaises(asc.AppleError) as caught:
                asc.Connect()
            self.assertNotIn("secret", str(caught.exception))
        finally:
            os.environ["APP_STORE_CONNECT_API_KEY"] = Path(self.key_file).read_text()

    def test_apples_refusal_is_reported_with_its_status(self):
        with self.assertRaises(asc.AppleError) as caught:
            asc.Connect().call("GET", "/nothing-here")
        self.assertEqual(caught.exception.status, 404)


class Prepare(WithPretendApple):
    def test_registers_the_identifier_when_missing_and_says_the_record_is_missing(self):
        code, out = self.run_script(prepare, "--bundle", BUNDLE, "--name", "Example App")
        self.assertEqual(code, 0)
        posts = [c for c in self.server.state["calls"] if c[0] == "POST"]
        self.assertEqual(len(posts), 1)
        self.assertEqual(posts[0][2]["data"]["attributes"], {"identifier": BUNDLE, "name": "Example App", "platform": "IOS"})
        self.assertIn("n'existe pas encore", out)

    def test_changes_nothing_when_everything_is_there(self):
        self.server.state["bundles"] = [{"id": "B1", "attributes": {"identifier": BUNDLE}}]
        self.server.state["apps"] = [{"id": "APP1", "attributes": {"bundleId": BUNDLE}}]
        with tempfile.TemporaryDirectory() as folder:
            os.environ["GITHUB_OUTPUT"] = os.path.join(folder, "out")
            try:
                code, out = self.run_script(prepare, "--bundle", BUNDLE, "--name", "Example App")
                written = Path(folder, "out").read_text()
            finally:
                del os.environ["GITHUB_OUTPUT"]
        self.assertEqual(code, 0)
        self.assertEqual([c for c in self.server.state["calls"] if c[0] == "POST"], [])
        self.assertEqual(written, "app_record=yes\n")

    def test_another_apps_identifier_that_only_starts_the_same_is_not_taken_for_ours(self):
        self.server.state["bundles"] = [{"id": "B9", "attributes": {"identifier": BUNDLE + ".other"}}]
        self.server.state["apps"] = [{"id": "APP9", "attributes": {"bundleId": BUNDLE + ".other"}}]
        code, out = self.run_script(prepare, "--bundle", BUNDLE, "--name", "Example App")
        self.assertEqual(len([c for c in self.server.state["calls"] if c[0] == "POST"]), 1)
        self.assertIn("n'existe pas encore", out)


class TestFlight(WithPretendApple):
    def setUp(self):
        super().setUp()
        self.server.state["apps"] = [{"id": "APP1", "attributes": {"bundleId": BUNDLE}}]

    def test_first_send_creates_the_group_adds_the_owner_and_reports_the_build(self):
        code, out = self.run_script(testflight, "--bundle", BUNDLE, "--group", "Testers", "--build", "20260101.5", "--wait-min", "0.01", "--pause", "0.05")
        self.assertEqual(code, 0)
        group = next(c for c in self.server.state["calls"] if c[0] == "POST" and c[1] == "/v1/betaGroups")
        self.assertEqual(group[2]["data"]["attributes"], {"name": "Testers", "isInternalGroup": True, "hasAccessToAllBuilds": True})
        tester = next(c for c in self.server.state["calls"] if c[0] == "POST" and c[1] == "/v1/betaTesters")
        self.assertEqual(tester[2]["data"]["relationships"]["betaGroups"]["data"], [{"type": "betaGroups", "id": "G1"}])
        self.assertIn("disponible dans TestFlight", out)

    def test_nothing_personal_reaches_the_log_even_when_apple_refuses_the_tester(self):
        self.server.state["refuse"] = {"/v1/betaTesters": 409}
        code, out = self.run_script(testflight, "--bundle", BUNDLE, "--group", "Testers", "--build", "20260101.5", "--wait-min", "0.01", "--pause", "0.05")
        self.assertEqual(code, 0)  # the build is the point
        for private in ("owner@example.org", "someone@example.org", "First", "Last"):
            self.assertNotIn(private, out)
        self.assertIn("409", out)

    def test_a_second_send_changes_nothing(self):
        self.server.state["groups"] = [{"id": "G1", "attributes": {"name": "Testers"}}]
        self.server.state["testers"] = [{"id": "T1", "attributes": {"email": "Owner@Example.org"}}]
        code, _ = self.run_script(testflight, "--bundle", BUNDLE, "--group", "Testers", "--build", "20260101.5", "--wait-min", "0.01", "--pause", "0.05")
        self.assertEqual(code, 0)
        self.assertEqual([c for c in self.server.state["calls"] if c[0] == "POST"], [])

    def test_a_build_apple_refuses_fails_the_run(self):
        self.server.state["builds"] = [build("INVALID")]
        code, out = self.run_script(testflight, "--bundle", BUNDLE, "--group", "Testers", "--build", "20260101.5", "--wait-min", "0.01", "--pause", "0.05")
        self.assertEqual(code, 1)
        self.assertIn("refusée", out)

    def test_an_old_build_with_the_same_number_is_not_taken_for_the_new_one(self):
        self.server.state["builds"] = [build("VALID", minutes_ago=60 * 24)]
        code, out = self.run_script(testflight, "--bundle", BUNDLE, "--group", "Testers", "--build", "20260101.5", "--wait-min", "0.01", "--pause", "0.05")
        self.assertEqual(code, 1)
        self.assertIn("toujours en traitement", out)

    def test_without_an_app_record_it_stops_with_a_clear_message(self):
        self.server.state["apps"] = []
        code, out = self.run_script(testflight, "--bundle", BUNDLE, "--group", "Testers", "--build", "20260101.5")
        self.assertEqual(code, 1)
        self.assertIn("No app record", out)


class Profile(unittest.TestCase):
    def good(self) -> dict:
        return {
            "ExpirationDate": dt.datetime.now() + dt.timedelta(days=200),
            "TeamIdentifier": ["TEAM123456"],
            "UUID": "01234567-89ab-cdef-0123-456789abcdef",
            "Entitlements": {"application-identifier": f"TEAM123456.{BUNDLE}", "get-task-allow": False, "beta-reports-active": True},
        }

    def test_an_app_store_profile_for_this_app_is_accepted(self):
        self.assertEqual(install_signing.check_profile(self.good(), "TEAM123456", BUNDLE), "01234567-89ab-cdef-0123-456789abcdef")

    def test_other_profiles_are_refused(self):
        cases = {
            "expired": {"ExpirationDate": dt.datetime.now() - dt.timedelta(days=1)},
            "another team": {"TeamIdentifier": ["OTHER12345"]},
            "another app": {"Entitlements": {"application-identifier": "TEAM123456.com.example.other", "get-task-allow": False, "beta-reports-active": True}},
            "a wildcard": {"Entitlements": {"application-identifier": "TEAM123456.*", "get-task-allow": False, "beta-reports-active": True}},
            "development": {"Entitlements": {"application-identifier": f"TEAM123456.{BUNDLE}", "get-task-allow": True, "beta-reports-active": True}},
            "ad hoc": {"ProvisionedDevices": ["device"]},
            "enterprise": {"ProvisionsAllDevices": True},
        }
        for name, change in cases.items():
            with self.subTest(name), self.assertRaises(asc.AppleError):
                install_signing.check_profile({**self.good(), **change}, "TEAM123456", BUNDLE)


if __name__ == "__main__":
    unittest.main()
