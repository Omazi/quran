/**
 * Turns the calendar inputs (first hizb, completion, today, watered days, pauses) into the
 * plain list of days the drought simulation walks through. Nothing else in the module
 * handles dates.
 *
 * No date is ever "too late" here: after a time-zone change, today can fall before the
 * day of the first hizb or before a watered day. Such days are simply not reached yet.
 * The completion day plays no part: a complete garden does not depend on the calendar.
 */
import { daysBetween, isLocalDate, type LocalDate } from '@/domain/shared/local-date';

import { isList, isObject, isSet } from './checks';
import type { GardenPause } from './types';

/** What happened on one day of the garden's life. */
export interface GardenDay {
  /** The user read a new page that day. */
  readonly isWatered: boolean;
  /** The day is inside a pause. A day can be both paused and watered: reading wins. */
  readonly isPaused: boolean;
}

/** A day the garden is looked at: today, or one of the coming days. */
export interface ViewDay {
  /**
   * Position of that day in `DayHistory.lifeDays`, or null while the life of the garden
   * has not begun (bare earth, or a day before the first hizb).
   */
  readonly lifeDayIndex: number | null;
  /** Calendar days since the last watered day (0 when read that day), or null. */
  readonly daysSinceLastWatered: number | null;
  readonly isPaused: boolean;
}

export interface DayHistory {
  /**
   * The life of the garden, one entry per day, from the day of its first hizb to the last
   * day looked at. Empty for a bare earth.
   */
  readonly lifeDays: readonly GardenDay[];
  readonly today: ViewDay;
  /** The days after today, if nothing more is read. */
  readonly comingDays: readonly ViewDay[];
}

export interface CalendarInput {
  readonly firstHizbCompletedOn: LocalDate | null;
  /** Only checked: a complete garden is shown at full health whatever the dates. */
  readonly completedOn: LocalDate | null;
  readonly today: LocalDate;
  /** How many days after today to look at (0 for today only). */
  readonly daysAhead: number;
  readonly wateredDays: ReadonlySet<LocalDate>;
  readonly pauses: readonly GardenPause[];
}

function assertLocalDate(value: LocalDate, name: string): void {
  if (typeof value !== 'string' || !isLocalDate(value)) {
    throw new RangeError(`Garden: ${name} is not a real YYYY-MM-DD date: "${String(value)}"`);
  }
}

/**
 * Sorts the days of the garden's life, and says from where today and each coming day
 * look at it. Throws on impossible dates and on a pause that ends before it starts.
 */
export function buildDayHistory(calendar: CalendarInput): DayHistory {
  const { today, daysAhead, wateredDays, pauses } = calendar;
  assertLocalDate(today, 'today');
  if (!isSet(wateredDays)) throw new TypeError('Garden: wateredDays must be a Set');
  if (!isList(pauses)) throw new TypeError('Garden: pauses must be a list');

  // Every day is numbered from today: 0 is today, -1 yesterday, 1 tomorrow.
  const offsetOf = (day: LocalDate | null, name: string): number | null => {
    if (day === null) return null;
    assertLocalDate(day, name);
    return daysBetween(today, day);
  };
  const firstHizbOffset = offsetOf(calendar.firstHizbCompletedOn, 'firstHizbCompletedOn');
  if (calendar.completedOn !== null) assertLocalDate(calendar.completedOn, 'completedOn');

  // The days that matter: from the first hizb (or today, whichever comes first) to the
  // last day looked at.
  const lastOffset = daysAhead;
  const firstOffset = firstHizbOffset === null ? 0 : Math.min(firstHizbOffset, 0);

  const pausedOffsets = new Set<number>();
  pauses.forEach((pause, position) => {
    if (!isObject(pause)) throw new TypeError(`Garden: pauses[${position}] must be a pause`);
    assertLocalDate(pause.from, `pauses[${position}].from`);
    assertLocalDate(pause.to, `pauses[${position}].to`);
    if (pause.to < pause.from) {
      throw new RangeError(
        `Garden: pauses[${position}] ends (${pause.to}) before it starts (${pause.from})`,
      );
    }
    const firstPaused = Math.max(firstOffset, daysBetween(today, pause.from));
    const lastPaused = Math.min(lastOffset, daysBetween(today, pause.to));
    for (let offset = firstPaused; offset <= lastPaused; offset += 1) pausedOffsets.add(offset);
  });

  const wateredOffsets = new Set<number>();
  for (const wateredDay of wateredDays) {
    assertLocalDate(wateredDay, 'a watered day');
    wateredOffsets.add(daysBetween(today, wateredDay));
  }
  const lastWateredOffsetUpTo = (limit: number): number | null => {
    let last: number | null = null;
    for (const offset of wateredOffsets) {
      if (offset <= limit && (last === null || offset > last)) last = offset;
    }
    return last;
  };

  const dayAt = (offset: number): GardenDay => ({
    isWatered: wateredOffsets.has(offset),
    isPaused: pausedOffsets.has(offset),
  });
  const viewFrom = (offset: number): ViewDay => {
    const lastWateredOffset = lastWateredOffsetUpTo(offset);
    const hasLifeBegun = firstHizbOffset !== null && offset >= firstHizbOffset;
    return {
      lifeDayIndex: hasLifeBegun ? offset - firstHizbOffset : null,
      daysSinceLastWatered: lastWateredOffset === null ? null : offset - lastWateredOffset,
      isPaused: pausedOffsets.has(offset),
    };
  };

  const lifeDays: GardenDay[] = [];
  if (firstHizbOffset !== null) {
    for (let offset = firstHizbOffset; offset <= lastOffset; offset += 1) {
      lifeDays.push(dayAt(offset));
    }
  }
  return {
    lifeDays,
    today: viewFrom(0),
    comingDays: Array.from({ length: daysAhead }, (_, index) => viewFrom(index + 1)),
  };
}
