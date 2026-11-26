/**
 * CHECK BUILD ONLY (loaded through `door.ts`; a published bundle does not contain it). Asked with
 * `-screenCheckVoiceProof 1`: plays every recording the iOS check put in the app's
 * `Documents/voice-proof` folder to the real speech engine (`createFileSpeechEngine`) and the real
 * passage search, and writes what came out to `Documents/voice-proof.txt`, one line per clip, then
 * `voice-proof: DONE`. The check copies that file into its report (tools/ci/crash-report.py).
 */
import { Directory, File, Paths } from 'expo-file-system';
import { useEffect } from 'react';

import { createFileSpeechEngine } from '@/data/speech';
import { loadQuranVerseIndex } from '@/features/listening';

import { createProgressLog } from './progress-log';
import { proofClipOf, runVoiceProof, type ProofClip } from './voice-proof-run';

export const VOICE_PROOF_FOLDER = 'voice-proof';
export const VOICE_PROOF_REPORT = 'voice-proof.txt';

const reportFile = () => new File(Paths.document, VOICE_PROOF_REPORT);
const report = createProgressLog({
  reset: () => {
    const file = reportFile();
    if (file.exists) file.delete();
    file.create();
  },
  append: (line) => reportFile().writeSync(line, { append: true }),
  now: Date.now,
});

function proofClips(): ProofClip[] {
  const folder = new Directory(Paths.document, VOICE_PROOF_FOLDER);
  if (!folder.exists) return [];
  return folder
    .list()
    .flatMap((entry) => (entry instanceof File ? [proofClipOf(entry.name, entry.uri)] : []))
    .filter((clip): clip is ProofClip => clip !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Mounted once at the root of the check build when asked; draws nothing. */
export function ScreenCheckVoiceProof() {
  useEffect(() => {
    report.reset();
    void runVoiceProof({
      clips: proofClips(),
      loadIndex: loadQuranVerseIndex,
      createEngine: (clip, onReading) => createFileSpeechEngine(clip.path, { onReading }),
      now: Date.now,
      log: report.line,
    }).catch((error: unknown) => {
      report.line(`voice-proof: FAILED ${error instanceof Error ? error.message : String(error)}`);
    });
  }, []);
  return null;
}
