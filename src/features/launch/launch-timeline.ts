/**
 * The choreography of the launch, in milliseconds from the first laid-out frame of the overlay.
 *
 * Purpose (animate skill, step 2): preventing a jarring change, then delight. The app starts
 * under a plain launch screen and the mark writes itself on it: the letters rise from the
 * bottom, the drops of water fall into place, the leaf unfurls at the tip of the kaf. Frequency
 * tier: rare (once per cold start), the tier where the delight budget lives. Total with the
 * fade-out: about 1.5 s, inside the 1.2 to 1.6 s the owner asked for.
 */

/** Strong ease-out for entrances (animate skill, step 5). */
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export const LAUNCH_TIMELINE = {
  /** The letters are wiped in from the bottom up, along the rising stroke of the kaf. */
  word: { start: 80, duration: 680 },
  /** The drops fall one after the other, 80 ms apart (stagger: 30 to 80 ms). */
  /** `fall` is in canvas units of the mark (about 13 pt at its size). */
  drops: { start: 520, stagger: 80, duration: 360, count: 3, fall: 60, dampingRatio: 0.9 },
  /** The leaf grows from the tip of the stroke, once the stroke has nearly arrived. */
  /** `from` is the first scale, `foldedBy` the first angle in degrees, folded towards the stroke. */
  leaf: { start: 700, duration: 480, from: 0.15, foldedBy: 24, dampingRatio: 0.86 },
  /** Width of the soft edge of the wipe, in canvas units of the mark. */
  wipeEdge: 120,
  /** The mark is complete: from here the overlay may leave as soon as the app is ready. */
  settled: 1200,
  /** The overlay fades into the first screen. */
  fadeOut: 260,
} as const;

/** Reduce Motion: nothing moves; the finished mark fades in and out, a short cross-fade. */
export const REDUCED_TIMELINE = {
  fadeIn: 180,
  settled: 180,
  fadeOut: 200,
} as const;

export type LaunchMotion = 'full' | 'reduced';

/** When the mark is complete and the overlay may leave. */
export function settledAt(motion: LaunchMotion): number {
  return motion === 'full' ? LAUNCH_TIMELINE.settled : REDUCED_TIMELINE.settled;
}

/** How long the fade into the first screen lasts. */
export function fadeOutDuration(motion: LaunchMotion): number {
  return motion === 'full' ? LAUNCH_TIMELINE.fadeOut : REDUCED_TIMELINE.fadeOut;
}

/** The shortest time the overlay can stay, when the app is ready at once. */
export function shortestLaunch(motion: LaunchMotion): number {
  return settledAt(motion) + fadeOutDuration(motion);
}
