/**
 * The moment a page counts (validated mockup of 27 November 2026, shots 21 and 22): the glass pill
 * shows, still with the old count; a single drop forms at the end of the page's thread and falls
 * into the pill's ring; the pill then says what grew, with the new count, and leaves after a few
 * seconds. With Reduce Motion there is no drop: the pill says at once what was received (the
 * mockup's README, "Accessibilité et mouvement").
 *
 * A pure state machine, and the pure path of the drop: the screen drives both with its clock.
 */

import { READER_CONFIG } from './config';
import type { ReadingFeedback } from './reading-feedback';

export type DropMoment =
  /** Nothing to show; the id of the last moment, so that ids never repeat. */
  | { readonly phase: 'idle'; readonly lastId: number }
  /** The drop is falling; the pill shows the count before the page. */
  | { readonly phase: 'falling'; readonly feedback: ReadingFeedback; readonly id: number }
  /** The drop landed; the pill shows what grew. */
  | { readonly phase: 'received'; readonly feedback: ReadingFeedback; readonly id: number };

export type DropMomentEvent =
  | {
      readonly type: 'counted';
      readonly feedback: ReadingFeedback;
      readonly isMotionReduced: boolean;
    }
  | { readonly type: 'landed'; readonly id: number }
  | { readonly type: 'expired'; readonly id: number };

export const IDLE_MOMENT: DropMoment = Object.freeze({ phase: 'idle', lastId: 0 });

export function advanceDropMoment(moment: DropMoment, event: DropMomentEvent): DropMoment {
  switch (event.type) {
    case 'counted': {
      if (moment.phase === 'falling') {
        // One drop carries every page that counts while it falls: the pill goes from the count
        // it showed first to the last one.
        return { ...moment, feedback: carried(moment.feedback, event.feedback) };
      }
      const id = (moment.phase === 'idle' ? moment.lastId : moment.id) + 1;
      return {
        phase: event.isMotionReduced ? 'received' : 'falling',
        feedback: event.feedback,
        id,
      };
    }
    case 'landed':
      return moment.phase === 'falling' && moment.id === event.id
        ? { phase: 'received', feedback: moment.feedback, id: moment.id }
        : moment;
    case 'expired':
      return moment.phase === 'received' && moment.id === event.id
        ? { phase: 'idle', lastId: moment.id }
        : moment;
  }
}

/** The later feedback, counted from where the earlier one started. */
function carried(first: ReadingFeedback, next: ReadingFeedback): ReadingFeedback {
  const sameHizb =
    first.growth !== null && next.growth !== null && first.growth.hizb === next.growth.hizb;
  return {
    ...next,
    growth:
      sameHizb && first.growth !== null && next.growth !== null
        ? { ...next.growth, pagesBefore: first.growth.pagesBefore }
        : next.growth,
    todayBefore: first.todayBefore,
  };
}

export interface DropTimings {
  readonly formMs: number;
  readonly holdMs: number;
  readonly fallMs: number;
  readonly totalMs: number;
}

/** How long the drop forms, waits and falls, for a fall from `fromY` to `toY` (in points). */
export function dropTimings(fromY: number, toY: number): DropTimings {
  const { formMs, holdMs, fallBaseMs, fallMsPerPoint, fallExtraMaxMs } = READER_CONFIG.drop;
  const fallMs = fallBaseMs + Math.min(fallExtraMaxMs, Math.abs(toY - fromY) * fallMsPerPoint);
  return { formMs, holdMs, fallMs, totalMs: formMs + holdMs + fallMs };
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Where the drop is, and how it is stretched, at a moment of its life. */
export interface DropFrame {
  readonly x: number;
  readonly y: number;
  readonly scaleX: number;
  readonly scaleY: number;
}

/** A frame lasts this long at 60 frames a second: the drop stretches with its speed per frame. */
const FRAME_MS = 1000 / 60;
/** Where the drop starts and how far it swells as it forms (the mockup's `drop()`). */
const FORM_FROM_SCALE = 0.2;
const FORM_SWELL_X = 0.8;
const FORM_SWELL_Y = 0.85;
const FORM_SAG_POINTS = 6;

/** The overshooting curve the drop forms with, cubic-bezier(0.34, 1.56, 0.64, 1), as y of x. */
function overshoot(t: number): number {
  'worklet';
  // Newton's method on the bezier's x, then its y; enough for a 380 ms swell.
  const x1 = 0.34;
  const y1 = 1.56;
  const x2 = 0.64;
  const y2 = 1;
  let u = t;
  for (let step = 0; step < 6; step += 1) {
    const x = 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u - t;
    const dx = 3 * (1 - u) * (1 - u) * x1 + 6 * (1 - u) * u * (x2 - x1) + 3 * u * u * (1 - x2);
    if (Math.abs(dx) < 1e-6) break;
    u = Math.min(1, Math.max(0, u - x / dx));
  }
  return 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u * u * u;
}

/**
 * The drop `elapsedMs` after it started forming at `from` (the end of the thread) on its way to
 * `to` (the pill's ring): it swells with an overshoot, waits, then falls, drawn sideways with an
 * ease-in-out and down with gravity (up with an ease-out when the pill is above), stretching with
 * its speed. A worklet: the screen draws it on the UI thread.
 */
export function dropFrame(
  elapsedMs: number,
  timings: DropTimings,
  from: Point,
  to: Point,
): DropFrame {
  'worklet';
  const { maxStretch, stretchPerPointPerFrame } = READER_CONFIG.drop;
  if (elapsedMs < timings.formMs) {
    const swell = overshoot(Math.max(0, elapsedMs) / timings.formMs);
    return {
      x: from.x,
      y: from.y + swell * FORM_SAG_POINTS * (elapsedMs > 0 ? 1 : 0),
      scaleX: FORM_FROM_SCALE + FORM_SWELL_X * swell,
      scaleY: FORM_FROM_SCALE + FORM_SWELL_Y * swell,
    };
  }
  const start = { x: from.x, y: from.y + FORM_SAG_POINTS };
  const fallStart = timings.formMs + timings.holdMs;
  if (elapsedMs <= fallStart) return { x: start.x, y: start.y, scaleX: 1, scaleY: 1 };
  const k = Math.min(1, (elapsedMs - fallStart) / timings.fallMs);
  const isFalling = to.y >= start.y;
  // Down: free fall (k²). Up, to a pill at the top: drawn like a bead, fast then slow.
  const along = isFalling ? k * k : 1 - (1 - k) * (1 - k);
  const sideways = 0.5 - Math.cos(Math.PI * k) / 2;
  const speedPerFrame =
    (Math.abs(to.y - start.y) * (isFalling ? 2 * k : 2 * (1 - k)) * FRAME_MS) / timings.fallMs;
  const stretch = 1 + Math.min(maxStretch, speedPerFrame * stretchPerPointPerFrame);
  return {
    x: start.x + (to.x - start.x) * sideways,
    y: start.y + (to.y - start.y) * along,
    scaleX: 1 / Math.sqrt(stretch),
    scaleY: stretch,
  };
}
