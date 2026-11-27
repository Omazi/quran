/**
 * The camera of the 3D garden in motion: what each gesture does to the orbit, and the glides
 * after them (gestures skill: track phase 1:1, release phase physics, interruptible). Plain
 * TypeScript, without React: `useGardenOrbit` connects it to the gestures, and the frames come
 * from an injected scheduler, so that tests drive the clock.
 */

import {
  approachOrbit,
  clampOrbit,
  decayVelocity,
  DEFAULT_ORBIT,
  isOrbitDefault,
  isSpinning,
  orbitAfterDrag,
  orbitAfterPinch,
  radiansPerPoint,
  sameOrbit,
  viewOffset,
  type FrameAnchor,
  type Orbit,
} from './camera-rig';
import { GARDEN_3D } from './config';
import { interpolateOrbit } from './glide';

export interface FrameScheduler {
  readonly now: () => number;
  readonly request: (callback: (time: number) => void) => number;
  readonly cancel: (id: number) => void;
}

/** The screen's frames. */
export const screenFrames: FrameScheduler = {
  now: () => performance.now(),
  request: (callback) => requestAnimationFrame(callback),
  cancel: (id) => cancelAnimationFrame(id),
};

export interface ViewSize {
  readonly width: number;
  readonly height: number;
}

export interface OrbitControllerOptions {
  /** The size of the view, in points. */
  readonly size: () => ViewSize;
  /** The orbit changed: draw a frame. */
  readonly onChange: () => void;
  /** The person turned or zoomed. */
  readonly onUse: () => void;
  /** Reduce Motion: no spin after release, and the view jumps where it would glide. */
  readonly isMotionReduced: () => boolean;
  /** Where the picture's frame rests in a taller view. Bottom if not given. */
  readonly anchor?: () => FrameAnchor;
  /** A finger touched the garden (before anything else happens): a glide in progress stops. */
  readonly onFingerDown?: () => void;
  readonly frames?: FrameScheduler;
}

/** A cubic-bezier curve, for a glide along a set path. */
export interface GlideCurve {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

type Motion =
  | { readonly kind: 'spin'; velocity: number }
  | { readonly kind: 'settle'; readonly target: Orbit }
  | {
      readonly kind: 'tween';
      readonly from: Orbit;
      readonly to: Orbit;
      readonly start: number;
      readonly durationMs: number;
      readonly curve: GlideCurve;
      readonly onDone: () => void;
    };

/** Whether every number of an orbit is a number: a NaN camera would glide, and draw, forever. */
function isFiniteOrbit(orbit: Orbit): boolean {
  return (
    Number.isFinite(orbit.azimuth) &&
    Number.isFinite(orbit.elevation) &&
    Number.isFinite(orbit.zoom) &&
    Number.isFinite(orbit.panX) &&
    Number.isFinite(orbit.panY)
  );
}

function isFinitePoint(point: { x: number; y: number }): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

/** A frame longer than this (the app was in the background) moves no more than this. */
const MAX_FRAME_MS = 64;
const MS_PER_SECOND = 1000;

export class OrbitController {
  /** Where the camera is now. */
  orbit: Orbit = DEFAULT_ORBIT;
  private start: Orbit = DEFAULT_ORBIT;
  private focalStart = { x: 0, y: 0 };
  private motion: Motion | null = null;
  private frame: number | null = null;
  private lastTime = 0;
  /**
   * Set once the view is gone. Gesture events already on their way to JavaScript can still
   * arrive: they then change nothing and schedule no frame.
   */
  private isDisposed = false;
  private readonly frames: FrameScheduler;

  constructor(private readonly options: OrbitControllerOptions) {
    this.frames = options.frames ?? screenFrames;
  }

  private get aspect(): number {
    const { width, height } = this.options.size();
    return height > 0 ? width / height : 1;
  }

  private get anchor(): FrameAnchor {
    return this.options.anchor?.() ?? 'bottom';
  }

  /** The view has an area: points can be turned into metres. */
  private get hasSize(): boolean {
    const { width, height } = this.options.size();
    return width > 0 && height > 0;
  }

  /** Where a point of the view is in metres, or the centre when that cannot be known. */
  private offsetOf(orbit: Orbit, point: { x: number; y: number }): { x: number; y: number } {
    if (!this.hasSize || !isFinitePoint(point)) return { x: 0, y: 0 };
    return viewOffset(orbit, this.aspect, this.options.size(), point, this.anchor);
  }

  private set(orbit: Orbit): void {
    if (this.isDisposed || !isFiniteOrbit(orbit)) return;
    this.orbit = orbit;
    this.options.onChange();
  }

  /** A finger touches the garden: whatever moves stops where it is. */
  touch(): void {
    this.motion = null;
    if (this.frame !== null) this.frames.cancel(this.frame);
    this.frame = null;
  }

  /** A finger comes down on the garden: what moves stops, and a glide in progress is told. */
  fingerDown(): void {
    this.touch();
    this.options.onFingerDown?.();
  }

  dispose(): void {
    this.isDisposed = true;
    this.touch();
  }

  /**
   * Glides to `target` in `durationMs` along `curve` (the return glide of the home garden), then
   * calls `onDone`. A touch stops it where it is, without `onDone`. With Reduce Motion, jumps.
   */
  glideTo(
    target: Orbit,
    durationMs: number,
    curve: GlideCurve,
    onDone: () => void = () => {},
  ): void {
    this.touch();
    if (this.isDisposed || !isFiniteOrbit(target)) return;
    if (this.options.isMotionReduced() || durationMs <= 0) {
      this.set(target);
      onDone();
      return;
    }
    this.animate({
      kind: 'tween',
      from: this.orbit,
      to: target,
      start: this.frames.now(),
      durationMs,
      curve,
      onDone,
    });
  }

  /** Goes back to `target` the way a release does (an approach any touch interrupts). */
  settleTo(target: Orbit): void {
    if (this.isDisposed) return;
    this.goTo(target);
  }

  /** Puts the camera at `target` at once. */
  jumpTo(target: Orbit): void {
    this.touch();
    this.set(target);
  }

  // Drag: turn around the vertical axis, tilt within limits -----------------------------------

  dragStart(): void {
    if (this.isDisposed) return;
    this.touch();
    this.start = this.orbit;
    this.options.onUse();
  }

  dragMove(dx: number, dy: number): void {
    if (!this.hasSize || !Number.isFinite(dx) || !Number.isFinite(dy)) return;
    this.set(
      orbitAfterDrag(this.start, { dx, dy }, this.options.size().width, this.aspect, this.anchor),
    );
  }

  /** `velocityX` in points per second, as the gesture reports it. */
  dragEnd(velocityX: number, isCanceled: boolean): void {
    if (this.isDisposed) return;
    const inside = clampOrbit(this.orbit);
    if (this.options.isMotionReduced() || isCanceled || !this.hasSize) {
      this.goTo(inside);
      return;
    }
    // Seeded with the finger's speed: the garden leaves the finger as fast as it moved.
    const perPoint = radiansPerPoint(
      this.orbit,
      this.options.size().width,
      this.aspect,
      this.anchor,
    );
    const velocity = (-velocityX * perPoint) / MS_PER_SECOND;
    if (Number.isFinite(velocity) && isSpinning(velocity)) this.animate({ kind: 'spin', velocity });
    else this.goTo(inside);
  }

  // Pinch: zoom around the point between the fingers -------------------------------------------

  pinchStart(focal: { x: number; y: number }): void {
    if (this.isDisposed) return;
    this.touch();
    this.start = this.orbit;
    this.focalStart = this.offsetOf(this.orbit, focal);
    this.options.onUse();
  }

  pinchMove(scale: number, focal: { x: number; y: number }): void {
    // A scale of 0 or less has no logarithm: the zoom would become NaN.
    if (!Number.isFinite(scale) || scale <= 0) return;
    const focalNow = this.offsetOf(this.start, focal);
    this.set(orbitAfterPinch(this.start, scale, this.focalStart, focalNow));
  }

  pinchEnd(): void {
    if (this.isDisposed) return;
    this.goTo(clampOrbit(this.orbit));
  }

  // Double tap, VoiceOver ----------------------------------------------------------------------

  /** Zooms in on the default view; brings any other view back to the default. */
  doubleTap(point: { x: number; y: number }): void {
    if (this.isDisposed) return;
    if (!isOrbitDefault(this.orbit)) {
      this.goTo(DEFAULT_ORBIT);
      return;
    }
    const focal = this.offsetOf(DEFAULT_ORBIT, point);
    this.goTo(clampOrbit(orbitAfterPinch(DEFAULT_ORBIT, GARDEN_3D.zoom.doubleTap, focal)));
  }

  /** Turns by `angle` from where the view is going, so that two quick actions add up. */
  turnBy(angle: number): void {
    if (this.isDisposed || !Number.isFinite(angle)) return;
    const from = this.motion?.kind === 'settle' ? this.motion.target : this.orbit;
    this.goTo(clampOrbit({ ...from, azimuth: from.azimuth + angle }));
  }

  reset(): void {
    if (this.isDisposed) return;
    this.goTo(DEFAULT_ORBIT);
  }

  // Glides -------------------------------------------------------------------------------------

  /** Goes to `target`: gliding, or at once with Reduce Motion. */
  private goTo(target: Orbit): void {
    this.touch();
    if (this.isDisposed || !isFiniteOrbit(target)) return;
    if (this.options.isMotionReduced()) {
      this.set(target);
      return;
    }
    this.animate({ kind: 'settle', target });
  }

  private animate(motion: Motion): void {
    if (this.isDisposed) return;
    this.motion = motion;
    if (this.frame === null) {
      this.lastTime = this.frames.now();
      this.frame = this.frames.request(this.tick);
    }
  }

  private readonly tick = (time: number): void => {
    const elapsed = Math.min(MAX_FRAME_MS, Math.max(0, time - this.lastTime));
    this.lastTime = time;
    const motion = this.motion;
    if (motion === null || this.isDisposed) {
      this.frame = null;
      return;
    }
    const before = this.orbit;
    if (motion.kind === 'spin') {
      // The tilt glides back inside its limits while the garden turns on.
      const azimuth = this.orbit.azimuth;
      const settled = approachOrbit(this.orbit, { ...clampOrbit(this.orbit), azimuth }, elapsed);
      this.orbit = { ...settled, azimuth: azimuth + motion.velocity * elapsed };
      motion.velocity = decayVelocity(motion.velocity, elapsed);
      if (!isSpinning(motion.velocity))
        this.motion = { kind: 'settle', target: clampOrbit(this.orbit) };
    } else if (motion.kind === 'tween') {
      const t = Math.min(1, Math.max(0, (time - motion.start) / motion.durationMs));
      this.orbit = interpolateOrbit(motion.from, motion.to, t, motion.curve);
      if (t >= 1) this.motion = null;
    } else {
      this.orbit = approachOrbit(this.orbit, motion.target, elapsed);
      if (sameOrbit(this.orbit, motion.target)) this.motion = null;
    }
    if (!isFiniteOrbit(this.orbit)) {
      // Never draw, nor keep gliding towards, a camera that is not a number.
      this.orbit = before;
      this.motion = null;
      this.frame = null;
      return;
    }
    this.options.onChange();
    this.frame = this.motion === null ? null : this.frames.request(this.tick);
    if (motion.kind === 'tween' && this.motion === null) motion.onDone();
  };
}
