import type { LocalDate } from '@/domain/shared/local-date';
import type { DaySeconds, SecondsByDay } from '@/domain/stats';

import type { DeviceId, SyncRules } from './types';

const NO_SECONDS: DaySeconds = { app: 0, reader: 0 };

/** The days of a record, as the branded type: they were checked when they were stored. */
export function daysOf(record: SecondsByDay): LocalDate[] {
  return Object.keys(record) as LocalDate[];
}

export function secondsOn(record: SecondsByDay | null | undefined, date: LocalDate): DaySeconds {
  if (record === null || record === undefined) return NO_SECONDS;
  return Object.prototype.hasOwnProperty.call(record, date)
    ? (record[date] ?? NO_SECONDS)
    : NO_SECONDS;
}

/** A record of days built from checked days only. */
export function toSecondsByDay(days: Iterable<readonly [LocalDate, DaySeconds]>): SecondsByDay {
  return Object.fromEntries(days) as SecondsByDay;
}

export interface DerivedTime {
  /** The time of all phones, by day: what the store shows. */
  readonly timeSpent: SecondsByDay;
  /** The counters of each phone, without the days that are no longer kept. */
  readonly time: Readonly<Record<DeviceId, SecondsByDay>>;
  readonly timeBaseline: SecondsByDay | null;
}

/**
 * The time of a day: this phone's own counter, plus the larger of the other phones' sum and the
 * baseline (time found on this phone before it knew the account's, `SyncMeta.timeBaseline`).
 * Taking the larger, not the sum, is what keeps the same time from being counted twice when a
 * copy of this phone's data is already in the account. Bounded by a day's maximum; only the most
 * recent `maxTimeDays` days are kept, in the counters too.
 */
export function deriveTime(
  time: Readonly<Record<DeviceId, SecondsByDay>>,
  ownDevice: DeviceId,
  baseline: SecondsByDay | null,
  rules: SyncRules,
): DerivedTime {
  const allDays = new Set<LocalDate>(baseline === null ? [] : daysOf(baseline));
  for (const counters of Object.values(time))
    for (const date of daysOf(counters)) allDays.add(date);

  const totals: [LocalDate, DaySeconds][] = [];
  for (const date of allDays) {
    const own = secondsOn(time[ownDevice], date);
    let othersApp = 0;
    let othersReader = 0;
    for (const [device, counters] of Object.entries(time)) {
      if (device === ownDevice) continue;
      const seconds = secondsOn(counters, date);
      othersApp += seconds.app;
      othersReader += seconds.reader;
    }
    const base = secondsOn(baseline, date);
    const app = Math.min(rules.maxSecondsPerDay, own.app + Math.max(othersApp, base.app));
    const reader = Math.min(app, own.reader + Math.max(othersReader, base.reader));
    if (app > 0) totals.push([date, { app, reader }]);
  }
  totals.sort(([a], [b]) => (a < b ? -1 : 1));
  const kept = totals.slice(-rules.maxTimeDays);
  const keptDays = new Set(kept.map(([date]) => date));
  // `allDays` is everything the counters hold; anything not kept is dropped from them.
  const isPruned = kept.length !== allDays.size;
  return {
    timeSpent: toSecondsByDay(kept),
    time: isPruned ? pruneDays(time, keptDays) : time,
    timeBaseline: isPruned && baseline !== null ? pruneRecord(baseline, keptDays) : baseline,
  };
}

export function pruneRecord(record: SecondsByDay, keep: ReadonlySet<LocalDate>): SecondsByDay {
  return toSecondsByDay(
    Object.entries(record).filter(([date]) => keep.has(date as LocalDate)) as [
      LocalDate,
      DaySeconds,
    ][],
  );
}

export function pruneDays(
  time: Readonly<Record<DeviceId, SecondsByDay>>,
  keep: ReadonlySet<LocalDate>,
): Readonly<Record<DeviceId, SecondsByDay>> {
  return Object.fromEntries(
    Object.entries(time)
      .map(([device, counters]) => [device, pruneRecord(counters, keep)] as const)
      .filter(([, counters]) => Object.keys(counters).length > 0),
  );
}

/** Whether two records hold the same days and seconds. */
export function isSameTime(a: SecondsByDay, b: SecondsByDay): boolean {
  const days = daysOf(a);
  if (days.length !== daysOf(b).length) return false;
  return days.every((date) => {
    const other = b[date];
    return other !== undefined && other.app === a[date]?.app && other.reader === a[date]?.reader;
  });
}
