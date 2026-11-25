"""Checks that what is about to be signed, then what was signed, is the one app that was asked for.

    python3 tools/apple/check-app.py archive "$RUNNER_TEMP/archive/App.xcarchive" --bundle com.omazi.quran --build 20261124.1380
    python3 tools/apple/check-app.py signed "$RUNNER_TEMP/check" --bundle com.omazi.quran --build 20261124.1380

The archive comes from the job that compiles, which runs other people's code (npm, CocoaPods) and
holds no secret. The job that holds the Apple key signs only what passes here:
  - exactly one app, a real folder, with the expected identifier and build number;
  - nothing else that runs: no extension, no watch app, no code bundled deeper in the app. The
    profile made for the send covers one identifier;
  - no link that leaves the app: a link to a file of the machine would travel in the signed app.

`archive` hands the two paths to the following steps through GITHUB_ENV. `signed` is given the
folder where the .ipa was unpacked and asks the same questions of what is about to be uploaded.
"""

from __future__ import annotations

import argparse
import os
import plistlib
import re
import sys
from pathlib import Path

from asc import AppleError, fail

# The name is written to GITHUB_ENV: a line break in it would set another variable of the job.
SAFE_APP_NAME = re.compile(r"[A-Za-z0-9][A-Za-z0-9 ._-]*\.app")
# An extension, a watch app or a service is a second thing that runs: wherever it sits, it is refused.
BUNDLES_OF_CODE = (".app", ".appex", ".xpc")


def read_plist(path: Path) -> dict:
    try:
        content = plistlib.loads(path.read_bytes())
    except (OSError, ValueError, plistlib.InvalidFileException):
        raise AppleError(f"{path.name} cannot be read as a property list.") from None
    if not isinstance(content, dict):
        raise AppleError(f"{path.name} is not a dictionary.")
    return content


def only_app(container: Path) -> Path:
    found = sorted(entry for entry in container.iterdir() if entry.name.endswith(".app")) if container.is_dir() else []
    if len(found) != 1:
        raise AppleError(f"Exactly one app is expected in {container.name}; found {len(found)}.")
    app = found[0]
    if app.is_symlink() or not app.is_dir():
        raise AppleError("The app is a link or a file, not a folder of its own.")
    if not SAFE_APP_NAME.fullmatch(app.name):
        raise AppleError("The app's name holds characters that are not expected.")
    return app


def check_content(app: Path) -> None:
    root = os.path.realpath(app)
    for folder, folders, files in os.walk(app):  # links to folders are listed, never entered
        for name in folders + files:
            path = os.path.join(folder, name)
            if os.path.islink(path):
                target = os.path.realpath(path)
                if target != root and not target.startswith(root + os.sep):
                    raise AppleError("The app holds a link that leaves the app.")
            elif name.endswith(BUNDLES_OF_CODE):
                raise AppleError("The app holds other code bundled inside it (an app, an extension or a service).")


def check_app(app: Path, bundle: str, build: str) -> None:
    check_content(app)  # first: Info.plist itself must not be a link to somewhere else
    info = read_plist(app / "Info.plist")
    if info.get("CFBundleIdentifier") != bundle:
        raise AppleError(f"The app does not carry the identifier {bundle}.")
    if info.get("CFBundleVersion") != build:
        raise AppleError(f"The app does not carry the build number {build}.")


def archive_app(archive: Path, bundle: str, build: str) -> Path:
    """The app of an Xcode archive, once it is known to be the one that was asked for."""
    app = only_app(archive / "Products" / "Applications")
    check_app(app, bundle, build)
    # Xcode exports the app this file names. When it names none, Xcode refuses the archive by itself.
    description = archive / "Info.plist"
    properties = read_plist(description).get("ApplicationProperties", {}) if description.is_file() else {}
    named = properties.get("ApplicationPath") if isinstance(properties, dict) else None
    if named is not None and named != f"Applications/{app.name}":
        raise AppleError("The archive points at another app than the one it holds.")
    return app


def payload_app(folder: Path, bundle: str, build: str) -> Path:
    """The app of an unpacked .ipa, once it is known to be the one that was asked for."""
    app = only_app(folder / "Payload")
    check_app(app, bundle, build)
    return app


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("what", choices=["archive", "signed"])
    parser.add_argument("path")
    parser.add_argument("--bundle", required=True)
    parser.add_argument("--build", required=True)
    args = parser.parse_args()

    if args.what == "signed":
        payload_app(Path(args.path), args.bundle, args.build)
        print(f"The signed app carries {args.bundle}, build {args.build}, and nothing else that runs.")
        return 0
    archive = Path(args.path)
    app = archive_app(archive, args.bundle, args.build)
    if os.environ.get("GITHUB_ENV"):
        with open(os.environ["GITHUB_ENV"], "a", encoding="utf-8") as stream:
            stream.write(f"ARCHIVE={archive}\nAPP_IN_ARCHIVE={app}\n")
    print(f"The archive holds one app, {args.bundle}, build {args.build}, and nothing else that runs.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except AppleError as error:
        sys.exit(fail(error))
    except Exception as error:  # no traceback: it could show a path of the machine
        sys.exit(fail(AppleError(f"Unexpected problem while checking the app ({type(error).__name__}).")))
