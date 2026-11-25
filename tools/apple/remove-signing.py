"""Removes what tools/apple/install-signing.py put on the machine. Runs at the end of the job, always.

The machine is thrown away by GitHub after the job; this keeps the key off its disk for the steps
that follow, and off any step added later by mistake.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path


def main() -> int:
    folder = os.environ.get("SIGNING_FOLDER", "")
    if not folder or not Path(folder).is_dir():
        print("Nothing to remove.")
        return 0
    root = Path(folder)
    try:
        before = json.loads((root / "original-keychains.json").read_text())
        subprocess.run(["security", "list-keychains", "-d", "user", "-s", *before], capture_output=True)
    except (OSError, ValueError):
        pass
    subprocess.run(["security", "delete-keychain", str(root / "signing.keychain-db")], capture_output=True)
    try:
        for path in json.loads((root / "installed-profiles.json").read_text()):
            Path(path).unlink(missing_ok=True)
    except (OSError, ValueError):
        pass
    shutil.rmtree(root, ignore_errors=True)
    print("The certificate, the profile and the key are removed from this machine.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
