/**
 * The launch animation: the mark of the icon draws itself over the app while it starts, then
 * fades into the first screen. Once per cold start; see use-launch.ts and launch-timeline.ts.
 */

export { LaunchOverlay } from './launch-overlay';
export { resetLaunchSession } from './launch-session';
export { useLaunch, type LaunchState, type UseLaunchOptions } from './use-launch';
