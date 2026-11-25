/**
 * CHECK BUILD ONLY. The automatic run writes where it is, one line per step, to a text file in the
 * app's folder. When the app dies the run stops writing, and the last line says where: the check
 * reads the file from the simulator afterwards. Never throws: a log that fails is not a finding.
 */

export interface ProgressSink {
  reset: () => void;
  append: (line: string) => void;
  now: () => number;
}

export function createProgressLog({ reset, append, now }: ProgressSink) {
  return {
    reset: () => {
      try {
        reset();
      } catch {
        // see above
      }
    },
    line: (text: string) => {
      try {
        append(`${new Date(now()).toISOString()} ${text}\n`);
      } catch {
        // see above
      }
    },
  };
}

export type ProgressLog = ReturnType<typeof createProgressLog>;
