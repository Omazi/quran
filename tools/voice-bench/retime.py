#!/usr/bin/env python3
"""Times the same clips with and without whisper.cpp's temperature fallback, alone on the machine.

    python3 -I tools/voice-bench/retime.py <data dir> <work dir> <offline-<config>.jsonl>

Takes the 20 slowest clips of an offline run and one in 25 of the others, reads each with
`temperatureInc` 0.2 (whisper.cpp's default) and 0 (the app's, D45), and prints the median, the
worst and the total time. Run nothing else meanwhile (README: ggml waits by spinning).
"""
import json
import statistics
import struct
import subprocess
import sys


def main():
    data, work, readings = sys.argv[1:4]
    rows = [json.loads(line) for line in open(readings) if line.strip()]
    slow = sorted(rows, key=lambda r: -r['ms'])[:20]
    others = [r for r in rows if r not in slow][::25]

    def pcm(clip):
        stream, condition, start, wanted = clip.split('|')
        raw = open(f'{data}/{condition}/{stream}.wav', 'rb').read()
        at = raw.find(b'data')
        size = struct.unpack('<I', raw[at + 4:at + 8])[0]
        audio = raw[at + 8:at + 8 + size]
        first = int(round(float(start) * 16000)) * 2
        return audio[first:first + int(float(wanted) * 16000) * 2]

    driver = subprocess.Popen([f'{work}/whisper-driver', f'{work}/ggml-quran-tiny-q8_0.bin'],
                              stdin=subprocess.PIPE, stdout=subprocess.PIPE)
    driver.stdout.readline()

    def read(samples, fallback):
        header = (f'samples={len(samples) // 2} threads=2 beam=0 bestof=5 temp=0 '
                  f'tinc={fallback} maxctx=0 prompt=0\n')
        driver.stdin.write(header.encode() + samples)
        driver.stdin.flush()
        return json.loads(driver.stdout.readline())['ms']

    for name, group in (('slowest 20', slow), ('one in 25 of the others', others)):
        for fallback in (0.2, 0.0):
            times = sorted(read(pcm(r['clip']), fallback) for r in group)
            print(f'{name}, temperatureInc {fallback}: {len(times)} clips, median '
                  f'{statistics.median(times):.0f} ms, worst {times[-1]:.0f} ms, '
                  f'total {sum(times) / 1000:.1f} s', flush=True)


if __name__ == '__main__':
    main()
