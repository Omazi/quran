/**
 * The water thread in the margin of a page (validated mockup of 27 November 2026, shots 20 to
 * 22): it fills, from the top of the page to its end, as the page gathers the time it asks (spec
 * 3); a bead of water sits at the end of the fill. Once the time is reached it is full, its bead
 * at the end: the page will count as soon as its last line has been seen. When the page counts,
 * or when the khatma already holds it, the thread stays full, still and pale. Pure.
 */

import { READER_CONFIG } from './config';

export type ThreadState =
  /** Gathering time: the share of the time asked, by hundredths, from 0 (below 1). */
  | { readonly kind: 'filling'; readonly share: number }
  /** The time is reached; the page counts once its last line was seen. */
  | { readonly kind: 'ready' }
  /** The page counted, or the khatma already holds it. */
  | { readonly kind: 'done' };

export interface ThreadInput {
  /** Whether the khatma in progress already holds the page (D8). */
  readonly isRead: boolean;
  /** What the reading session knows of the page; undefined when it was never on screen. */
  readonly progress: { readonly creditedMs: number; readonly counted: boolean } | undefined;
  /** Milliseconds the page asks (spec 3); infinite while its words are not known yet. */
  readonly requiredMs: number;
}

/** The thread moves by hundredths: finer would only draw more often. */
const SHARE_STEPS = 100;
const EMPTY: ThreadState = Object.freeze({ kind: 'filling', share: 0 });
const READY: ThreadState = Object.freeze({ kind: 'ready' });
const DONE: ThreadState = Object.freeze({ kind: 'done' });

export function threadStateOf({ isRead, progress, requiredMs }: ThreadInput): ThreadState {
  if (!(requiredMs > 0)) throw new RangeError(`A page asks a positive time, not ${requiredMs}.`);
  if (progress !== undefined && !(progress.creditedMs >= 0)) {
    throw new RangeError(`A page cannot have gathered ${progress.creditedMs} ms.`);
  }
  if (isRead || progress?.counted === true) return DONE;
  if (progress === undefined || !Number.isFinite(requiredMs)) return EMPTY;
  if (progress.creditedMs >= requiredMs) return READY;
  const share = Math.floor((progress.creditedMs / requiredMs) * SHARE_STEPS) / SHARE_STEPS;
  return share === 0 ? EMPTY : { kind: 'filling', share };
}

/**
 * The share of the thread that is drawn full. With Reduce Motion it moves by a few still steps
 * (accessibility.md › Cognitive; motion.md › Make motion optional), as the water line did.
 */
export function drawnThreadShare(state: ThreadState, isMotionReduced: boolean): number {
  if (state.kind !== 'filling') return 1;
  if (!isMotionReduced) return state.share;
  const steps = READER_CONFIG.thread.reducedMotionSteps;
  return Math.floor(state.share * steps) / steps;
}

export function isSameThreadState(a: ThreadState, b: ThreadState): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind !== 'filling' || (b.kind === 'filling' && a.share === b.share);
}
