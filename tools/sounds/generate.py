#!/usr/bin/env python3
"""Generates the app's sound palette: ten short, soft sounds, synthesised from nothing.

Every sample comes from the maths in this file (sine partials, filtered noise, a small synthetic
room): no recording, no sample library, no third-party audio. The sounds are therefore the
project's own work, released under CC0 1.0 (see assets/sounds/NOTICE.txt).

  python3 tools/sounds/generate.py     writes assets/sounds/<name>.m4a (AAC-LC, mono, 44.1 kHz)
  python3 tools/sounds/check.py        checks them without listening (clipping, fades, loudness)

The sounds are the ones validated in the "wow" mockup (mockups-wow/js/fx.js, 11 WebAudio
sounds), re-drawn as short files: a water drop, a soft plop, a gentle rising chime, an airy
whoosh, a paper tick, a warm two-note bell, a splash, the celebration chime, a heartbeat chime
for encouragement, and a low soft tone for an error. The generator is deterministic (fixed
random seed): running it twice gives the same samples.

Needs: numpy, scipy, ffmpeg (with the native AAC encoder). Used at build time of the assets only;
nothing here ships in the app.
"""

from __future__ import annotations

import subprocess
import sys
import tempfile
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import numpy as np
from scipy import signal

SAMPLE_RATE = 44_100
OUT_DIR = Path(__file__).resolve().parents[2] / "assets" / "sounds"
#: Peak ceiling before encoding. AAC can overshoot by a few tenths of a dB: the check asserts -3 dBFS after decoding.
PRE_ENCODE_PEAK_DB = -3.7
AAC_BITRATE = "56k"


@dataclass(frozen=True)
class Target:
    """What a sound is meant to sound like in the palette."""

    #: Level of the loudest 100 ms window, in dBFS (RMS). Equal across the palette, give or take
    #: the character of each sound (a tick is quieter than a chime).
    momentary_db: float


def t_axis(duration: float) -> np.ndarray:
    return np.arange(int(round(duration * SAMPLE_RATE))) / SAMPLE_RATE


def silence(duration: float) -> np.ndarray:
    return np.zeros(int(round(duration * SAMPLE_RATE)))


def mix_at(out: np.ndarray, part: np.ndarray, start: float, gain: float = 1.0) -> None:
    """Adds `part` into `out` starting at `start` seconds (cut if it runs past the end)."""
    i = int(round(start * SAMPLE_RATE))
    n = max(0, min(len(part), len(out) - i))
    if n > 0:
        out[i : i + n] += gain * part[:n]


def envelope(n: int, attack: float, decay: float) -> np.ndarray:
    """Smooth attack (raised cosine), then an exponential decay with time constant `decay`."""
    t = np.arange(n) / SAMPLE_RATE
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    rise = 0.5 - 0.5 * np.cos(np.pi * a)
    return rise * np.exp(-t / decay)


def partial(freq: float, duration: float, attack: float, decay: float, glide_to: float | None = None,
            glide_time: float = 0.1, phase: float = 0.0) -> np.ndarray:
    t = t_axis(duration)
    if glide_to is None:
        inst = np.full_like(t, freq)
    else:  # exponential glide from freq to glide_to, then steady
        k = np.clip(t / glide_time, 0, 1)
        inst = freq * (glide_to / freq) ** (1 - (1 - k) ** 2)
    phi = 2 * np.pi * np.cumsum(inst) / SAMPLE_RATE + phase
    return np.sin(phi) * envelope(len(t), attack, decay)


def bell(freq: float, duration: float, decay: float, warmth: float = 1.0) -> np.ndarray:
    """A soft bell: a few partials, the upper ones dying faster. `warmth` < 1 darkens it."""
    spec = [(1.0, 1.00, 1.0), (2.0, 0.34 * warmth, 0.55), (2.76, 0.10 * warmth, 0.35), (4.07, 0.04 * warmth, 0.2)]
    out = np.zeros(int(round(duration * SAMPLE_RATE)))
    for ratio, amp, life in spec:
        out += amp * partial(freq * ratio, duration, 0.004, decay * life)
    return out


def noise(duration: float, rng: np.random.Generator) -> np.ndarray:
    return rng.standard_normal(int(round(duration * SAMPLE_RATE)))


def bandpass(x: np.ndarray, low: float, high: float, order: int = 2) -> np.ndarray:
    sos = signal.butter(order, [low, high], btype="band", fs=SAMPLE_RATE, output="sos")
    return signal.sosfilt(sos, x)


def highpass(x: np.ndarray, freq: float, order: int = 2) -> np.ndarray:
    sos = signal.butter(order, freq, btype="high", fs=SAMPLE_RATE, output="sos")
    return signal.sosfilt(sos, x)


def lowpass(x: np.ndarray, freq: float, order: int = 2) -> np.ndarray:
    sos = signal.butter(order, freq, btype="low", fs=SAMPLE_RATE, output="sos")
    return signal.sosfilt(sos, x)


def swept_noise(duration: float, f_start: float, f_end: float, rng: np.random.Generator,
                width: float = 0.9) -> np.ndarray:
    """White noise through a band-pass whose centre glides from f_start to f_end (a breath of air)."""
    x = noise(duration, rng)
    out = np.zeros_like(x)
    block = 512
    zi = None
    for start in range(0, len(x), block):
        k = start / max(len(x) - 1, 1)
        centre = f_start * (f_end / f_start) ** k
        sos = signal.butter(2, [centre * (1 - width / 2), min(centre * (1 + width / 2), 0.45 * SAMPLE_RATE)],
                            btype="band", fs=SAMPLE_RATE, output="sos")
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        y, zi = signal.sosfilt(sos, x[start : start + block], zi=zi)
        out[start : start + block] = y
    return out


def room(x: np.ndarray, rng: np.random.Generator, seconds: float = 0.45, wet: float = 0.18) -> np.ndarray:
    """A small soft room: the sound convolved with a decaying, darkened noise, mixed in lightly."""
    n = int(seconds * SAMPLE_RATE)
    t = np.arange(n) / SAMPLE_RATE
    ir = rng.standard_normal(n) * np.exp(-t / (seconds / 5.5))
    ir = lowpass(ir, 5000)
    ir[0] = 0
    ir /= np.sqrt(np.sum(ir**2))
    tail = signal.fftconvolve(x, ir)[: len(x)]
    return (1 - wet) * x + wet * tail


def fade(x: np.ndarray, fade_in: float = 0.003, fade_out: float = 0.06) -> np.ndarray:
    """Short fade in, longer fade out (raised cosine), so a file never starts or ends on a click."""
    y = x.copy()
    ni = max(int(fade_in * SAMPLE_RATE), 1)
    no = max(int(fade_out * SAMPLE_RATE), 1)
    y[:ni] *= 0.5 - 0.5 * np.cos(np.pi * np.arange(ni) / ni)
    y[-no:] *= 0.5 + 0.5 * np.cos(np.pi * np.arange(no) / no)
    return y


# ---------------------------------------------------------------------------------------------
# The ten sounds. Each returns a float signal, any level: `finish` sets the loudness.
# ---------------------------------------------------------------------------------------------

def make_drop(rng: np.random.Generator) -> np.ndarray:
    """Water drop: a small bright bubble whose pitch rises as it forms, then a tiny echo."""
    out = silence(0.55)
    mix_at(out, partial(1150, 0.4, 0.002, 0.07, glide_to=1900, glide_time=0.05), 0.0, 1.0)
    mix_at(out, partial(2300, 0.2, 0.002, 0.03, glide_to=3600, glide_time=0.05), 0.0, 0.18)
    mix_at(out, partial(1150, 0.4, 0.002, 0.06, glide_to=1900, glide_time=0.05), 0.13, 0.16)  # tiny echo
    return room(out, rng, 0.3, 0.12)


def make_drop_received(rng: np.random.Generator) -> np.ndarray:
    """Soft plop: a lower, rounder bubble with a hint of water, as the drop lands."""
    out = silence(0.4)
    mix_at(out, partial(330, 0.3, 0.003, 0.07, glide_to=640, glide_time=0.07), 0.0, 1.0)
    mix_at(out, partial(660, 0.2, 0.003, 0.04, glide_to=1100, glide_time=0.06), 0.0, 0.22)
    wet = lowpass(bandpass(noise(0.12, rng), 600, 2600), 3000) * envelope(int(0.12 * SAMPLE_RATE), 0.004, 0.025)
    mix_at(out, wet, 0.0, 0.06)
    return room(out, rng, 0.25, 0.1)


def make_grow(rng: np.random.Generator) -> np.ndarray:
    """Growth: a gentle rising chime, three soft notes (C5, E5, G5) with a faint shimmer on top."""
    out = silence(1.25)
    for i, f in enumerate([523.25, 659.25, 783.99]):
        mix_at(out, bell(f, 1.0, 0.45, warmth=0.8), 0.09 * i, 1.0)
    mix_at(out, bell(1567.98, 0.8, 0.3, warmth=0.5), 0.27, 0.12)
    return room(out, rng, 0.5, 0.2)


def make_open(rng: np.random.Generator) -> np.ndarray:
    """Open: a soft airy whoosh that rises and falls, with a faint low pad under it."""
    d = 0.7
    air = swept_noise(d, 500, 1800, rng, width=1.1)
    t = t_axis(d)
    shape = np.sin(np.pi * np.clip(t / d, 0, 1) ** 0.8) ** 2
    out = air * shape
    out = out / (np.max(np.abs(out)) + 1e-9)
    pad = partial(392, d, 0.12, 0.25) * 0.22
    return out * 0.9 + pad


def make_page(rng: np.random.Generator) -> np.ndarray:
    """Page: a paper-light tick, a brief brushed noise with a tiny soft click."""
    out = silence(0.16)
    brush = highpass(bandpass(noise(0.12, rng), 1600, 5200), 1600) * envelope(int(0.12 * SAMPLE_RATE), 0.002, 0.016)
    mix_at(out, brush, 0.0, 1.0)
    mix_at(out, partial(1300, 0.06, 0.001, 0.008), 0.0, 0.35)
    return out


def make_found(rng: np.random.Generator) -> np.ndarray:
    """Found: a warm two-note bell, D5 then A5 (a fifth up), the second ringing longer."""
    out = silence(1.7)
    mix_at(out, bell(587.33, 1.2, 0.55, warmth=0.9), 0.0, 0.85)
    mix_at(out, bell(880.0, 1.5, 0.75, warmth=0.9), 0.15, 1.0)
    return room(out, rng, 0.6, 0.22)


def make_splash(rng: np.random.Generator) -> np.ndarray:
    """Splash: a soft burst of water, a few droplets flying off, and a round tone settling."""
    out = silence(1.0)
    burst = bandpass(noise(0.4, rng), 900, 4200) * envelope(int(0.4 * SAMPLE_RATE), 0.01, 0.09)
    mix_at(out, burst, 0.0, 1.0)
    mix_at(out, partial(660, 0.8, 0.01, 0.18), 0.02, 0.55)
    mix_at(out, partial(990, 0.8, 0.01, 0.2), 0.06, 0.25)
    # Droplets: tiny rising bubbles at fixed (seeded) times and pitches.
    for when, f in [(0.07, 1500), (0.12, 1900), (0.19, 1300), (0.26, 2100), (0.34, 1700)]:
        mix_at(out, partial(f, 0.12, 0.002, 0.025, glide_to=f * 1.5, glide_time=0.03), when, 0.28)
    return room(out, rng, 0.4, 0.16)


def make_celebrate(rng: np.random.Generator) -> np.ndarray:
    """Celebration (hizb, khatma): a rising D-major chime with a long tail and a warm low pad."""
    out = silence(3.1)
    notes = [293.66, 440.0, 587.33, 739.99, 880.0, 1174.66]
    for i, f in enumerate(notes):
        mix_at(out, bell(f, 2.2, 1.0, warmth=0.8), 0.14 * i, 0.9 if i < 5 else 1.0)
    mix_at(out, partial(146.83, 2.8, 0.35, 0.9), 0.0, 0.5)  # D3 pad
    mix_at(out, partial(220.0, 2.8, 0.35, 0.9), 0.0, 0.3)
    return room(out, rng, 0.9, 0.3)


def make_encourage(rng: np.random.Generator) -> np.ndarray:
    """Encouragement: a soft heartbeat (two low pulses) answered by a small warm bell."""
    out = silence(1.2)
    for when, gain in [(0.0, 1.0), (0.17, 0.7)]:
        mix_at(out, partial(150, 0.25, 0.004, 0.05, glide_to=95, glide_time=0.08), when, gain)
        mix_at(out, partial(300, 0.15, 0.003, 0.025), when, gain * 0.25)
    mix_at(out, bell(783.99, 0.9, 0.5, warmth=0.8), 0.3, 0.75)
    return room(out, rng, 0.45, 0.16)


def make_error(rng: np.random.Generator) -> np.ndarray:
    """Error: a soft low tone sinking a minor third (E4 to C#4), rounded, never harsh."""
    out = silence(0.65)
    mix_at(out, partial(329.63, 0.55, 0.012, 0.16, glide_to=277.18, glide_time=0.22), 0.0, 1.0)
    mix_at(out, partial(659.26, 0.4, 0.012, 0.08, glide_to=554.37, glide_time=0.22), 0.0, 0.12)
    return room(out, rng, 0.3, 0.1)


#: The palette: name -> (synth, target). Loudness targets are the loudest 100 ms RMS, in dBFS.
SOUNDS: dict[str, tuple[Callable[[np.random.Generator], np.ndarray], Target]] = {
    "drop": (make_drop, Target(-14.0)),
    "plop": (make_drop_received, Target(-14.0)),
    "grow": (make_grow, Target(-14.0)),
    "open": (make_open, Target(-16.0)),
    "page": (make_page, Target(-22.0)),
    "found": (make_found, Target(-14.0)),
    "splash": (make_splash, Target(-14.0)),
    "celebrate": (make_celebrate, Target(-14.0)),
    "encourage": (make_encourage, Target(-15.0)),
    "error": (make_error, Target(-16.0)),
}
TARGETS: dict[str, Target] = {name: target for name, (_, target) in SOUNDS.items()}


def momentary_db(x: np.ndarray, window: float = 0.100) -> float:
    win = int(window * SAMPLE_RATE)
    sq = x**2
    if len(x) <= win:
        return 10 * np.log10(max(float(sq.mean()), 1e-18))
    csum = np.concatenate([[0.0], np.cumsum(sq)])
    energy = (csum[win:] - csum[:-win]) / win
    return 10 * np.log10(max(float(energy.max()), 1e-18))


def finish(x: np.ndarray, target: Target, name: str) -> np.ndarray:
    """Trims the tail, fades, and sets the loudness; keeps the peak under the ceiling."""
    # Drop trailing near-silence (the room's last whisper) so files stay small.
    keep = np.nonzero(np.abs(x) > 1e-4 * np.max(np.abs(x)))[0]
    x = x[: min(len(x), int(keep[-1]) + int(0.05 * SAMPLE_RATE))]
    x = x - np.mean(x)
    x = fade(x, fade_in=0.004, fade_out=min(0.12, 0.25 * len(x) / SAMPLE_RATE))
    # Rumble below 60 Hz costs bits and means nothing on a phone speaker.
    x = highpass(x, 60, order=2)
    x = fade(x, fade_in=0.004, fade_out=0.01)
    gain = 10 ** ((target.momentary_db - momentary_db(x)) / 20)
    y = x * gain
    ceiling = 10 ** (PRE_ENCODE_PEAK_DB / 20)
    peak = float(np.max(np.abs(y)))
    if peak > ceiling:
        print(f"  warning: {name} is peak limited ({20 * np.log10(peak):.1f} dBFS): its loudness will be "
              f"{20 * np.log10(ceiling / peak):.1f} dB under the target", file=sys.stderr)
        y *= ceiling / peak
    return y


def write_wav(path: Path, x: np.ndarray) -> None:
    pcm = np.clip(np.round(x * 32767), -32768, 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        w.writeframes(pcm.tobytes())


def encode(wav: Path, out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", str(wav), "-c:a", "aac", "-b:a", AAC_BITRATE,
         "-ar", str(SAMPLE_RATE), "-ac", "1", "-movflags", "+faststart", "-map_metadata", "-1",
         "-fflags", "+bitexact", str(out)],
        check=True,
    )


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        for index, (name, (synth, target)) in enumerate(SOUNDS.items()):
            rng = np.random.default_rng(20261127 + index)  # fixed seeds: same samples every run
            samples = finish(synth(rng), target, name)
            wav = Path(tmp) / f"{name}.wav"
            write_wav(wav, samples)
            out = OUT_DIR / f"{name}.m4a"
            encode(wav, out)
            print(f"{name:<10} {len(samples) / SAMPLE_RATE:5.2f} s  {out.stat().st_size:>6} B")
    return 0


if __name__ == "__main__":
    sys.exit(main())
