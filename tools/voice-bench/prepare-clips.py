#!/usr/bin/env python3
"""Downloads and prepares the recitation clips of the voice benchmark (README.md here).

Nothing it writes may enter the repository: run it with an output directory outside it.

  python3 -I tools/voice-bench/prepare-clips.py <out dir> <faraj file list>

- Ordinary readers: "Quran Recitation Dataset - Surah Al-Mutaffifin 1-3" by Faraj Elahjal
  (github.com/faraj-elahjal/quran-recitation-dataset), its own permissive licence (use, copy,
  modify, publish, distribute). Readers already transcribed in the app's fixtures
  (src/domain/listening/__fixtures__/ordinary-readers.ts) are left out: this set is held out.
- Professional reciters: the per-ayah MP3 corpus of Islamic Network / EveryAyah, as mirrored
  byte for byte in the releases of github.com/MohamedAbulgasem/Taqwa-data. Its terms
  (alquran.cloud terms §IV) allow downloading for personal and educational use, copyright stays
  with the reciters: NOT a permissive licence. Local measurement only, never committed, never
  fetched by CI.

Each prepared stream is 16 kHz mono 16-bit WAV, in these conditions: clean, room noise at
10, 15 and 20 dB SNR (synthetic, generated here), and telephone band (300-3400 Hz, through 8 kHz).

  python3 -I tools/voice-bench/prepare-clips.py <out dir> --conditions-only

writes the noisy conditions again from the clean files already there (nothing downloaded).
"""
import json
import os
import re
import struct
import subprocess
import sys
import urllib.parse
import urllib.request

import numpy as np

SR = 16000
FARAJ_MEDIA = ('https://media.githubusercontent.com/media/faraj-elahjal/'
               'quran-recitation-dataset/main/')
TAQWA = 'https://github.com/MohamedAbulgasem/Taqwa-data/releases/download/audio-{r}-v1/{r}-{s:03d}.taqa'
FIXTURE_READERS = {1, 3, 5, 7, 9, 17, 21, 25, 29, 34, 37, 42, 45, 50, 53, 58, 61, 67, 69, 91,
                   93, 99, 113, 185, 209, 283, 315}

RECITERS = ['ar.alafasy', 'ar.husary', 'ar.minshawi', 'ar.abdulbasitmurattal',
            'ar.abdurrahmaansudais', 'ar.mahermuaiqly']
# (surah, first ayah): short surahs, middles of long ones, and openings of long ones.
PASSAGES = [(1, 1), (112, 1), (113, 1), (114, 1), (103, 1), (108, 1), (97, 1), (87, 1),
            (93, 1), (36, 1), (36, 30), (55, 1), (67, 1), (78, 1), (2, 1), (2, 255),
            (2, 183), (18, 1), (18, 60), (3, 190), (24, 35), (59, 22), (73, 1), (90, 1)]
STREAM_SECONDS = 16.0


def fetch(url, byte_range=None):
    request = urllib.request.Request(url)
    if byte_range is not None:
        request.add_header('Range', 'bytes=%d-%d' % byte_range)
    with urllib.request.urlopen(request, timeout=120) as response:
        return response.read()


def decode(data):
    """Any audio file -> float32 mono 16 kHz, through ffmpeg."""
    out = subprocess.run(
        ['ffmpeg', '-loglevel', 'error', '-i', 'pipe:0', '-ac', '1', '-ar', str(SR),
         '-f', 's16le', 'pipe:1'], input=data, capture_output=True, check=True).stdout
    return np.frombuffer(out, dtype='<i2').astype(np.float32) / 32768.0


def write_wav(path, audio):
    pcm = (np.clip(audio, -1, 1) * 32767).astype('<i2').tobytes()
    with open(path, 'wb') as f:
        f.write(b'RIFF' + struct.pack('<I', 36 + len(pcm)) + b'WAVEfmt ')
        f.write(struct.pack('<IHHIIHH', 16, 1, 1, SR, SR * 2, 2, 16))
        f.write(b'data' + struct.pack('<I', len(pcm)) + pcm)


def speech_rms(audio):
    frames = audio[: len(audio) // 320 * 320].reshape(-1, 320)
    rms = np.sqrt((frames ** 2).mean(axis=1) + 1e-12)
    loud = rms[rms > rms.max() * 0.1]
    return float(np.sqrt((loud ** 2).mean()))


def room_noise(n, rng):
    """Steady room noise: pink noise, a low rumble and a faint mains hum (synthetic)."""
    white = rng.standard_normal(n)
    spectrum = np.fft.rfft(white)
    freqs = np.fft.rfftfreq(n, 1 / SR)
    shape = 1 / np.sqrt(np.maximum(freqs, 20))
    shape *= 1 + 3 * np.exp(-freqs / 120)  # rumble of ventilation, traffic
    shape[freqs > 6000] *= np.exp(-(freqs[freqs > 6000] - 6000) / 2000)
    noise = np.fft.irfft(spectrum * shape, n)
    t = np.arange(n) / SR
    noise /= noise.std()
    noise += 0.15 * (np.sin(2 * np.pi * 50 * t) + 0.5 * np.sin(2 * np.pi * 150 * t))
    return noise / noise.std()


def with_noise(audio, snr_db, rng):
    noise = room_noise(len(audio), rng)
    gain = speech_rms(audio) / (10 ** (snr_db / 20))
    return audio + noise * gain


def telephone(audio):
    out = subprocess.run(
        ['ffmpeg', '-loglevel', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', 'pipe:0',
         '-af', 'highpass=f=300,lowpass=f=3400,aresample=8000,aresample=16000',
         '-f', 'f32le', 'pipe:1'], input=audio.astype('<f4').tobytes(), capture_output=True,
        check=True).stdout
    return np.frombuffer(out, dtype='<f4').copy()


NOISE_SNRS = (10, 15, 20)
CONDITIONS = ('clean', 'phone8k') + tuple('noise%d' % snr for snr in NOISE_SNRS)


def save_noisy(out_dir, stream_id, audio, rng):
    for snr in NOISE_SNRS:
        write_wav(os.path.join(out_dir, 'noise%d' % snr, stream_id + '.wav'),
                  with_noise(audio, snr, rng))


def save_stream(out_dir, stream_id, audio, rng):
    audio = audio / max(1e-6, np.abs(audio).max()) * 0.7 if np.abs(audio).max() > 0.99 else audio
    write_wav(os.path.join(out_dir, 'clean', stream_id + '.wav'), audio)
    save_noisy(out_dir, stream_id, audio, rng)
    write_wav(os.path.join(out_dir, 'phone8k', stream_id + '.wav'), telephone(audio))


def read_wav(path):
    data = open(path, 'rb').read()
    at = data.find(b'data')
    size = struct.unpack('<I', data[at + 4:at + 8])[0]
    return np.frombuffer(data[at + 8:at + 8 + size], dtype='<i2').astype(np.float32) / 32767.0


def conditions_only(out_dir):
    """The noisy conditions again, from the clean streams of the manifest (same seed, same order)."""
    manifest = json.load(open(os.path.join(out_dir, 'manifest.json')))
    rng = np.random.default_rng(20261125)
    for condition in CONDITIONS:
        os.makedirs(os.path.join(out_dir, condition), exist_ok=True)
    for stream in manifest['streams']:
        save_noisy(out_dir, stream['id'],
                   read_wav(os.path.join(out_dir, 'clean', stream['id'] + '.wav')), rng)
    print('noisy conditions written for', len(manifest['streams']), 'streams')


def faraj_streams(out_dir, file_list, rng, count):
    names = [line.strip() for line in open(file_list) if line.strip().endswith('-1.wav')]
    by_reader = sorted((int(re.search(r'/(\d+)-1\.wav$', n).group(1)), n) for n in names)
    held_out = [(r, n) for r, n in by_reader if r not in FIXTURE_READERS]
    step = max(1, len(held_out) // count)
    # Evenly spaced readers first, then the others, until `count` recordings could be read.
    order = held_out[::step] + [item for i, item in enumerate(held_out) if i % step]
    streams = []
    for reader, name in order:
        if len(streams) == count:
            break
        try:
            audio = decode(fetch(FARAJ_MEDIA + urllib.parse.quote(name)))
        except Exception as error:  # a file missing from the dataset's storage
            print('skipped', name, error, flush=True)
            continue
        if len(audio) < 4 * SR:
            print('skipped', name, 'shorter than 4 s', flush=True)
            continue
        stream_id = 'faraj-%d-1' % reader
        save_stream(out_dir, stream_id, audio, rng)
        streams.append({'id': stream_id, 'source': 'faraj', 'reciter': 'reader-%d' % reader,
                        'professional': False, 'seconds': round(len(audio) / SR, 2),
                        # The whole of 83:1-3, read freely: no verse timing is known.
                        'verses': [{'surah': 83, 'verse': v, 'start': None, 'end': None}
                                   for v in (1, 2, 3)]})
        print(stream_id, round(len(audio) / SR, 1), 's', flush=True)
    return streams


def taqwa_stream(reciter, surah, first):
    url = TAQWA.format(r=reciter, s=surah)
    head = fetch(url, (0, 11))
    assert head[:4] == b'TAQA', head[:4]
    index_len = struct.unpack('>I', head[8:12])[0]
    index = json.loads(fetch(url, (12, 11 + index_len)))
    data_start = 12 + index_len
    pieces, verses, at = [], [], 0.0
    for ayah in index['ayahs']:
        if ayah['n'] < first:
            continue
        audio = decode(fetch(url, (data_start + ayah['off'],
                                   data_start + ayah['off'] + ayah['len'] - 1)))
        pieces.append(audio)
        verses.append({'surah': surah, 'verse': ayah['n'], 'start': round(at, 3),
                       'end': round(at + len(audio) / SR, 3)})
        at += len(audio) / SR
        if at >= STREAM_SECONDS:
            break
    return np.concatenate(pieces), verses


def main():
    out_dir, file_list = sys.argv[1], sys.argv[2]
    if os.path.realpath(out_dir).startswith(os.path.realpath(os.path.join(
            os.path.dirname(__file__), '..', '..'))):
        sys.exit('refusing to write audio inside the repository')
    if file_list == '--conditions-only':
        conditions_only(out_dir)
        return
    for condition in CONDITIONS:
        os.makedirs(os.path.join(out_dir, condition), exist_ok=True)
    rng = np.random.default_rng(20261125)
    manifest_path = os.path.join(out_dir, 'manifest.json')
    streams = []
    streams += faraj_streams(out_dir, file_list, rng, int(os.environ.get('FARAJ_COUNT', '30')))
    for i, (surah, first) in enumerate(PASSAGES):
        for k in range(len(RECITERS)):
            if (i + k) % 2:  # every passage by half of the reciters, every reciter on half
                continue
            reciter = RECITERS[k]
            stream_id = '%s-%03d-%03d' % (reciter.split('.')[1], surah, first)
            try:
                audio, verses = taqwa_stream(reciter, surah, first)
            except Exception as error:
                print('skipped', stream_id, error, flush=True)
                continue
            save_stream(out_dir, stream_id, audio, rng)
            streams.append({'id': stream_id, 'source': 'everyayah', 'reciter': reciter,
                            'professional': True, 'seconds': round(len(audio) / SR, 2),
                            'verses': verses})
            print(stream_id, round(len(audio) / SR, 1), 's', flush=True)
    json.dump({'sampleRate': SR, 'streams': streams}, open(manifest_path, 'w'), indent=1,
              ensure_ascii=False)
    print('streams:', len(streams))


if __name__ == '__main__':
    main()
