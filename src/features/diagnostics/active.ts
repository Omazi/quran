/**
 * The diagnostics started with the app, found by the screens that need them (the error screens
 * record what they show). Null until `startDiagnostics` has run, and in tests unless one is set.
 */

import { Share } from 'react-native';

import { describeError, formatCrashRecord, type CrashRecord } from './crash-record';
import type { Diagnostics } from './diagnostics';

let active: Diagnostics | null = null;

export function setActiveDiagnostics(diagnostics: Diagnostics | null): void {
  active = diagnostics;
}

export function getActiveDiagnostics(): Diagnostics | null {
  return active;
}

/** Everything known about an error, as the text the person copies or sends. */
export function reportOf(error: unknown, componentStack: string | null): string {
  if (active !== null)
    return formatCrashRecord(active.buildRecord(error, 'boundary', componentStack));
  const { message, stack } = describeError(error);
  const record: CrashRecord = {
    source: 'boundary',
    message,
    stack,
    componentStack,
    recentErrors: [],
    time: new Date().toISOString(),
    route: null,
    app: { version: '?', build: '?', os: '?', device: '?' },
    breadcrumbs: [],
    isShown: true,
  };
  return formatCrashRecord(record);
}

/**
 * Opens the system's share sheet, which has "Copy" among its actions, and Messages, Mail and
 * AirDrop: the person can send the text from the phone. (A clipboard module would copy at once;
 * none is installed, and the app's native modules are not changed for a diagnostic.)
 */
export async function shareText(text: string): Promise<void> {
  try {
    await Share.share({ message: text });
  } catch {
    // The share sheet failing must not become a second error on an error screen.
  }
}

/**
 * A gesture has just started (a drag, a pinch): one line in the trail. Cheap, never throws, does
 * nothing before the diagnostics have started.
 */
export function noteGestureStart(name: string): void {
  active?.breadcrumbs.add('gesture', name);
}
