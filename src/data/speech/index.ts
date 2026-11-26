/**
 * The speech engine on the phone (docs/DECISIONS.md, D5 and D42): an implementation of the
 * domain's `SpeechEngine` with the app's native microphone module and Whisper.
 */
export {
  createDeviceSpeechEngine,
  createFileSpeechEngine,
  type DeviceSpeechEngineOptions,
  type FileSpeechEngineOptions,
} from './device-speech-engine';
export { SPEECH_ENGINE_CONFIG, type SpeechEngineMode } from './config';
export { VOICE_MODEL, type VoiceModel } from './voice-model';
export { voiceDiagnostics, type VoiceDiagnostics, type VoiceDiagnosticsStore } from './diagnostics';
export { findVoiceCapture, readNativeDiagnostics } from './device-speech-engine';
