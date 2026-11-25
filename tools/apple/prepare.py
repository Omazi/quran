"""Checks the Apple side before a first send, and registers the app's identifier if it is missing.

    python3 tools/apple/prepare.py --bundle com.omazi.quran --name "Jannatuk"

Three things are looked at, in the order they are needed:
  1. the API key answers;
  2. the identifier (App ID) exists on the developer account; it is registered when it does not;
  3. the app's record exists in App Store Connect. Apple gives no way to create it from a
     script: the owner creates it once, by hand (docs/TESTFLIGHT.md says how).

The result is written to the job summary and, as `app_record=yes|no`, to the step's outputs.
Never creates, changes or removes a certificate, a profile or another app's identifier.
"""

from __future__ import annotations

import argparse
import os
import sys

from asc import AppleError, Connect, fail


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bundle", required=True)
    parser.add_argument("--name", required=True)
    args = parser.parse_args()

    connect = Connect()
    lines = []

    found = connect.call("GET", f"/bundleIds?filter[identifier]={args.bundle}&limit=200").get("data", [])
    bundle = next((b for b in found if b["attributes"]["identifier"] == args.bundle), None)
    lines.append("- Clé Apple : elle répond.")
    if bundle is None:
        connect.call(
            "POST",
            "/bundleIds",
            {"data": {"type": "bundleIds", "attributes": {"identifier": args.bundle, "name": args.name, "platform": "IOS"}}},
        )
        lines.append(f"- Identifiant `{args.bundle}` : il n'existait pas, il vient d'être enregistré.")
    else:
        lines.append(f"- Identifiant `{args.bundle}` : déjà enregistré.")

    apps = connect.call("GET", f"/apps?filter[bundleId]={args.bundle}&limit=5").get("data", [])
    record = any(a["attributes"].get("bundleId") == args.bundle for a in apps)
    if record:
        lines.append("- Fiche de l'appli dans App Store Connect : elle existe. L'envoi peut partir.")
    else:
        lines.append("- Fiche de l'appli dans App Store Connect : **elle n'existe pas encore**. Le propriétaire doit la créer (docs/TESTFLIGHT.md), puis l'envoi peut partir.")

    print("\n".join(lines))
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as stream:
            stream.write("## Côté Apple, avant l'envoi\n\n" + "\n".join(lines) + "\n")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as stream:
            stream.write(f"app_record={'yes' if record else 'no'}\n")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except AppleError as error:
        sys.exit(fail(error))
    except Exception as error:  # no traceback: it could show an argument or an address
        sys.exit(fail(AppleError(f"Unexpected problem ({type(error).__name__}).")))
