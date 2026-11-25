# voice-capture

Local Expo module (iOS only), the native side of the app's speech engine (`docs/DECISIONS.md`,
D42). The JavaScript side is `src/data/speech`.

- `ios/VoiceCaptureModule.swift`: the microphone. AVAudioEngine, converted to 16 kHz mono, sent
  to JavaScript as 16-bit samples in base64, one event every 100 ms (`onAudio`), and the level
  (`onLevel`: RMS and peak as a share of full scale, 25 times a second). It stops by itself
  (event `onEnd`, with a `message`) on an interruption (call, Siri, another app), a reset of the
  media services, a conversion that keeps failing, and when the app goes to the background. A
  change of audio route (AirPods, a cable) restarts the engine with the new format, three times
  at most. `getDiagnostics(file)` says whether the model file is in the app and its size, the
  audio session, the input and the counters of the last recording. Nothing is written to disk.
- `app.plugin.js`: config plugin. During `npx expo prebuild` it downloads the Whisper model named
  in `voice-model.json`, checks its size and SHA-256, places it, checks the copy again, prints
  `voice model ok: <bytes> <sha256>`, and makes sure the Xcode project copies it into the app.
  The build stops if anything is wrong. See `docs/BUILD.md`, « Le modèle de la voix ».
- `voice-model.json`: which model, where to download it, its SHA-256 and its licence.
- `MODEL-LICENSE.txt`: the Apache License 2.0, under which the model is distributed.

Whisper itself is whisper.rn (MIT), an npm dependency, not this module.

**Not compiled here**: written against the Expo Modules API of SDK 58 and AVFoundation, without a
Mac. The first proof is the iOS build on GitHub's Macs (`ios-check.yml` or the TestFlight build),
then the iPhone.
