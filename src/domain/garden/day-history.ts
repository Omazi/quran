/**
 * Turns the calendar inputs (start date, today, watered days, pauses) into the plain list
 * of days the health simulation walks through.
 */
import { daysBetween, isLocalDate, type LocalDate } from '@/domain/shared/local-date';

import type { DayKind } from './health';
import type { GardenPause } from './types';

export interface DayHistory {
  /**
   * The days that count, from the start date onwards: every day that is over, plus today
   * when the user has already read today.
   */
  readonly days: readonly DayKind[];
  readonly daysSinceLastWatered: number | null;
  readonly isPausedToday: boolean;
}

function assertLocalDate(value: LocalDate, name: string): void {
  if (typeof value !== 'string' || !isLocalDate(value)) {
    throw new RangeError(`Garden: ${name} is not a real YYYY-MM-DD date: "${String(value)}"`);
  }
}

/**
 * Sorts each day from `startDate` to `today` into watered, paused or missed.
 * Throws a RangeError on impossible dates, `today` before `startDate`, or a pause that
 * ends before it starts.
 */
export function buildDayHistory(
  startDate: LocalDate,
  today: LocalDate,
  wateredDays: ReadonlySet<LocalDate>,
  pauses: readonly GardenPause[],
): DayHistory {
  assertLocalDate(startDate, 'startDate');
  assertLocalDate(today, 'today');
  const todayIndex = daysBetween(startDate, today);
  if (todayIndex < 0) {
    throw new RangeError(`Garden: today (${today}) is before startDate (${startDate})`);
  }

  // Index 0 is the start date, index `todayIndex` is today.
  const days = new Array<DayKind>(todayIndex + 1).fill('missed');

  pauses.forEach((pause, position) => {
    assertLocalDate(pause.from, `pauses[${position}].from`);
    assertLocalDate(pause.to, `pauses[${position}].to`);
    if (pause.to < pause.from) {
      throw new RangeError(
        `Garden: pauses[${position}] ends (${pause.to}) before it starts (${pause.from})`,
      );
    }
    const firstIndex = Math.max(0, daysBetween(startDate, pause.from));
    const lastIndex = Math.min(todayIndex, daysBetween(startDate, pause.to));
    for (let index = firstIndex; index <= lastIndex; index += 1) days[index] = 'paused';
  });
  const isPausedToday = days[todayIndex] === 'paused';

  // Watered days are written last on purpose: reading during a pause still counts.
  let lastWateredIndex: number | null = null;
  for (const wateredDay of wateredDays) {
    assertLocalDate(wateredDay, 'a watered day');
    const index = daysBetween(startDate, wateredDay);
    if (index < 0 || index > todayIndex) continue;
    days[index] = 'watered';
    if (lastWateredIndex === null || index > lastWateredIndex) lastWateredIndex = index;
  }

  // Today is not over: it counts when watered, and is otherwise left out. It only
  // becomes a missed (or paused) day tomorrow.
  if (days[todayIndex] !== 'watered') days.pop();

  return {
    days,
    daysSinceLastWatered: lastWateredIndex === null ? null : todayIndex - lastWateredIndex,
    isPausedToday,
  };
}
