"""Installs what signs the app on a GitHub Mac, for the time of one job.

    python3 tools/apple/install-signing.py --bundle com.omazi.quran --name "Jannatuk"

Same method as the owner's other app (DishPlay): an Apple Distribution certificate that already
exists, given as a .p12, and an App Store provisioning profile that this script finds or creates
through the App Store Connect API. It never creates or revokes a certificate.

Everything private stays in a folder of RUNNER_TEMP that the workflow removes at the end. The
log of the job is public: no name, no key, no certificate is printed.

Read from the environment, besides what tools/apple/asc.py reads:
    APPLE_TEAM_ID
    IOS_DISTRIBUTION_P12_BASE64, IOS_DISTRIBUTION_P12_PASSWORD

Written to GITHUB_ENV for the following steps:
    SIGNING_FOLDER, SIGNING_KEYCHAIN, SIGNING_IDENTITY (the certificate's SHA-1),
    SIGNING_PROFILE, APPLE_EXPORT_OPTIONS, APPLE_API_KEY_DIR
"""

from __future__ import annotations

import argparse
import base64
import datetime as dt
import hashlib
import json
import os
import plistlib
import re
import secrets
import shlex
import subprocess
import sys
import time
from pathlib import Path

from asc import AppleError, Connect, fail, key_text, require


def run(arguments: list[str]) -> bytes:
    done = subprocess.run(arguments, capture_output=True)
    if done.returncode:
        # The arguments can hold the keychain's password: only the tool's name is shown.
        raise AppleError(f"{Path(arguments[0]).name} failed while the signing was being installed (exit {done.returncode}).")
    return done.stdout


def private_file(path: Path, content: bytes) -> None:
    with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "wb") as stream:
        stream.write(content)


def check_profile(profile: dict, team: str, bundle: str) -> str:
    expiry = profile.get("ExpirationDate")
    if not isinstance(expiry, dt.datetime) or expiry.replace(tzinfo=dt.timezone.utc) <= dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=1):
        raise AppleError("The provisioning profile is expired or expires within a day.")
    if profile.get("TeamIdentifier") != [team]:
        raise AppleError("The provisioning profile belongs to another Apple team.")
    if not re.fullmatch(r"[A-Fa-f0-9-]{36}", profile.get("UUID", "")):
        raise AppleError("The provisioning profile has no valid identifier.")
    entitlements = profile.get("Entitlements", {})
    if entitlements.get("application-identifier") != f"{team}.{bundle}":
        raise AppleError("The provisioning profile is not for this app and this team.")
    if entitlements.get("get-task-allow", True) or not entitlements.get("beta-reports-active") or "ProvisionedDevices" in profile or profile.get("ProvisionsAllDevices"):
        raise AppleError("The provisioning profile is not an App Store profile.")
    return profile["UUID"]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bundle", required=True)
    parser.add_argument("--name", required=True)
    args = parser.parse_args()

    if sys.platform != "darwin" or os.environ.get("GITHUB_ACTIONS") != "true":
        raise AppleError("The signing is installed only on a GitHub Mac.")
    team = require("APPLE_TEAM_ID", r"[A-Z0-9]{10}")
    password = require("IOS_DISTRIBUTION_P12_PASSWORD")
    try:
        p12 = base64.b64decode(require("IOS_DISTRIBUTION_P12_BASE64"), validate=True)
    except ValueError:
        raise AppleError("IOS_DISTRIBUTION_P12_BASE64 is not base64 text.") from None
    connect = Connect()

    folder = Path(require("RUNNER_TEMP")) / "apple-signing"
    folder.mkdir(mode=0o700, exist_ok=False)
    with open(require("GITHUB_ENV"), "a") as stream:
        stream.write(f"SIGNING_FOLDER={folder}\n")  # first, so the cleaning step finds it whatever happens next

    # 1. The certificate and its private key, in a keychain of their own.
    private_file(folder / "distribution.p12", p12)
    keychain = folder / "signing.keychain-db"
    before = shlex.split(run(["security", "list-keychains", "-d", "user"]).decode())
    private_file(folder / "original-keychains.json", json.dumps(before).encode())
    keychain_password = secrets.token_urlsafe(32)
    run(["security", "create-keychain", "-p", keychain_password, str(keychain)])
    run(["security", "set-keychain-settings", "-lut", "3600", str(keychain)])
    run(["security", "unlock-keychain", "-p", keychain_password, str(keychain)])
    run(["security", "import", str(folder / "distribution.p12"), "-P", password, "-k", str(keychain), "-T", "/usr/bin/codesign", "-T", "/usr/bin/security"])
    run(["security", "set-key-partition-list", "-S", "apple-tool:,apple:,codesign:", "-k", keychain_password, str(keychain)])
    run(["security", "list-keychains", "-d", "user", "-s", str(keychain), *before])
    os.remove(folder / "distribution.p12")
    identities = run(["security", "find-identity", "-v", "-p", "codesigning", str(keychain)]).decode()
    fingerprints = [m.group(1).upper() for m in re.finditer(r'^\s*\d+\)\s+([0-9A-Fa-f]{40})\s+"Apple Distribution:', identities, re.M)]
    if len(fingerprints) != 1:
        raise AppleError(f"The .p12 must hold exactly one valid Apple Distribution identity; found {len(fingerprints)}.")
    fingerprint = fingerprints[0]

    # 2. The same certificate, as the developer account knows it.
    certificates = connect.all("/certificates?filter[certificateType]=DISTRIBUTION,IOS_DISTRIBUTION&limit=200")
    certificate = next((c for c in certificates if hashlib.sha1(base64.b64decode(c["attributes"]["certificateContent"])).hexdigest().upper() == fingerprint), None)
    if certificate is None:
        raise AppleError("The certificate of the .p12 is not on the developer account any more (expired or revoked).")

    # 3. The identifier, then an App Store profile for it that holds this certificate.
    found = connect.call("GET", f"/bundleIds?filter[identifier]={args.bundle}&limit=200").get("data", [])
    bundle = next((b for b in found if b["attributes"]["identifier"] == args.bundle), None)
    if bundle is None:
        raise AppleError(f"The identifier {args.bundle} is not registered: run the workflow in mode 'prepare' first.")
    chosen = None
    for profile in connect.all(f"/bundleIds/{bundle['id']}/profiles?limit=200"):
        attributes = profile["attributes"]
        if attributes.get("profileType") == "IOS_APP_STORE" and attributes.get("profileState") == "ACTIVE":
            inside = connect.all(f"/profiles/{profile['id']}/certificates?limit=200")
            if any(c["id"] == certificate["id"] for c in inside):
                chosen = connect.call("GET", f"/profiles/{profile['id']}")["data"]  # with its content
                break
    if chosen is None:
        chosen = connect.call(
            "POST",
            "/profiles",
            {
                "data": {
                    "type": "profiles",
                    "attributes": {"name": f"{args.name} App Store {time.strftime('%Y%m%d%H%M')}", "profileType": "IOS_APP_STORE"},
                    "relationships": {
                        "bundleId": {"data": {"type": "bundleIds", "id": bundle["id"]}},
                        "certificates": {"data": [{"type": "certificates", "id": certificate["id"]}]},
                    },
                }
            },
        )["data"]
        print("App Store provisioning profile: created.")
    else:
        print("App Store provisioning profile: an active one is reused.")
    profile_bytes = base64.b64decode(chosen["attributes"]["profileContent"])
    profile_path = folder / "profile.mobileprovision"
    private_file(profile_path, profile_bytes)
    profile = plistlib.loads(run(["security", "cms", "-D", "-i", str(profile_path)]))
    uuid = check_profile(profile, team, args.bundle)
    if fingerprint not in {hashlib.sha1(c).hexdigest().upper() for c in profile.get("DeveloperCertificates", [])}:
        raise AppleError("The provisioning profile does not hold the certificate of the .p12.")

    # 4. Where Xcode looks for profiles (the first folder since Xcode 16, the second before).
    installed = []
    private_file(folder / "installed-profiles.json", b"[]")
    for relative in ["Library/Developer/Xcode/UserData/Provisioning Profiles", "Library/MobileDevice/Provisioning Profiles"]:
        directory = Path.home() / relative
        directory.mkdir(parents=True, exist_ok=True)
        destination = directory / f"{uuid}.mobileprovision"
        if destination.exists():
            raise AppleError("This machine already holds this profile; it is not overwritten.")
        private_file(destination, profile_bytes)
        installed.append(str(destination))
        (folder / "installed-profiles.json").write_text(json.dumps(installed))

    # 5. What `xcodebuild -exportArchive` and `altool` need.
    export = {
        "method": "app-store-connect",
        "destination": "export",
        "teamID": team,
        "signingStyle": "manual",
        "signingCertificate": "Apple Distribution",
        "provisioningProfiles": {args.bundle: uuid},
        "uploadSymbols": True,
        "manageAppVersionAndBuildNumber": False,
    }
    private_file(folder / "ExportOptions.plist", plistlib.dumps(export))
    keys = folder / "private_keys"
    keys.mkdir(mode=0o700)
    private_file(keys / f"AuthKey_{connect.key_id}.p8", key_text().encode())
    with open(require("GITHUB_ENV"), "a") as stream:
        stream.write(
            f"SIGNING_KEYCHAIN={keychain}\nSIGNING_IDENTITY={fingerprint}\nSIGNING_PROFILE={profile_path}\n"
            f"APPLE_EXPORT_OPTIONS={folder / 'ExportOptions.plist'}\nAPPLE_API_KEY_DIR={keys}\n"
        )
    print("The certificate and the profile are installed for this job.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except AppleError as error:
        sys.exit(fail(error))
    except Exception as error:  # no traceback: it could show an argument
        sys.exit(fail(AppleError(f"Unexpected problem while installing the signing ({type(error).__name__}).")))
