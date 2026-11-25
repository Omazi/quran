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
  readonly frames?: FrameScheduler;
}

type Motion =
  { readonly kind: 'spin'; velocity: number } | { readonly kind: 'settle'; readonly target: Orbit };

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

  private set(orbit: Orbit): void {
    this.orbit = orbit;
    this.options.onChange();
  }

  /** A finger touches the garden: whatever moves stops where it is. */
  touch(): void {
    this.motion = null;
    if (this.frame !== null) this.frames.cancel(this.frame);
    this.frame = null;
  }

  dispose(): void {
    this.touch();
  }

  // Drag: turn around the vertical axis, tilt within limits -----------------------------------

  dragStart(): void {
    this.touch();
    this.start = this.orbit;
    this.options.onUse();
  }

  dragMove(dx: number, dy: number): void {
    this.set(
      orbitAfterDrag(this.start, { dx, dy }, this.options.size().width, this.aspect, this.anchor),
    );
  }

  /** `velocityX` in points per second, as the gesture reports it. */
  dragEnd(velocityX: number, isCanceled: boolean): void {
    const inside = clampOrbit(this.orbit);
    if (this.options.isMotionReduced() || isCanceled) {
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
    if (isSpinning(velocity)) this.animate({ kind: 'spin', velocity });
    else this.goTo(inside);
  }

  // Pinch: zoom around the point between the fingers -------------------------------------------

  pinchStart(focal: { x: number; y: number }): void {
    this.touch();
    this.start = this.orbit;
    this.focalStart = viewOffset(this.orbit, this.aspect, this.options.size(), focal, this.anchor);
    this.options.onUse();
  }

  pinchMove(scale: number, focal: { x: number; y: number }): void {
    const focalNow = viewOffset(this.start, this.aspect, this.options.size(), focal, this.anchor);
    this.set(orbitAfterPinch(this.start, scale, this.focalStart, focalNow));
  }

  pinchEnd(): void {
    this.goTo(clampOrbit(this.orbit));
  }

  // Double tap, VoiceOver ----------------------------------------------------------------------

  /** Zooms in on the default view; brings any other view back to the default. */
  doubleTap(point: { x: number; y: number }): void {
    if (!isOrbitDefault(this.orbit)) {
      this.goTo(DEFAULT_ORBIT);
      return;
    }
    const focal = viewOffset(DEFAULT_ORBIT, this.aspect, this.options.size(), point, this.anchor);
    this.goTo(clampOrbit(orbitAfterPinch(DEFAULT_ORBIT, GARDEN_3D.zoom.doubleTap, focal)));
  }

  /** Turns by `angle` from where the view is going, so that two quick actions add up. */
  turnBy(angle: number): void {
    const from = this.motion?.kind === 'settle' ? this.motion.target : this.orbit;
    this.goTo(clampOrbit({ ...from, azimuth: from.azimuth + angle }));
  }

  reset(): void {
    this.goTo(DEFAULT_ORBIT);
  }

  // Glides -------------------------------------------------------------------------------------

  /** Goes to `target`: gliding, or at once with Reduce Motion. */
  private goTo(target: Orbit): void {
    this.touch();
    if (this.options.isMotionReduced()) {
      this.set(target);
      return;
    }
    this.animate({ kind: 'settle', target });
  }

  private animate(motion: Motion): void {
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
    if (motion === null) {
      this.frame = null;
      return;
    }
    if (motion.kind === 'spin') {
      // The tilt glides back inside its limits while the garden turns on.
      const azimuth = this.orbit.azimuth;
      const settled = approachOrbit(this.orbit, { ...clampOrbit(this.orbit), azimuth }, elapsed);
      this.orbit = { ...settled, azimuth: azimuth + motion.velocity * elapsed };
      motion.velocity = decayVelocity(motion.velocity, elapsed);
      if (!isSpinning(motion.velocity))
        this.motion = { kind: 'settle', target: clampOrbit(this.orbit) };
    } else {
      this.orbit = approachOrbit(this.orbit, motion.target, elapsed);
      if (sameOrbit(this.orbit, motion.target)) this.motion = null;
    }
    this.options.onChange();
    this.frame = this.motion === null ? null : this.frames.request(this.tick);
  };
}
