/**
 * The microphone through the app's own native module (`modules/voice-capture`, Swift). The module
 * converts the microphone to 16 kHz mono 16-bit samples and sends them as base64, every
 * `chunkMs`, and the level of the microphone about 25 times a second. Nothing is written to disk;
 * nothing leaves the phone.
 */
import type { MicrophonePermission, SpeechEndReason } from '@/domain/listening';

import { decodePcm16Base64, loudnessOfRms } from './audio-level';
import { SPEECH_ENGINE_CONFIG } from './config';
import type { AudioCapture, AudioListeners } from './whisper-speech-engine';

/** The name the native module registers (`VoiceCaptureModule.swift`). */
export const VOICE_CAPTURE_MODULE_NAME = 'VoiceCapture';

interface Subscription {
  remove(): void;
}

/** What the native module says of itself, for the diagnostics. */
export type NativeVoiceDiagnostics = Record<string, string | number | boolean>;

/** What the native module offers. */
export interface NativeVoiceCapture {
  /** `undetermined`, `granted` or `denied`. */
  getPermission(): Promise<string>;
  requestPermission(): Promise<string>;
  start(sampleRate: number, chunkMs: number): Promise<void>;
  /**
   * CHECK BUILD ONLY (`createFileSpeechEngine`): reads a WAV file of the app's `voice-proof`
   * folder instead of the microphone, through the same converter, chunks and events, in real
   * time, then sends silence. Absent from a build made before it existed.
   */
  startFile?(path: string, sampleRate: number, chunkMs: number): Promise<void>;
  stop(): Promise<void>;
  /**
   * Whether `modelFile` is in the app and its size, the microphone's format and counters. Absent
   * from a build made before it existed.
   */
  getDiagnostics?(modelFile: string): Promise<NativeVoiceDiagnostics>;
  addListener(event: 'onAudio', listener: (event: { pcm: string }) => void): Subscription;
  addListener(
    event: 'onLevel',
    listener: (event: { rms: number; peak: number }) => void,
  ): Subscription;
  addListener(
    event: 'onEnd',
    listener: (event: { reason: string; message?: string }) => void,
  ): Subscription;
}

/** The part of React Native's `AppState` this file needs. */
export interface AppStateLike {
  addEventListener(type: 'change', listener: (state: string) => void): Subscription;
}

function permissionOf(answer: string): MicrophonePermission {
  return answer === 'granted' || answer === 'denied' ? answer : 'undetermined';
}

function reasonOf(reason: string): SpeechEndReason {
  return reason === 'interrupted' || reason === 'finished' ? reason : 'failed';
}

export function createNativeAudioCapture(
  native: NativeVoiceCapture,
  appState?: AppStateLike,
): AudioCapture {
  let subscriptions: Subscription[] = [];

  function release(): void {
    for (const subscription of subscriptions) subscription.remove();
    subscriptions = [];
  }

  return {
    getPermission: async () => permissionOf(await native.getPermission()),
    requestPermission: async () => permissionOf(await native.requestPermission()),
    async start(listeners: AudioListeners) {
      release();
      let ended = false;
      const endWith = (reason: SpeechEndReason, message?: string) => {
        if (ended) return;
        ended = true;
        release();
        listeners.onEnd(reason, message);
      };
      subscriptions.push(
        native.addListener('onAudio', ({ pcm }) => listeners.onAudio(decodePcm16Base64(pcm))),
        native.addListener('onLevel', ({ rms }) => listeners.onLevel?.(loudnessOfRms(rms).level)),
        native.addListener('onEnd', ({ reason, message }) => endWith(reasonOf(reason), message)),
      );
      if (appState !== undefined) {
        // The module stops by itself in the background too; this is the same rule, said twice.
        subscriptions.push(
          appState.addEventListener('change', (state) => {
            if (state !== 'background') return;
            void native.stop().catch(() => undefined);
            endWith('interrupted');
          }),
        );
      }
      try {
        await native.start(SPEECH_ENGINE_CONFIG.sampleRate, SPEECH_ENGINE_CONFIG.chunkMs);
      } catch (error) {
        release();
        throw error;
      }
    },
    async stop() {
      release();
      await native.stop();
    },
  };
}
