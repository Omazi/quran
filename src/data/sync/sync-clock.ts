/**
 * The clock the sync stamps with: the phone's, corrected by how far it is from the server's, as
 * measured at each answer (docs/specs/sync.md, clocks). Before the first answer, the phone's.
 */
export interface SyncClock {
  /** Milliseconds since 1970, corrected. */
  readonly now: () => number;
  /** Notes the server's clock read in an answer just received. */
  readonly observeServer: (serverNow: number) => void;
  /** The correction in use, in milliseconds (positive when the phone is late). */
  readonly offset: () => number;
}

/** Differences smaller than this are the time the answer took, not a wrong clock. */
const NOISE_MS = 2_000;

export function createSyncClock(deviceNow: () => number = Date.now): SyncClock {
  let offset = 0;
  return {
    now: () => deviceNow() + offset,
    observeServer: (serverNow) => {
      if (!Number.isFinite(serverNow)) return;
      const measured = serverNow - deviceNow();
      if (Math.abs(measured - offset) > NOISE_MS) offset = measured;
    },
    offset: () => offset,
  };
}
