/** What the person gets after asking to share: done, not possible here, or a failure to report. */
export type ShareOutcome =
  | { readonly status: 'shared' }
  | { readonly status: 'unavailable' }
  | { readonly status: 'failed'; readonly error: unknown };

/** The three native steps of sharing a picture, injected so that the order can be tested. */
export interface ShareFlowDependencies {
  /** Whether the system can open a share sheet at all (expo-sharing). */
  readonly isAvailable: () => Promise<boolean>;
  /** Draws the card and writes it as a PNG in the cache; resolves with its file URI. */
  readonly capture: () => Promise<string>;
  /** Opens the system share sheet on the file; resolves when it is dismissed. */
  readonly share: (uri: string) => Promise<void>;
  /** Deletes the file: the picture may carry a name, it does not stay on the phone. */
  readonly release: (uri: string) => void;
}

/**
 * Draws the card, then hands the file to the system share sheet. No network: the picture is made
 * on the phone and written to the cache. Never throws: every failure comes back as an outcome the
 * screen can tell in words. The file is deleted whatever happens after it was written.
 */
export async function shareCardImage(deps: ShareFlowDependencies): Promise<ShareOutcome> {
  try {
    if (!(await deps.isAvailable())) return { status: 'unavailable' };
    const uri = await deps.capture();
    try {
      await deps.share(uri);
      return { status: 'shared' };
    } finally {
      try {
        deps.release(uri);
      } catch {
        // A file that is already gone costs nothing: the cache is emptied by the system anyway.
      }
    }
  } catch (error) {
    return { status: 'failed', error };
  }
}

/**
 * How many points make one design unit of the card (`shareCardShape`): the inverse of the screen's
 * density. The card is laid out in points and captured at the screen's own scale, so one unit is
 * exactly one pixel of the picture, 1080 × 1350 on a 2x or 3x screen, with no resizing of a bitmap.
 */
export function cardUnit(pixelRatio: number): number {
  if (!(pixelRatio > 0) || !Number.isFinite(pixelRatio)) {
    throw new RangeError(`cardUnit: the pixel ratio must be a positive number, got ${pixelRatio}`);
  }
  return 1 / pixelRatio;
}
