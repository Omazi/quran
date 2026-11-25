/**
 * Whether a screen that opens the microphone was opened from inside the app. A link
 * (`quranapp://listening`, `quranapp://reader/294?follow=1`) is an untrusted input (docs/SECURITY.md):
 * it may bring the screen up, never start the microphone. The app's own buttons say so before they
 * navigate (`markOpenedInApp`); the screen asks once it shows (`wasOpenedInApp`). An address cannot
 * carry this mark: it lives in memory, written by the app's code only, and runs out in seconds.
 */

export type MicrophoneRoute = 'listening' | 'reader-follow';

/** Long enough for a screen to mount after a push; too short for a link to ride on it. */
const MARK_LIFETIME_MS = 5_000;

const marks = new Map<MicrophoneRoute, number>();

/** Called by in-app code just before it navigates to a screen that may start the microphone. */
export function markOpenedInApp(route: MicrophoneRoute, now: number = Date.now()): void {
  marks.set(route, now);
}

/** Whether the in-app code has just sent the person to this screen. Not consumed: safe to ask twice. */
export function wasOpenedInApp(route: MicrophoneRoute, now: number = Date.now()): boolean {
  const at = marks.get(route);
  return at !== undefined && now - at >= 0 && now - at <= MARK_LIFETIME_MS;
}

/** For tests. */
export function forgetOpenedInApp(): void {
  marks.clear();
}
