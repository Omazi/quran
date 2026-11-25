"""App Store Connect API, with nothing to install.

The scripts of this folder run in jobs that hold the Apple key, so they use the standard library
only: the request token is signed by the machine's own `openssl`, and no package is downloaded
next to the key. Nothing here prints a key, a certificate, a name or an e-mail address: the log of
a job on a public repository is public.

Read from the environment (see docs/TESTFLIGHT.md):
    APPLE_KEY_ID, APPLE_ISSUER_ID   identifiers of the App Store Connect API key
    APP_STORE_CONNECT_API_KEY       the text of its .p8 file
"""

from __future__ import annotations

import base64
import json
import os
import re
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

API = "https://api.appstoreconnect.apple.com/v1"
TOKEN_LIFE = 15 * 60  # Apple accepts 20 minutes at most


class AppleError(Exception):
    """Something the owner can act on. The message never holds a secret."""

    def __init__(self, message: str, status: int | None = None) -> None:
        super().__init__(message)
        self.status = status  # the HTTP status, when Apple refused a request


def require(name: str, pattern: str | None = None) -> str:
    value = os.environ.get(name, "")
    if not value or (pattern and not re.fullmatch(pattern, value)):
        raise AppleError(f"{name} is missing or does not look right (see docs/TESTFLIGHT.md).")
    return value


def key_text() -> str:
    key = require("APP_STORE_CONNECT_API_KEY").strip() + "\n"
    if not key.startswith("-----BEGIN PRIVATE KEY-----") or not key.rstrip().endswith("-----END PRIVATE KEY-----"):
        raise AppleError("APP_STORE_CONNECT_API_KEY must hold the whole text of the .p8 file.")
    return key


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def der_to_raw(der: bytes) -> bytes:
    """An ECDSA signature as openssl writes it (two integers in a sequence) -> r then s, 32 bytes each."""

    def integer(position: int) -> tuple[int, int]:
        if der[position] != 0x02:
            raise AppleError("openssl returned a signature this script cannot read.")
        length = der[position + 1]
        if length & 0x80:
            raise AppleError("openssl returned a signature this script cannot read.")
        start = position + 2
        return int.from_bytes(der[start : start + length], "big"), start + length

    if len(der) < 8 or der[0] != 0x30:
        raise AppleError("openssl returned a signature this script cannot read.")
    position = 2 if der[1] < 0x80 else 2 + (der[1] & 0x7F)
    r, position = integer(position)
    s, _ = integer(position)
    return r.to_bytes(32, "big") + s.to_bytes(32, "big")


def make_token(key_id: str, issuer: str, key_file: str) -> str:
    now = int(time.time())
    header = {"alg": "ES256", "kid": key_id, "typ": "JWT"}
    payload = {"iss": issuer, "iat": now, "exp": now + TOKEN_LIFE, "aud": "appstoreconnect-v1"}
    signing_input = f"{b64url(json.dumps(header).encode())}.{b64url(json.dumps(payload).encode())}"
    done = subprocess.run(["openssl", "dgst", "-sha256", "-sign", key_file], input=signing_input.encode(), capture_output=True)
    if done.returncode:
        raise AppleError("openssl could not sign with the API key: is APP_STORE_CONNECT_API_KEY the .p8 text?")
    return f"{signing_input}.{b64url(der_to_raw(done.stdout))}"


class Connect:
    """A small client. The key is written to a private temporary file only while a token is signed."""

    def __init__(self) -> None:
        self.key_id = require("APPLE_KEY_ID", r"[A-Z0-9]{10}")
        self.issuer = require("APPLE_ISSUER_ID", r"[A-Fa-f0-9]{8}(?:-[A-Fa-f0-9]{4}){3}-[A-Fa-f0-9]{12}")
        self.key = key_text()
        self.token = ""
        self.signed_at = 0.0

    def _token(self) -> str:
        if time.time() - self.signed_at > TOKEN_LIFE - 300:
            folder = tempfile.mkdtemp(prefix="asc-", dir=os.environ.get("RUNNER_TEMP"))
            path = os.path.join(folder, "key.p8")
            try:
                with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w") as stream:
                    stream.write(self.key)
                self.token = make_token(self.key_id, self.issuer, path)
                self.signed_at = time.time()
            finally:
                if os.path.exists(path):
                    os.remove(path)
                os.rmdir(folder)
        return self.token

    def call(self, method: str, path: str, body: dict | None = None, accept: tuple[int, ...] = ()) -> dict:
        """One request. `accept` lists HTTP errors the caller wants back as {"error": code} instead of a stop."""
        request = urllib.request.Request(
            API + path,
            method=method,
            data=None if body is None else json.dumps(body).encode(),
            headers={"Authorization": f"Bearer {self._token()}", "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return json.loads(response.read() or b"{}")
        except urllib.error.HTTPError as error:
            if error.code in accept:
                return {"error": error.code}
            # Apple's answer names what is wrong (a role, an identifier); it never echoes the token.
            try:
                details = [f"{e.get('code')}: {e.get('detail') or e.get('title')}" for e in json.loads(error.read()).get("errors", [])]
            except (ValueError, AttributeError):
                details = []
            what = "; ".join(details)[:500] or "no detail given"
            raise AppleError(f"App Store Connect refused {method} {path.split('?')[0]} ({error.code}): {what}", error.code) from None
        except urllib.error.URLError as error:
            raise AppleError(f"App Store Connect could not be reached: {error.reason}") from None

    def all(self, path: str) -> list[dict]:
        """Every item of a list, following Apple's pages."""
        items: list[dict] = []
        while path:
            page = self.call("GET", path)
            items += page.get("data", [])
            following = page.get("links", {}).get("next")
            path = following[len(API) :] if following and following.startswith(API) else ""
        return items


def fail(error: Exception) -> int:
    """How every script of this folder ends on a problem: one line, no traceback (it could show an argument)."""
    print(f"::error::{error}")
    return 1
