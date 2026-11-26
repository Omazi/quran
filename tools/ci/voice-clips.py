"""Fetches the recitations of the iOS check's voice proof (docs/voice-test-clips.md).

    python3 -I tools/ci/voice-clips.py tools/ci/voice-clips.json <output folder>

Each clip of the list is downloaded from its own source at run time (no audio is in the
repository), and kept only if its size and SHA-256 are the ones written in the list and its name
says what it holds (`<id>__<surah>-<first verse>-<last verse>.wav`). A clip that fails is left
out and said so; the others are kept. Prints how many were kept.
"""

import hashlib
import json
import pathlib
import re
import sys
import urllib.request

NAME = re.compile(r"[A-Za-z0-9_-]{1,60}__[0-9]{1,3}-[0-9]{1,3}-[0-9]{1,3}\.wav")
MAX_BYTES = 20 * 1024 * 1024
MAX_CLIPS = 8


def check(clip: dict, data: bytes) -> str | None:
    """Why `data` is not the clip the list describes, or None when it is."""
    if len(data) != clip.get("bytes"):
        return f"{len(data)} bytes, not {clip.get('bytes')}"
    if hashlib.sha256(data).hexdigest() != clip.get("sha256"):
        return "another SHA-256"
    if not (data[:4] == b"RIFF" and data[8:12] == b"WAVE"):
        return "not a WAV file"
    return None


def valid_entry(clip) -> str | None:
    if not isinstance(clip, dict):
        return "not an object"
    if not isinstance(clip.get("name"), str) or not NAME.fullmatch(clip["name"]):
        return "a name that does not say what it holds"
    if not isinstance(clip.get("url"), str) or not clip["url"].startswith("https://"):
        return "an address that is not https"
    if not isinstance(clip.get("bytes"), int) or not 0 < clip["bytes"] <= MAX_BYTES:
        return "no plausible size"
    if not isinstance(clip.get("sha256"), str) or not re.fullmatch(r"[0-9a-f]{64}", clip["sha256"]):
        return "no SHA-256"
    return None


def fetch(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=120) as response:
        return response.read(MAX_BYTES + 1)


def main(argv: list[str], download=fetch) -> int:
    listing, out = pathlib.Path(argv[1]), pathlib.Path(argv[2])
    clips = json.loads(listing.read_text(encoding="utf-8")).get("clips", [])[:MAX_CLIPS]
    out.mkdir(parents=True, exist_ok=True)
    kept = 0
    for clip in clips:
        problem = valid_entry(clip)
        label = clip.get("name", "?") if isinstance(clip, dict) else "?"
        if problem is None:
            try:
                data = download(clip["url"])
            except Exception as error:  # a source that is down: the others still run
                problem = f"download failed ({type(error).__name__})"
            else:
                problem = check(clip, data)
        if problem is not None:
            print(f"left out: {label}: {problem}")
            continue
        (out / clip["name"]).write_bytes(data)
        kept += 1
        print(f"kept: {clip['name']}")
    print(f"clips kept: {kept}/{len(clips)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
