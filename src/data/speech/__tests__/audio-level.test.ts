import { chunkLoudness, createVoiceActivity, decodePcm16Base64 } from '../audio-level';
import { SPEECH_ENGINE_CONFIG } from '../config';
import { bytesToBase64 } from '../test-support/base64';

/** A chunk of a sine wave at `amplitude` (0 to 1 of full scale), `ms` long at 16 kHz. */
function tone(amplitude: number, ms = 100): Int16Array {
  const count = (16000 * ms) / 1000;
  const samples = new Int16Array(count);
  for (let i = 0; i < count; i += 1) {
    samples[i] = Math.round(Math.sin((2 * Math.PI * 220 * i) / 16000) * amplitude * 32767);
  }
  return samples;
}

describe('chunkLoudness', () => {
  it('gives the RMS level in dB of full scale', () => {
    // A sine at full scale has an RMS of 1/√2: −3 dB.
    expect(chunkLoudness(tone(1)).db).toBeCloseTo(-3, 0);
    expect(chunkLoudness(tone(0.1)).db).toBeCloseTo(-23, 0);
  });

  it('is silence for an empty or all-zero chunk', () => {
    expect(chunkLoudness(new Int16Array(0)).level).toBe(0);
    expect(chunkLoudness(new Int16Array(1600)).level).toBe(0);
    expect(chunkLoudness(new Int16Array(1600)).db).toBe(-Infinity);
  });

  it('maps the voice to a level between 0 and 1 for the screen', () => {
    const { levelFloorDb, levelCeilingDb } = SPEECH_ENGINE_CONFIG;
    expect(chunkLoudness(tone(1)).level).toBe(1);
    expect(chunkLoudness(tone(10 ** ((levelFloorDb - 1) / 20))).level).toBe(0);
    const middle = 10 ** (((levelFloorDb + levelCeilingDb) / 2 + 3) / 20);
    expect(chunkLoudness(tone(middle)).level).toBeCloseTo(0.5, 1);
  });
});

describe('createVoiceActivity', () => {
  it('hears a voice well above the room, not the room itself', () => {
    const activity = createVoiceActivity();
    for (let i = 0; i < 20; i += 1) expect(activity.isSpeech(tone(0.002))).toBe(false);
    expect(activity.isSpeech(tone(0.1))).toBe(true);
  });

  it('never calls a sound speech below the absolute minimum, however quiet the room', () => {
    const activity = createVoiceActivity();
    for (let i = 0; i < 50; i += 1) activity.isSpeech(new Int16Array(1600));
    const belowMinimum = 10 ** ((SPEECH_ENGINE_CONFIG.minSpeechDb - 3) / 20);
    expect(activity.isSpeech(tone(belowMinimum))).toBe(false);
  });

  it('follows a noisy room: a steady noise stops counting as speech', () => {
    const activity = createVoiceActivity();
    const noise = tone(0.03);
    let lastAnswer = true;
    for (let i = 0; i < 600; i += 1) lastAnswer = activity.isSpeech(noise);
    expect(lastAnswer).toBe(false);
    expect(activity.isSpeech(tone(0.3))).toBe(true);
  });
});

describe('decodePcm16Base64', () => {
  it('reads little-endian 16-bit samples', () => {
    // 0x0001, 0xFFFF (−1), 0x7FFF (32767)
    const base64 = bytesToBase64([0x01, 0x00, 0xff, 0xff, 0xff, 0x7f]);
    expect(Array.from(decodePcm16Base64(base64))).toEqual([1, -1, 32767]);
  });

  it('ignores a trailing odd byte and an empty text', () => {
    expect(Array.from(decodePcm16Base64(bytesToBase64([1, 0, 9])))).toEqual([1]);
    expect(decodePcm16Base64('')).toHaveLength(0);
  });
});
