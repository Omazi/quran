"""Turns what the iOS check's crash hunt collected into one short text report.

    python3 tools/ci/crash-report.py --progress P --closure C --ips-dir D --log L --alive 0|1 --out R

The crash hunt (`.github/workflows/ios-check.yml`, step "Crash hunt") starts the check build on a
fresh install with `-screenCheckAutoSwipe 1`: the app swipes through the whole introduction by
itself, opens the demonstration friend's page, zooms its garden, presses "Encourager" and scrolls.
This script reads what it left (the progress file the run writes in the app's folder, the record
of the app's own error recorder, the crash reports and the simulator's log) and prints one word:

    OK          the app lived to the end of the run
    CRASH       the app's process died (or a crash report or a JavaScript record exists)
    INCOMPLETE  the app is alive but the run did not end in time (a hang?)

The report is plain text, made of printable characters and capped in size: it is the one file of
the hunt that `publish-screens.py` may put on the branch `ci-screens` (docs/SECURITY.md).
"""

import argparse
import json
import pathlib
import re
import sys

MAX_REPORT_BYTES = 150_000
MAX_INPUT_BYTES = 2_000_000
PROGRESS_LINES = 60
LOG_LINES = 150
FRAMES = 40
NO_PROGRESS = "(no progress file: the app never started the run)"

_CONTROL = re.compile(r"[^\n\t\x20-\x7e -\U0010ffff]")


def clean(text: str, limit: int = MAX_REPORT_BYTES) -> str:
    """Printable text only (no escape sequences, no NUL), cut to `limit` characters."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = _CONTROL.sub("", text)
    return text[:limit]


def read_text(path: pathlib.Path | None) -> str | None:
    """A file's text, or None when it is missing; bytes that are not UTF-8 are replaced."""
    if path is None or not path.is_file() or path.is_symlink():
        return None
    return path.read_bytes()[:MAX_INPUT_BYTES].decode("utf-8", errors="replace")


def parse_progress(text: str | None) -> dict:
    lines = [line for line in (text or "").splitlines() if line.strip()]
    return {
        "lines": lines,
        "last": lines[-1] if lines else NO_PROGRESS,
        "finished": any("auto-run: DONE" in line for line in lines),
    }


def _image(images: list, index) -> str:
    if isinstance(index, int) and 0 <= index < len(images) and isinstance(images[index], dict):
        return str(images[index].get("name", "?"))
    return "?"


def _frames(frames, images) -> list[str]:
    out = []
    for frame in (frames if isinstance(frames, list) else [])[:FRAMES]:
        if not isinstance(frame, dict):
            continue
        symbol = frame.get("symbol")
        where = f"{_image(images, frame.get('imageIndex'))}+{frame.get('imageOffset', '?')}"
        out.append(f"    {symbol} ({where})" if symbol else f"    {where}")
    return out


def summarize_ips(text: str) -> list[str]:
    """The exception, the reason and the frames of the thread that crashed, from an `.ips` file.

    The file is two JSON values, a header line and the body; anything that is not that is said to
    be unreadable rather than copied.
    """
    try:
        _, _, body_text = text.partition("\n")
        body = json.loads(body_text)
        if not isinstance(body, dict):
            raise ValueError("not an object")
    except ValueError:
        return ["  (unreadable crash report)"]
    images = body.get("usedImages") if isinstance(body.get("usedImages"), list) else []
    lines = [f"  process: {body.get('procName', '?')}"]
    exception = body.get("exception")
    if isinstance(exception, dict):
        lines.append(f"  exception: {exception.get('type', '?')} {exception.get('signal', '')}".rstrip())
    termination = body.get("termination")
    if isinstance(termination, dict):
        lines.append(f"  termination: {termination.get('namespace', '')} {termination.get('indicator', '')}".rstrip())
    asi = body.get("asi")
    if isinstance(asi, dict):
        for library, messages in asi.items():
            lines.append(f"  {library}: {messages}")
    threads = body.get("threads") if isinstance(body.get("threads"), list) else []
    index = body.get("faultingThread")
    crashed = [t for t in threads if isinstance(t, dict) and t.get("triggered")]
    if not crashed and isinstance(index, int) and 0 <= index < len(threads) and isinstance(threads[index], dict):
        crashed = [threads[index]]
    for thread in crashed[:1]:
        name = thread.get("name") or thread.get("queue") or ""
        lines.append(f"  crashed thread {thread.get('id', '?')} {name}".rstrip())
        lines += _frames(thread.get("frames"), images)
    backtrace = body.get("lastExceptionBacktrace")
    if isinstance(backtrace, list) and backtrace:
        lines.append("  last exception backtrace:")
        lines += _frames(backtrace, images)
    return lines


def _closure_lines(closure: str | None) -> list[str]:
    if closure is None:
        return ["JavaScript record (the app's own error recorder): none. With no JavaScript record, a process that died was ended by something native."]
    try:
        record = json.loads(closure)
        if not isinstance(record, dict):
            raise ValueError("not an object")
    except ValueError:
        return ["JavaScript record: present but unreadable."]
    lines = [
        "JavaScript record (the app's own error recorder): PRESENT",
        f"  source: {record.get('source', '?')} (fatal: the app closed; boundary: an error screen was shown)",
        f"  message: {record.get('message', '?')}",
        f"  screen: {record.get('route', '?')}",
        f"  time: {record.get('time', '?')}",
    ]
    stack = str(record.get("stack", ""))
    lines += ["  stack:"] + [f"    {line}" for line in stack.splitlines()[:25]]
    trail = record.get("breadcrumbs")
    if isinstance(trail, list):
        lines.append("  trail (last 30):")
        for crumb in trail[-30:]:
            if isinstance(crumb, dict):
                lines.append(f"    {crumb.get('kind', '?')} {crumb.get('label', '?')}")
    return lines


def build_report(progress, closure, ips, log, alive) -> tuple[str, str]:
    steps = parse_progress(progress)
    has_javascript_record = closure is not None
    if not alive or ips or has_javascript_record:
        verdict = "CRASH"
    elif steps["finished"]:
        verdict = "OK"
    else:
        verdict = "INCOMPLETE"
    lines = [
        f"VERDICT: {verdict}",
        f"Process alive at the end of the run: {'yes' if alive else 'NO'}",
        f"Run finished: {'yes' if steps['finished'] else 'no'}",
        f"Last step reached: {steps['last']}",
        "",
    ]
    lines += _closure_lines(closure)
    lines += ["", f"Crash reports (.ips): {len(ips)}"]
    for number, text in enumerate(ips, 1):
        lines.append(f" report {number}:")
        lines += summarize_ips(text)
    lines += ["", f"Progress (last {PROGRESS_LINES} lines):"]
    lines += [f"  {line}" for line in steps["lines"][-PROGRESS_LINES:]] or ["  (none)"]
    lines += ["", f"Simulator log of the app (last {LOG_LINES} lines):"]
    log_lines = (log or "").splitlines()[-LOG_LINES:]
    lines += [f"  {line[:400]}" for line in log_lines] or ["  (none)"]
    text = clean("\n".join(lines) + "\n")
    return verdict, text.encode("utf-8")[:MAX_REPORT_BYTES].decode("utf-8", errors="ignore")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--progress", type=pathlib.Path)
    parser.add_argument("--closure", type=pathlib.Path)
    parser.add_argument("--ips-dir", type=pathlib.Path)
    parser.add_argument("--log", type=pathlib.Path)
    parser.add_argument("--alive", choices=["0", "1"], required=True)
    parser.add_argument("--out", type=pathlib.Path, required=True)
    args = parser.parse_args()
    ips = []
    if args.ips_dir is not None and args.ips_dir.is_dir():
        for path in sorted(args.ips_dir.glob("*.ips"))[:5]:
            text = read_text(path)
            if text is not None:
                ips.append(text)
    verdict, text = build_report(
        read_text(args.progress),
        read_text(args.closure),
        ips,
        read_text(args.log),
        args.alive == "1",
    )
    args.out.write_text(text, encoding="utf-8")
    print(verdict)
    return 0


if __name__ == "__main__":
    sys.exit(main())
