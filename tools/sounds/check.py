#!/usr/bin/env python3
"""Listen-free quality checks of the app's sound palette (assets/sounds/*.m4a).

Decodes each file with ffmpeg, then checks, on the decoded signal (what the phone will play):

  - the file exists, is mono 44.1 kHz AAC in an m4a, and is at most 30 KB;
  - no clipping: the peak stays at or below -3 dBFS, and no run of full-scale samples;
  - fade in and fade out: it starts and ends on silence (no click);
  - no DC offset;
  - loudness consistent: the loudest 100 ms window (a "momentary" level) sits at the level set
    for the sound in `generate.TARGETS` (+/- 1.5 dB), so no sound jumps out of the palette;
  - soft: nearly no energy above 14 kHz and a spectral centroid under 4.5 kHz (nothing shrill).

Exit status 0 when everything passes, 1 otherwise. Usage: python3 tools/sounds/check.py
Needs: numpy, ffmpeg. Nothing is played: it works on a machine without speakers.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from generate import OUT_DIR, SAMPLE_RATE, TARGETS  # noqa: E402

MAX_BYTES = 30 * 1024
PEAK_CEILING_DB = -3.0
LOUDNESS_TOLERANCE_DB = 1.5
WINDOW_S = 0.100


def db(x: float) -> float:
    return 20.0 * np.log10(max(x, 1e-9))


def probe(path: Path) -> dict[str, str]:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries",
         "stream=codec_name,sample_rate,channels", "-of", "default=nw=1", str(path)],
        capture_output=True, text=True, check=True,
    ).stdout
    return dict(line.split("=", 1) for line in out.strip().splitlines())


def decode(path: Path) -> np.ndarray:
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1",
         "-ar", str(SAMPLE_RATE), "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, dtype="<f4").astype(np.float64)


def momentary_db(x: np.ndarray) -> float:
    """Level of the loudest 100 ms window (RMS, after a 100 Hz high-pass to ignore rumble)."""
    spectrum = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(len(x), 1 / SAMPLE_RATE)
    spectrum[freqs < 100] = 0
    y = np.fft.irfft(spectrum, len(x))
    win = int(WINDOW_S * SAMPLE_RATE)
    if len(y) <= win:
        return db(float(np.sqrt(np.mean(y**2))))
    csum = np.concatenate([[0.0], np.cumsum(y**2)])
    energy = (csum[win:] - csum[:-win]) / win
    return db(float(np.sqrt(energy.max())))


def check_file(name: str) -> list[str]:
    problems: list[str] = []
    path = OUT_DIR / f"{name}.m4a"
    if not path.exists():
        return [f"{name}: file missing ({path})"]
    size = path.stat().st_size
    if size > MAX_BYTES:
        problems.append(f"{name}: {size} bytes, over {MAX_BYTES}")
    info = probe(path)
    if info.get("codec_name") != "aac" or info.get("channels") != "1" or info.get("sample_rate") != str(SAMPLE_RATE):
        problems.append(f"{name}: expected mono 44.1 kHz AAC, got {info}")
    x = decode(path)
    if len(x) < int(0.05 * SAMPLE_RATE):
        return problems + [f"{name}: shorter than 50 ms"]

    peak = float(np.max(np.abs(x)))
    if db(peak) > PEAK_CEILING_DB + 0.05:
        problems.append(f"{name}: peak {db(peak):.2f} dBFS is above {PEAK_CEILING_DB} dBFS")
    full_scale = np.abs(x) >= 0.999
    if full_scale.sum() > 0:
        problems.append(f"{name}: {int(full_scale.sum())} samples at full scale (clipping)")

    # Starts and ends on silence: a short fade in and a longer fade out leave no click.
    head = float(np.max(np.abs(x[: int(0.00025 * SAMPLE_RATE)])))
    tail = float(np.max(np.abs(x[-int(0.010 * SAMPLE_RATE):])))
    if head > 0.04:
        problems.append(f"{name}: starts at {db(head):.1f} dBFS (no fade in)")
    if tail > 0.003:
        problems.append(f"{name}: ends at {db(tail):.1f} dBFS (no fade out)")

    if abs(float(np.mean(x))) > 0.002:
        problems.append(f"{name}: DC offset {np.mean(x):.4f}")

    level = momentary_db(x)
    target = TARGETS[name].momentary_db
    if abs(level - target) > LOUDNESS_TOLERANCE_DB:
        problems.append(f"{name}: loudest 100 ms at {level:.1f} dB, expected {target:.1f} +/- {LOUDNESS_TOLERANCE_DB}")

    power = np.abs(np.fft.rfft(x * np.hanning(len(x)))) ** 2
    freqs = np.fft.rfftfreq(len(x), 1 / SAMPLE_RATE)
    total = float(power.sum()) + 1e-18
    high_share = float(power[freqs > 14000].sum()) / total
    centroid = float((power * freqs).sum()) / total
    if high_share > 0.002:
        problems.append(f"{name}: {high_share:.4f} of the energy above 14 kHz (shrill)")
    if centroid > 4500:
        problems.append(f"{name}: spectral centroid {centroid:.0f} Hz (too bright)")

    print(
        f"  {name:<10} {size:>6} B  {len(x) / SAMPLE_RATE:5.2f} s  peak {db(peak):6.2f} dBFS  "
        f"momentary {level:6.1f} dB  centroid {centroid:5.0f} Hz"
    )
    return problems


def main() -> int:
    print("Sound palette checks (decoded from the m4a files)")
    problems: list[str] = []
    for name in TARGETS:
        problems += check_file(name)
    total = sum((OUT_DIR / f"{n}.m4a").stat().st_size for n in TARGETS if (OUT_DIR / f"{n}.m4a").exists())
    print(f"  total {total} B for {len(TARGETS)} sounds")
    if problems:
        print("FAILED:")
        for p in problems:
            print("  -", p)
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
