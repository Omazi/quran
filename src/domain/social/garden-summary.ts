import type { LocalDate } from '@/domain/shared/local-date';
import { compareLocalDates } from '@/domain/shared/local-date';

import { FIRST_LEVEL, FULL_HEALTH, NO_HEALTH, SOCIAL_CONFIG } from './config';
import type { Badge, BadgeInput, GardenSummary, GardenSummaryInput, UserId } from './types';
import { assertId, assertList, assertLocalDate, assertObject } from './validation';

/**
 * Rule 5: what my app publishes about my garden. It is built field by field from the values
 * the other modules give (khatm, garden): whatever else the caller passes is not carried over,
 * so no page number and no time of day can reach the server by this road.
 */

function assertWhole(value: number, label: string, min: number, max: number): void {
  if (typeof value !== 'number') {
    throw new TypeError(`Invalid ${label}: expected a number, got ${typeof value}`);
  }
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(
      `Invalid ${label}: ${String(value)} (expected a whole number, ${min} to ${max})`,
    );
  }
}

function assertNotAfter(day: LocalDate, today: LocalDate, label: string): void {
  assertLocalDate(day, label);
  if (compareLocalDates(day, today) > 0) {
    throw new RangeError(`Invalid ${label}: ${day} is after today (${today})`);
  }
}

export function toGardenSummary(
  userId: UserId,
  input: GardenSummaryInput,
  today: LocalDate,
): GardenSummary {
  assertId(userId, 'user');
  assertLocalDate(today, 'today');
  assertObject(input, 'garden summary input');

  assertWhole(input.khatmNumber, 'khatma number', FIRST_LEVEL, Number.MAX_SAFE_INTEGER);
  assertWhole(input.hizbCompleted, 'hizbCompleted', 0, SOCIAL_CONFIG.hizbPerKhatm);
  if (typeof input.health !== 'number') {
    throw new TypeError(`Invalid health: expected a number, got ${typeof input.health}`);
  }
  if (!(input.health >= NO_HEALTH && input.health <= FULL_HEALTH)) {
    throw new RangeError(
      `Invalid health: ${String(input.health)} (expected ${NO_HEALTH} to ${FULL_HEALTH})`,
    );
  }
  assertWhole(input.streakDays, 'streakDays', 0, Number.MAX_SAFE_INTEGER);
  assertWhole(input.badgeCount, 'badgeCount', 0, Number.MAX_SAFE_INTEGER);
  if (input.lastWateredOn !== null) assertNotAfter(input.lastWateredOn, today, 'lastWateredOn');

  return {
    userId,
    level: input.khatmNumber,
    hizbCompleted: input.hizbCompleted,
    health: input.health,
    lastWateredOn: input.lastWateredOn,
    streakDays: input.streakDays,
    badgeCount: input.badgeCount,
    updatedOn: today,
  };
}

/** A completed khatma, published as a badge of the person. */
export function toBadge(userId: UserId, input: BadgeInput, today: LocalDate): Badge {
  assertId(userId, 'user');
  assertLocalDate(today, 'today');
  assertObject(input, 'badge input');
  assertWhole(input.khatmNumber, 'khatma number', FIRST_LEVEL, Number.MAX_SAFE_INTEGER);
  assertNotAfter(input.completedOn, today, 'completedOn');
  return { userId, khatmNumber: input.khatmNumber, completedOn: input.completedOn };
}

/** Every completed khatma of the person, once each. The list replaces what was published. */
export function toBadges(userId: UserId, inputs: readonly BadgeInput[], today: LocalDate): Badge[] {
  assertList(inputs, 'badge inputs');
  const badges = inputs.map((input) => toBadge(userId, input, today));
  const numbers = new Set(badges.map((badge) => badge.khatmNumber));
  if (numbers.size !== badges.length) {
    throw new RangeError('Invalid badges: the same khatma twice');
  }
  return badges;
}
