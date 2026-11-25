/**
 * The diagnostics of a closure the owner cannot explain: no crash log reaches this project, so
 * the app keeps its own. Three small pieces work together (docs/BUILD.md, "Diagnostic d'une
 * fermeture"):
 *
 * - a global error handler that writes the fatal JavaScript error to a file, synchronously,
 *   before the default handler lets the app end;
 * - a trail of the last 30 screens and gestures, and the last console errors (React names the
 *   component there), both copied into that record;
 * - at the next launch, one sheet that shows the record once, and a row in the settings that keeps
 *   it until the person clears it.
 *
 * When the app closed and there is NO record, the cause was not JavaScript: the sheet does not
 * come, and that absence is itself the finding (a native crash).
 *
 * Pure of React and of Expo: the file, the clock and the app's identity are given.
 */

import { createBreadcrumbs, type Breadcrumbs } from './breadcrumbs';
import {
  decodeCrashRecord,
  describeError,
  encodeCrashRecord,
  type AppInfo,
  type CrashRecord,
  type CrashSource,
} from './crash-record';
import type { RecordFile } from './record-file';

/** The part of React Native's `ErrorUtils` this uses. */
export interface ErrorUtilsLike {
  getGlobalHandler: () => (error: unknown, isFatal?: boolean) => void;
  setGlobalHandler: (handler: (error: unknown, isFatal?: boolean) => void) => void;
}

export interface DiagnosticsSnapshot {
  /** The record of the last closure, null when there is none. */
  readonly previous: CrashRecord | null;
  /** True while the one-time sheet of the next launch is to be shown. */
  readonly isSheetOpen: boolean;
}

export interface DiagnosticsDependencies {
  readonly file: RecordFile;
  /** Milliseconds since 1970. */
  readonly now: () => number;
  readonly app: AppInfo;
}

const CONSOLE_ERRORS_KEPT = 5;
const CONSOLE_ERROR_LENGTH = 1500;

function consoleText(args: readonly unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === 'string') return arg;
      if (arg instanceof Error) return arg.stack ?? arg.message;
      try {
        return JSON.stringify(arg) ?? String(arg);
      } catch {
        return Object.prototype.toString.call(arg);
      }
    })
    .join(' ')
    .slice(0, CONSOLE_ERROR_LENGTH);
}

export function createDiagnostics({ file, now, app }: DiagnosticsDependencies) {
  const breadcrumbs: Breadcrumbs = createBreadcrumbs(now);
  const consoleErrors: string[] = [];
  const listeners = new Set<() => void>();
  let route: string | null = null;
  let snapshot: DiagnosticsSnapshot = { previous: null, isSheetOpen: false };

  const publish = (next: DiagnosticsSnapshot) => {
    snapshot = next;
    listeners.forEach((listener) => listener());
  };

  const buildRecord = (
    error: unknown,
    source: CrashSource,
    componentStack: string | null,
  ): CrashRecord => {
    const { message, stack } = describeError(error);
    return {
      source,
      message,
      stack,
      componentStack,
      recentErrors: [...consoleErrors],
      time: new Date(now()).toISOString(),
      route,
      app,
      breadcrumbs: breadcrumbs.snapshot(),
      // An error screen was seen by the person already: no sheet for it at the next launch.
      isShown: source === 'boundary',
    };
  };

  /** Never throws: the handler that calls it is the last thing before the app ends. */
  const write = (error: unknown, source: CrashSource, componentStack: string | null): void => {
    try {
      file.write(encodeCrashRecord(buildRecord(error, source, componentStack)));
    } catch {
      // Nothing more can be done about a record that cannot be written.
    }
  };

  return {
    breadcrumbs,

    /** What would be written now for this error, without writing it (the error screen shows it). */
    buildRecord,

    setRoute: (next: string) => {
      route = next;
      breadcrumbs.add('nav', next);
    },

    /** The last console errors, oldest first. */
    recentConsoleErrors: (): readonly string[] => [...consoleErrors],

    /** Keeps the last console errors, in the trail of the record. Returns the way back. */
    installConsoleCapture: (target: Console): (() => void) => {
      const original = target.error;
      let isCapturing = false;
      target.error = (...args: unknown[]) => {
        if (!isCapturing) {
          isCapturing = true;
          try {
            consoleErrors.push(consoleText(args));
            if (consoleErrors.length > CONSOLE_ERRORS_KEPT) consoleErrors.shift();
          } catch {
            // The capture is a help, never a cause.
          }
          isCapturing = false;
        }
        original.apply(target, args as Parameters<Console['error']>);
      };
      return () => {
        target.error = original;
      };
    },

    /**
     * Puts the recorder in front of the default handler: a fatal error is written to the file
     * first, then handed on (the default handler is what ends the app). Returns the way back.
     */
    installGlobalHandler: (errorUtils: ErrorUtilsLike): (() => void) => {
      const previous = errorUtils.getGlobalHandler();
      const handler = (error: unknown, isFatal?: boolean) => {
        try {
          if (isFatal === true) {
            write(error, 'fatal', null);
          } else {
            breadcrumbs.add('error', describeError(error).message);
          }
        } finally {
          previous(error, isFatal);
        }
      };
      errorUtils.setGlobalHandler(handler);
      return () => errorUtils.setGlobalHandler(previous);
    },

    /** An error screen is about to be shown: keep what it shows, in case it is not photographed. */
    recordBoundaryError: (error: unknown, componentStack: string | null = null): void => {
      write(error, 'boundary', componentStack);
      // Also in the trail, so a later fatal record shows that a screen failed before.
      breadcrumbs.add('error', `error screen: ${describeError(error).message}`);
    },

    /** Reads the record left by the last launch, once, at startup. */
    load: (): void => {
      let record: CrashRecord | null = null;
      try {
        record = decodeCrashRecord(file.read());
      } catch {
        record = null;
      }
      if (record === null) {
        publish({ previous: null, isSheetOpen: false });
        return;
      }
      const isNew = !record.isShown;
      if (isNew) {
        try {
          // Shown once: the next launch finds it marked, and the settings still keep it.
          file.write(encodeCrashRecord({ ...record, isShown: true }));
        } catch {
          // Shown again at the next launch rather than lost.
        }
      }
      publish({ previous: record, isSheetOpen: isNew && record.source === 'fatal' });
    },

    /** Opens the sheet again, from the settings. Nothing to show without a record. */
    openSheet: (): void => {
      if (snapshot.previous !== null && !snapshot.isSheetOpen) {
        publish({ ...snapshot, isSheetOpen: true });
      }
    },

    dismissSheet: (): void => {
      if (snapshot.isSheetOpen) publish({ ...snapshot, isSheetOpen: false });
    },

    /** Forgets the record, on the person's request. */
    clear: (): void => {
      try {
        file.remove();
      } catch {
        // A record that cannot be removed stays; the screen no longer shows it this time.
      }
      publish({ previous: null, isSheetOpen: false });
    },

    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: (): DiagnosticsSnapshot => snapshot,
  };
}

export type Diagnostics = ReturnType<typeof createDiagnostics>;
