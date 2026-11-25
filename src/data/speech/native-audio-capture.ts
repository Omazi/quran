/**
 * The microphone through the app's own native module (`modules/voice-capture`, Swift). The module
 * converts the microphone to 16 kHz mono 16-bit samples and sends them as base64, every
 * `chunkMs`. Nothing is written to disk; nothing leaves the phone.
 */
import type { MicrophonePermission, SpeechEndReason } from '@/domain/listening';

import { decodePcm16Base64 } from './audio-level';
import { SPEECH_ENGINE_CONFIG } from './config';
import type { AudioCapture, AudioListeners } from './whisper-speech-engine';

/** The name the native module registers (`VoiceCaptureModule.swift`). */
export const VOICE_CAPTURE_MODULE_NAME = 'VoiceCapture';

interface Subscription {
  remove(): void;
}

/** What the native module offers. */
export interface NativeVoiceCapture {
  /** `undetermined`, `granted` or `denied`. */
  getPermission(): Promise<string>;
  requestPermission(): Promise<string>;
  start(sampleRate: number, chunkMs: number): Promise<void>;
  stop(): Promise<void>;
  addListener(event: 'onAudio', listener: (event: { pcm: string }) => void): Subscription;
  addListener(event: 'onEnd', listener: (event: { reason: string }) => void): Subscription;
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
      const endWith = (reason: SpeechEndReason) => {
        if (ended) return;
        ended = true;
        release();
        listeners.onEnd(reason);
      };
      subscriptions.push(
        native.addListener('onAudio', ({ pcm }) => listeners.onAudio(decodePcm16Base64(pcm))),
        native.addListener('onEnd', ({ reason }) => endWith(reasonOf(reason))),
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
