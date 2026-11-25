"""Copies what one of Apple's tools said, without the names it can hold.

    grep -i error "$RUNNER_TEMP/export.log" | python3 tools/apple/redact.py

The log of a job on a public repository is public. Xcode and altool name the holder of the signing
certificate ("Apple Distribution: First Last (TEAM)"), sometimes the team, sometimes an address.
The rest of each line is kept: it says what went wrong.
"""

from __future__ import annotations

import re
import sys
from typing import TextIO

SIGNING_CERTIFICATE = re.compile(r"\b((?:Apple|iPhone|iOS) (?:Distribution|Development|Developer)):[^\"'\n]*")
TEAM_IN_QUOTES = re.compile(r"\b([Tt]eam) ([\"'])[^\"'\n]*\2")
ADDRESS = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+")


def redact(line: str) -> str:
    line = SIGNING_CERTIFICATE.sub(r"\1: (hidden)", line)
    line = TEAM_IN_QUOTES.sub(r"\1 (hidden)", line)
    return ADDRESS.sub("(address hidden)", line)


def copy(source: TextIO, destination: TextIO) -> None:
    for line in source:
        destination.write(redact(line))


if __name__ == "__main__":
    copy(sys.stdin, sys.stdout)
