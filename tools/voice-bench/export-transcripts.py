#!/usr/bin/env python3
"""Writes what Whisper wrote on the benchmark's clips as a test fixture of the app (text only).

    python3 -I tools/voice-bench/export-transcripts.py <data>/manifest.json <work>/offline-<config>.jsonl \
        src/domain/listening/__fixtures__/bench-recitations.ts

Keeps the 10-second clips in three conditions (clean, room noise at 10 dB, telephone band): the
text Whisper wrote and the verses the clip holds. No audio leaves the data folder.
"""
import json
import sys

KEPT_CONDITIONS = ('clean', 'noise10', 'phone8k')


def main():
    manifest_path, readings_path, out_path = sys.argv[1:4]
    streams = {s['id']: s for s in json.load(open(manifest_path))['streams']}
    entries = []
    for line in open(readings_path):
        if not line.strip():
            continue
        reading = json.loads(line)
        stream_id, condition, start, wanted = reading['clip'].split('|')
        if condition not in KEPT_CONDITIONS or wanted != '10':
            continue
        stream = streams[stream_id]
        start = float(start)
        end = start + min(10.0, stream['seconds'] - start)
        verses = [v for v in stream['verses']
                  if v['start'] is None or (v['start'] < end and v['end'] > start)]
        surah = verses[0]['surah']
        entries.append({
            'clip': reading['clip'],
            'reader': 'ordinary' if not stream['professional'] else 'professional',
            'surah': surah,
            'verses': [verses[0]['verse'], verses[-1]['verse']],
            'heard': ' '.join(reading['text'].split()),
        })
    entries.sort(key=lambda e: e['clip'])
    with open(out_path, 'w', encoding='utf-8') as out:
        out.write('''/**
 * What the app's Whisper model (tiny, fine-tuned on the Quran, GGML q8_0) wrote on 10-second clips
 * of real recitations, with the app's decoding (D45), in whisper.cpp 1.9.3 on a computer: the
 * voice benchmark of `tools/voice-bench`, exported by `export-transcripts.py`. Text only: no audio
 * is in this repository.
 *
 * - `ordinary`: readers of Faraj Elahjal's "Quran Recitation Dataset" (83:1–3, Qalun, phones,
 *   permissive licence), none of them in `ordinary-readers.ts`;
 * - `professional`: six reciters of EveryAyah (personal and educational use; only the text Whisper
 *   wrote is kept here). The model was most likely trained on their recordings.
 *
 * Each clip is clean, with room noise at 10 dB SNR, or through a telephone band; half of them start
 * in the middle of a verse. `verses`: the first and last verse heard, in `surah`.
 */
export interface BenchRecitation {
  readonly clip: string;
  readonly reader: 'ordinary' | 'professional';
  readonly surah: number;
  readonly verses: readonly [number, number];
  readonly heard: string;
}

export const BENCH_RECITATIONS: readonly BenchRecitation[] = ''')
        out.write(json.dumps(entries, ensure_ascii=False, indent=2))
        out.write(';\n')
    print(len(entries), 'clips written to', out_path)


if __name__ == '__main__':
    main()
