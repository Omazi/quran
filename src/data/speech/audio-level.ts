/**
 * How loud a piece of audio is, and whether it holds a voice: the level drawn by the screens and
 * the gate that keeps silence away from Whisper. 16-bit samples, any length.
 */
import { SPEECH_ENGINE_CONFIG } from './config';

export interface Loudness {
  /** RMS in dB of full scale; −Infinity for digital silence. */
  readonly db: number;
  /** The same, from 0 to 1, as the `SpeechEngine` gives it to the screens. */
  readonly level: number;
}

const FULL_SCALE = 32768;

/**
 * The loudness of an RMS value given as a share of full scale (0 to 1), as the native module
 * measures it: the same scale as `chunkLoudness`, so both levels look alike on screen.
 */
export function loudnessOfRms(rms: number): Loudness {
  if (!(rms > 0)) return { db: -Infinity, level: 0 };
  const db = 20 * Math.log10(Math.min(1, rms));
  const { levelFloorDb, levelCeilingDb } = SPEECH_ENGINE_CONFIG;
  const share = (db - levelFloorDb) / (levelCeilingDb - levelFloorDb);
  return { db, level: Math.min(1, Math.max(0, share)) };
}

export function chunkLoudness(samples: Int16Array): Loudness {
  if (samples.length === 0) return { db: -Infinity, level: 0 };
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return loudnessOfRms(Math.sqrt(sum / samples.length) / FULL_SCALE);
}

export interface VoiceActivity {
  /** Whether this chunk holds a voice. Each call also teaches it the noise of the room. */
  isSpeech(samples: Int16Array): boolean;
}

/**
 * A voice is a sound clearly louder than the room. The room's noise is followed as it is heard:
 * a quieter chunk lowers the estimate at once, a louder one raises it slowly, so a voice does not
 * become "the room" while a steady noise (a fan, a car) does.
 */
export function createVoiceActivity(): VoiceActivity {
  const { minSpeechDb, speechAboveRoomDb, initialRoomDb, roomRiseShare } = SPEECH_ENGINE_CONFIG;
  let roomDb: number = initialRoomDb;
  return {
    isSpeech(samples) {
      const { db } = chunkLoudness(samples);
      if (!Number.isFinite(db)) return false;
      const speech = db >= minSpeechDb && db >= roomDb + speechAboveRoomDb;
      roomDb = db < roomDb ? db : roomDb + (db - roomDb) * roomRiseShare;
      return speech;
    },
  };
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_VALUES = new Int16Array(128).fill(-1);
for (let i = 0; i < BASE64.length; i += 1) BASE64_VALUES[BASE64.charCodeAt(i)] = i;

/** Decodes base64 into bytes, without relying on `atob` or `Buffer` being there. */
function base64Bytes(text: string): Uint8Array {
  const clean = text.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let length = 0;
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < clean.length; i += 1) {
    buffer = (buffer << 6) | BASE64_VALUES[clean.charCodeAt(i)]!;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[length++] = (buffer >> bits) & 0xff;
    }
  }
  return bytes.subarray(0, length);
}

/** The 16-bit little-endian samples the native capture sends as base64. */
export function decodePcm16Base64(text: string): Int16Array {
  const bytes = base64Bytes(text);
  const count = Math.floor(bytes.length / 2);
  const samples = new Int16Array(count);
  for (let i = 0; i < count; i += 1) {
    const value = bytes[2 * i]! | (bytes[2 * i + 1]! << 8);
    samples[i] = value >= 0x8000 ? value - 0x10000 : value;
  }
  return samples;
}
