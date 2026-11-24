/**
 * Helpers shared by the garden tests. Not part of the module's API.
 *
 * Histories are written as a "timeline": one letter per day that is over, starting on the
 * day the garden started living (the day its first hizb was finished). Spaces are ignored,
 * so runs can be grouped for the reader.
 *   W  watered (the user read)
 *   M  missed
 *   P  paused, and the user did not read
 *   R  paused, but the user read anyway
 * Today is described separately, because a day in progress follows its own rule.
 */
import { addDays, parseLocalDate, type LocalDate } from '@/domain/shared/local-date';

import type { GardenInput, GardenPause } from '../types';
import { REFERENCE_GARDEN_VARIANT } from '../variant';

/** First day of every timeline: the day the first hizb was finished. */
export const GARDEN_FIRST_DAY = parseLocalDate('2026-01-01');

export type TodayKind = 'unread' | 'read' | 'paused-unread' | 'paused-read';

const TIMELINE_LETTER_OF_TODAY: Readonly<Record<TodayKind, string>> = {
  unread: 'M',
  read: 'W',
  'paused-unread': 'P',
  'paused-read': 'R',
};

/**
 * Builds a garden input from a timeline: 24 hizb finished, the first of them on
 * `GARDEN_FIRST_DAY`, the khatma not finished, and the reference variant, unless
 * `overrides` replaces these or any other field.
 *
 * With `hizbCompleted: 0` the garden is a bare earth: it has no first hizb, and the
 * timeline then only says on which days the user read.
 */
export function gardenInput(
  past: string,
  today: TodayKind = 'unread',
  overrides: Partial<GardenInput> = {},
): GardenInput {
  const letters = past.replace(/\s/g, '') + TIMELINE_LETTER_OF_TODAY[today];
  const wateredDays = new Set<LocalDate>();
  const pauses: GardenPause[] = [];

  [...letters].forEach((letter, index) => {
    const day = addDays(GARDEN_FIRST_DAY, index);
    if (letter === 'W' || letter === 'R') wateredDays.add(day);
    if (letter === 'P' || letter === 'R') pauses.push({ from: day, to: day });
    if (!'WMPR'.includes(letter)) throw new Error(`Unknown timeline letter "${letter}"`);
  });

  return {
    hizbCompleted: 24,
    currentHizbProgress: 0,
    wateredDays,
    firstHizbCompletedOn: overrides.hizbCompleted === 0 ? null : GARDEN_FIRST_DAY,
    completedOn: null,
    today: addDays(GARDEN_FIRST_DAY, letters.length - 1),
    pauses,
    variant: REFERENCE_GARDEN_VARIANT,
    ...overrides,
  };
}

/**
 * Small deterministic random generator (mulberry32): the same seed always gives the same
 * sequence, so a failing random history can be replayed. Returns numbers in [0, 1).
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function randomInteger(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

/**
 * A random timeline made of stretches with different habits (regular reader, long
 * absence, pause, irregular reader), so that both long runs and noisy mixes show up.
 */
export function randomTimeline(random: () => number, maxDays: number): string {
  const targetLength = randomInteger(random, 0, maxDays);
  let timeline = '';
  while (timeline.length < targetLength) {
    const stretchLength = randomInteger(random, 1, 30);
    const habit = random();
    const readingChance = random();
    for (let day = 0; day < stretchLength; day += 1) {
      if (habit < 0.2) timeline += 'W';
      else if (habit < 0.4) timeline += 'M';
      else if (habit < 0.5) timeline += random() < 0.1 ? 'R' : 'P';
      else timeline += random() < readingChance ? 'W' : 'M';
    }
  }
  return timeline.slice(0, targetLength);
}

const TODAY_KINDS: readonly TodayKind[] = ['unread', 'read', 'paused-unread', 'paused-read'];

export function randomTodayKind(random: () => number): TodayKind {
  return TODAY_KINDS[randomInteger(random, 0, TODAY_KINDS.length - 1)] ?? 'unread';
}
