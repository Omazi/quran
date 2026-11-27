/**
 * The light of the home garden follows the phone in the hand (maquette-wow: « La lumière et les
 * ombres suivent le téléphone »; owner's decision of 27 November 2026). Pure: gravity samples in,
 * a smoothed tilt from -1 to 1 on each axis out.
 *
 * The tilt is measured from the way the phone is held, which the filter learns slowly: holding it
 * still, at any angle, shows no shift; turning it shifts the light, which drifts back to rest when
 * the phone stays in its new position. Gravity, not the attitude angles, so that every platform
 * gives the same unit (expo-sensors reports no rotation on the web).
 */

export const TILT = {
  /** How much a change of gravity (a share of g) moves the light: a quarter turn is far past it. */
  gain: 2.4,
  /** The rest follows the hand in a few seconds (time constant, ms). */
  restMs: 3000,
  /** The light follows the tilt smoothly (time constant, ms): no jitter from the sensor. */
  smoothMs: 160,
  limit: 1,
  /** Samples asked of the sensor: at most 30 a second. */
  sampleMs: 33,
} as const;

export interface Tilt {
  readonly x: number;
  readonly y: number;
}

export interface TiltState {
  /** The way the phone is held, learnt slowly; null before the first sample. */
  readonly baseline: Tilt | null;
  /** The light's shift, -1 to 1 on each axis. */
  readonly tilt: Tilt;
}

export const RESTING_TILT: TiltState = { baseline: null, tilt: { x: 0, y: 0 } };

const STANDARD_GRAVITY = 9.80665;

/** Gravity in m/s² as shares of g (left-right, top-bottom of the screen); 0 when it says nothing. */
export function gravityTilt(gravity: { x: number; y: number; z: number }): Tilt {
  const { x, y, z } = gravity;
  const length = Math.hypot(x, y, z);
  if (!Number.isFinite(length) || length < STANDARD_GRAVITY * 0.1) return { x: 0, y: 0 };
  return { x: x / length, y: y / length };
}

function clamp(value: number): number {
  return Math.min(TILT.limit, Math.max(-TILT.limit, value));
}

function approach(from: number, to: number, dtMs: number, tauMs: number): number {
  return to + (from - to) * Math.exp(-dtMs / tauMs);
}

/** One frame of the filter, `dtMs` after the last: `raw` is the latest sample, or null for none. */
export function nextTilt(state: TiltState, raw: Tilt | null, dtMs: number): TiltState {
  const isUsable = raw !== null && Number.isFinite(raw.x) && Number.isFinite(raw.y);
  if (!isUsable) {
    return {
      baseline: state.baseline,
      tilt: {
        x: approach(state.tilt.x, 0, dtMs, TILT.smoothMs),
        y: approach(state.tilt.y, 0, dtMs, TILT.smoothMs),
      },
    };
  }
  const previous = state.baseline ?? raw;
  const baseline = {
    x: approach(previous.x, raw.x, dtMs, TILT.restMs),
    y: approach(previous.y, raw.y, dtMs, TILT.restMs),
  };
  const target = {
    x: clamp((raw.x - baseline.x) * TILT.gain),
    y: clamp((raw.y - baseline.y) * TILT.gain),
  };
  return {
    baseline,
    tilt: {
      x: approach(state.tilt.x, target.x, dtMs, TILT.smoothMs),
      y: approach(state.tilt.y, target.y, dtMs, TILT.smoothMs),
    },
  };
}
