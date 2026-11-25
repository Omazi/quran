/**
 * Whether the launch animation already played in this run of the app. A cold start is one run of
 * the JavaScript runtime, so a module variable is the right lifetime: a root layout that mounts
 * again (a reload of the routes, a hot refresh) must not play it twice.
 */
let hasPlayed = false;

export function hasLaunchPlayed(): boolean {
  return hasPlayed;
}

export function markLaunchPlayed(): void {
  hasPlayed = true;
}

/** For tests: a new cold start. */
export function resetLaunchSession(): void {
  hasPlayed = false;
}
