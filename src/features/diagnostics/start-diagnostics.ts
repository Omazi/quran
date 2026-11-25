import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { AppState, Platform } from 'react-native';

import { setActiveDiagnostics } from './active';
import type { AppInfo } from './crash-record';
import { createDeviceRecordFile } from './device-record-file';
import { createDiagnostics, type Diagnostics, type ErrorUtilsLike } from './diagnostics';

/** What the app is running on, for the record. */
function readAppInfo(): AppInfo {
  return {
    version: Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '?',
    build: Constants.nativeBuildVersion ?? '?',
    os: `${Platform.OS} ${String(Platform.Version)}`,
    device: Device.modelName ?? '?',
  };
}

export interface StartOptions {
  /** React Native's `ErrorUtils`; defaults to the global one. */
  errorUtils?: ErrorUtilsLike;
  /** Defaults to the global console. */
  console?: Console;
}

let started: Diagnostics | null = null;
let undo: (() => void)[] = [];

/**
 * Starts the diagnostics, once, as the app's first module loads: reads the record of the last
 * launch, then puts the recorder in front of the global error handler and keeps the console's
 * errors. Whatever fails here is left behind: the diagnostics must never be why the app does not
 * start.
 */
export function startDiagnostics(options: StartOptions = {}): Diagnostics {
  if (started !== null) return started;
  const diagnostics = createDiagnostics({
    file: createDeviceRecordFile(),
    now: Date.now,
    app: safely(readAppInfo) ?? { version: '?', build: '?', os: '?', device: '?' },
  });
  // Read before installing: this launch's own record comes after it.
  safely(() => diagnostics.load());
  const errorUtils =
    'errorUtils' in options
      ? options.errorUtils
      : (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (errorUtils !== undefined) {
    const uninstall = safely(() => diagnostics.installGlobalHandler(errorUtils));
    if (uninstall) undo.push(uninstall);
  }
  const target = 'console' in options ? options.console : console;
  if (target !== undefined) {
    const uninstall = safely(() => diagnostics.installConsoleCapture(target));
    if (uninstall) undo.push(uninstall);
  }
  safely(() => {
    diagnostics.breadcrumbs.add('app', 'start');
    const subscription = AppState.addEventListener('change', (state) =>
      diagnostics.breadcrumbs.add('app', `app ${state}`),
    );
    undo.push(() => subscription.remove());
  });
  setActiveDiagnostics(diagnostics);
  started = diagnostics;
  return diagnostics;
}

function safely<T>(run: () => T): T | undefined {
  try {
    return run();
  } catch {
    return undefined;
  }
}

/** Takes the diagnostics down, so that a test can start them again. */
export function stopDiagnosticsForTests(): void {
  undo.forEach((run) => safely(run));
  undo = [];
  started = null;
  setActiveDiagnostics(null);
}
