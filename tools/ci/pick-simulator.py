"""Chooses the iPhone simulator of the iOS check.

Reads `xcrun simctl list devices available -j` on standard input and prints the identifier of one
iPhone: the newest iOS installed, and a current standard-size iPhone when there is one. What was
chosen goes to standard error, for the log.

Same method as the screen check of DishPlay (Omazi/dishplay3d, ios/ci/pick-simulator.py).
"""

import json
import re
import sys

PREFERRED = [
    "iPhone 18 Pro",
    "iPhone 18",
    "iPhone 17 Pro",
    "iPhone 17",
    "iPhone 16 Pro",
    "iPhone 16",
]


def main() -> None:
    best = None
    for runtime, entries in json.load(sys.stdin)["devices"].items():
        found = re.search(r"iOS-(\d+)-(\d+)", runtime)
        if not found:
            continue
        version = (int(found.group(1)), int(found.group(2)))
        for device in entries:
            name = device.get("name", "")
            if not device.get("isAvailable", True) or not name.startswith("iPhone"):
                continue
            rank = PREFERRED.index(name) if name in PREFERRED else len(PREFERRED)
            key = (version, -rank)
            if best is None or key > best[0]:
                best = (key, device["udid"], f"{name}, iOS {version[0]}.{version[1]}")
    if best is None:
        sys.exit("no iPhone simulator is installed on this machine")
    print(best[2], file=sys.stderr)
    print(best[1])


if __name__ == "__main__":
    main()
