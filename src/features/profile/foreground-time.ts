/**
 * Counts the time the app spends in the foreground, and the part of it spent in the reader
 * (docs/specs/stats.md, D37). Pure: the clocks and the store's writer are injected, so tests
 * choose the time. The time is handed over in batches, by `flush`: every call of the store's
 * `addForegroundTime` writes to the device, so it must not run every second.
 *
 * A batch goes to the local day of the moment it is handed over: time spent just before
 * midnight and handed over just after is counted the next day (at most one batch, one minute).
 */

import type { LocalDate } from '@/domain/shared/local-date';
import { deviceLocalDate } from '@/features/home';
import type { ForegroundTime } from '@/store';

const MILLISECONDS_PER_SECOND = 1000;

export interface ForegroundTimeRecorderOptions {
  /** Milliseconds from a clock that never goes back. */
  readonly monotonicClock: () => number;
  /** The present instant, for the local day of a batch. */
  readonly clock: () => Date;
  /** The store's `addForegroundTime`. */
  readonly record: (time: ForegroundTime) => void;
  /** Whether the app is in the foreground when counting starts. */
  readonly isForeground: boolean;
  /** Defaults to the device's time zone. */
  readonly localDate?: (instant: Date) => LocalDate;
}

export interface ForegroundTimeRecorder {
  setForeground: (isForeground: boolean) => void;
  setReaderOpen: (isOpen: boolean) => void;
  /** Hands the whole seconds counted so far to the store; the rest waits for the next batch. */
  flush: () => void;
}

export function createForegroundTimeRecorder({
  monotonicClock,
  clock,
  record,
  isForeground: startsInForeground,
  localDate = deviceLocalDate,
}: ForegroundTimeRecorderOptions): ForegroundTimeRecorder {
  let isForeground = startsInForeground;
  let isReaderOpen = false;
  let lastMark = monotonicClock();
  let appMs = 0;
  let readerMs = 0;

  /** Moves the time since the last mark into the counters. */
  const advance = () => {
    const now = monotonicClock();
    // A clock that went back is a broken clock: that stretch counts as nothing.
    const elapsed = Math.max(0, now - lastMark);
    lastMark = now;
    if (!isForeground) return;
    appMs += elapsed;
    if (isReaderOpen) readerMs += elapsed;
  };

  const flush = () => {
    advance();
    const appSeconds = Math.floor(appMs / MILLISECONDS_PER_SECOND);
    // Seconds are cut separately: the reader's could round above the app's in one batch. The
    // excess waits in the reader's counter for the next batch.
    const readerSeconds = Math.min(Math.floor(readerMs / MILLISECONDS_PER_SECOND), appSeconds);
    if (appSeconds === 0) return;
    appMs -= appSeconds * MILLISECONDS_PER_SECOND;
    readerMs -= readerSeconds * MILLISECONDS_PER_SECOND;
    record({ date: localDate(clock()), appSeconds, readerSeconds });
  };

  return {
    setForeground: (next) => {
      if (next === isForeground) return;
      if (next) {
        advance();
        isForeground = true;
      } else {
        flush();
        isForeground = false;
      }
    },
    setReaderOpen: (next) => {
      advance();
      isReaderOpen = next;
    },
    flush,
  };
}
