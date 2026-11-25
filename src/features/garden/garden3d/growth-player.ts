/**
 * Plays a growth in the render loop (owner, 25 November 2026: "the change must appear little by
 * little, and it must be animated"): each frame says which element grows and how far, nothing
 * goes through React. Frames come from an injected scheduler, so that tests drive the clock, as
 * for the camera (`OrbitController`).
 */

import { growthDurationMs, growthTween, type GrowthSegment } from '../growth-motion';
import { screenFrames, type FrameScheduler } from './orbit-controller';

/** The element growing on screen and its growth. */
export interface ShownGrowthFrame {
  readonly hizb: number;
  readonly growth: number;
}

export interface GrowthPlayerOptions {
  /** Each frame of the growth. */
  readonly onFrame: (shown: ShownGrowthFrame) => void;
  /** The growth has reached its end. */
  readonly onDone?: () => void;
  readonly frames?: FrameScheduler;
}

/** Two segments (a plant ends, the next starts) never take longer than this together. */
export const MAX_PLAY_MS = 3200;

/** How long each segment takes: its own duration, all shortened together past `MAX_PLAY_MS`. */
export function segmentDurations(segments: readonly GrowthSegment[]): number[] {
  const wanted = segments.map((segment) => growthDurationMs(segment.from, segment.to));
  const total = wanted.reduce((sum, ms) => sum + ms, 0);
  const scale = total > MAX_PLAY_MS ? MAX_PLAY_MS / total : 1;
  return wanted.map((ms) => Math.round(ms * scale));
}

/** The frame `elapsed` milliseconds into `segments`, and whether they are over. */
export function frameAt(
  segments: readonly GrowthSegment[],
  durations: readonly number[],
  elapsed: number,
): { frame: ShownGrowthFrame | null; isOver: boolean } {
  let start = 0;
  for (let k = 0; k < segments.length; k += 1) {
    const segment = segments[k] as GrowthSegment;
    const duration = durations[k] ?? 0;
    if (elapsed < start + duration) {
      const t = duration > 0 ? (elapsed - start) / duration : 1;
      return {
        frame: { hizb: segment.hizb, growth: growthTween(segment.from, segment.to, t) },
        isOver: false,
      };
    }
    start += duration;
  }
  const last = segments[segments.length - 1];
  return { frame: last === undefined ? null : { hizb: last.hizb, growth: last.to }, isOver: true };
}

export class GrowthPlayer {
  private segments: readonly GrowthSegment[] = [];
  private durations: number[] = [];
  private startTime = 0;
  private frame: number | null = null;
  private readonly frames: FrameScheduler;

  constructor(private readonly options: GrowthPlayerOptions) {
    this.frames = options.frames ?? screenFrames;
  }

  get isPlaying(): boolean {
    return this.frame !== null;
  }

  /** The last segment playing, or null: where the growth is going. */
  get destination(): GrowthSegment | null {
    return this.isPlaying ? (this.segments[this.segments.length - 1] ?? null) : null;
  }

  /** Plays `segments` from their start; whatever was playing stops where it is. */
  play(segments: readonly GrowthSegment[]): void {
    this.stop();
    if (segments.length === 0) return;
    this.segments = segments;
    this.durations = segmentDurations(segments);
    this.startTime = this.frames.now();
    // Playing from its first frame on: what that frame draws can depend on it.
    this.frame = this.frames.request(this.tick);
    const first = frameAt(segments, this.durations, 0).frame;
    if (first !== null) this.options.onFrame(first);
  }

  stop(): void {
    if (this.frame !== null) this.frames.cancel(this.frame);
    this.frame = null;
  }

  private readonly tick = (time: number): void => {
    const { frame, isOver } = frameAt(this.segments, this.durations, time - this.startTime);
    if (frame !== null) this.options.onFrame(frame);
    if (isOver) {
      this.frame = null;
      this.options.onDone?.();
      return;
    }
    this.frame = this.frames.request(this.tick);
  };
}
