/**
 * Shared helpers of the garden acceptance tests. They are written by the independent tester
 * from docs/specs/garden.md and the public API only (index.ts, types.ts): nothing here comes
 * from the developer's code or fixtures.
 *
 * HISTORY NOTATION, used by every suite. A history is a string with one letter per calendar
 * day, starting on the garden's first day (`firstHizbCompletedOn`):
 *
 *   W  watered day: the user read
 *   M  missed day: no reading, no pause
 *   P  paused day: inside a pause, no reading
 *   B  both: the user read on a day that is inside a pause (the spec does not say which wins)
 *
 * The LAST letter is today. Today can also be written `.`: "nothing read yet today". A final
 * `M` means the same thing, because a day is only missed once it is over.
 * Example: `WWWMMM.` = three days of reading, three missed days, and today still open.
 *
 * Jest runs every file under `__tests__` as a suite and the tester may only write in this
 * folder, so the self-check at the bottom is registered only when this file is the suite.
 */
import {
  REFERENCE_GARDEN_VARIANT,
  type GardenConfig,
  type GardenElement,
  type GardenInput,
  type GardenPause,
  type GardenPhase,
  type GardenState,
  type GardenVariant,
  type WaterState,
} from '@/domain/garden';
import { addDays, parseLocalDate, type LocalDate } from '@/domain/shared/local-date';

// ---------------------------------------------------------------------------------------
// The numbers of the spec, typed by hand: the acceptance tests never read them from the module.
// ---------------------------------------------------------------------------------------

export const HIZB_TOTAL = 60;
export const SPEC_DROUGHT_DAYS_TO_DEATH = 14;
export const SPEC_DAYS_RECOVERED_PER_WATERED_DAY = 3;
export const SPEC_THIRSTY_FROM = 3;
export const SPEC_WILTING_FROM = 6;
export const SPEC_DYING_FROM = 10;
export const SPEC_DRY_WATER_FROM_MISSED_DAYS = 3;
/** "ceil(débloqués × (14 − sécheresse) / 5)": the 5 of the spec. */
export const SPEC_DYING_STEPS = 5;

/** From best to worst. `bare` is apart: it is not a state of health. */
export const PHASES_FROM_BEST_TO_WORST: readonly GardenPhase[] = [
  'thriving',
  'thirsty',
  'wilting',
  'dying',
  'dead',
];
export const WATER_FROM_BEST_TO_WORST: readonly WaterState[] = ['flowing', 'still', 'dry'];

export function phaseRank(phase: GardenPhase): number {
  return PHASES_FROM_BEST_TO_WORST.indexOf(phase);
}

export function waterRank(water: WaterState): number {
  return WATER_FROM_BEST_TO_WORST.indexOf(water);
}

// ---------------------------------------------------------------------------------------
// Dates and histories
// ---------------------------------------------------------------------------------------

export function day(value: string): LocalDate {
  return parseLocalDate(value);
}

/** First day of the garden in every history that does not say otherwise. */
export const FIRST_DAY = day('2026-03-01');

/** Days counted from FIRST_DAY, computed once: the exhaustive suites build many inputs. */
const DAYS_FROM_FIRST_DAY: LocalDate[] = [];

/** The day `index` days after `firstDay`. */
function dayAt(firstDay: LocalDate, index: number): LocalDate {
  if (firstDay !== FIRST_DAY || index < 0) return addDays(firstDay, index);
  for (let next = DAYS_FROM_FIRST_DAY.length; next <= index; next += 1) {
    DAYS_FROM_FIRST_DAY.push(addDays(FIRST_DAY, next));
  }
  return DAYS_FROM_FIRST_DAY[index] ?? addDays(firstDay, index);
}

export type PauseStyle = 'one-per-run' | 'one-per-day' | 'overlapping';

export interface HistoryOptions {
  readonly hizbCompleted?: number;
  readonly currentHizbProgress?: number;
  readonly firstDay?: LocalDate;
  readonly completedOn?: LocalDate | null;
  /** How the paused days of the history are cut into pauses. */
  readonly pauseStyle?: PauseStyle;
  /** Added to the watered days of the history (days before the first day, after today...). */
  readonly extraWateredDays?: readonly LocalDate[];
  /** Added to the pauses of the history. */
  readonly extraPauses?: readonly GardenPause[];
  readonly variant?: GardenVariant;
  readonly config?: GardenConfig;
  readonly catalog?: readonly GardenElement[];
}

const HISTORY_PATTERN = /^[WMPB]*[WMPB.]$/;

function assertHistory(history: string): void {
  if (!HISTORY_PATTERN.test(history)) {
    throw new Error(`Not a history (letters W, M, P, B; the last may be "."): "${history}"`);
  }
}

function isWatered(letter: string): boolean {
  return letter === 'W' || letter === 'B';
}

function isPaused(letter: string): boolean {
  return letter === 'P' || letter === 'B';
}

/** Index ranges `[first, last]` of the consecutive paused days of a history. */
function pausedRuns(history: string): readonly (readonly [number, number])[] {
  const runs: [number, number][] = [];
  let runStart: number | null = null;
  [...history].forEach((letter, index) => {
    if (isPaused(letter) && runStart === null) runStart = index;
    if (!isPaused(letter) && runStart !== null) {
      runs.push([runStart, index - 1]);
      runStart = null;
    }
  });
  if (runStart !== null) runs.push([runStart, history.length - 1]);
  return runs;
}

/** Pauses that cover exactly the paused days of a history, cut in the requested style. */
export function pausesOf(
  history: string,
  firstDay: LocalDate = FIRST_DAY,
  style: PauseStyle = 'one-per-run',
): readonly GardenPause[] {
  assertHistory(history);
  const pause = (first: number, last: number): GardenPause => ({
    from: dayAt(firstDay, first),
    to: dayAt(firstDay, last),
  });
  const pauses: GardenPause[] = [];
  for (const [first, last] of pausedRuns(history)) {
    if (style === 'one-per-run') {
      pauses.push(pause(first, last));
    } else if (style === 'one-per-day') {
      for (let index = last; index >= first; index -= 1) pauses.push(pause(index, index));
    } else if (first === last) {
      // The same pause declared twice.
      pauses.push(pause(first, last), pause(first, last));
    } else {
      // Two pauses that overlap on every day but the ends, plus one nested inside.
      pauses.push(pause(first + 1, last), pause(first, last - 1), pause(first, first));
    }
  }
  return pauses;
}

export function wateredDaysOf(history: string, firstDay: LocalDate = FIRST_DAY): LocalDate[] {
  assertHistory(history);
  const days: LocalDate[] = [];
  [...history].forEach((letter, index) => {
    if (isWatered(letter)) days.push(dayAt(firstDay, index));
  });
  return days;
}

/** Today in a history: the day of its last letter. */
export function todayOf(history: string, firstDay: LocalDate = FIRST_DAY): LocalDate {
  assertHistory(history);
  return dayAt(firstDay, history.length - 1);
}

/**
 * The module input that tells a history. Defaults: 24 finished hizb (the garden of the
 * spec's scenarios), half of hizb 25 read, the reference variant, the default configuration.
 */
export function historyInput(history: string, options: HistoryOptions = {}): GardenInput {
  const firstDay = options.firstDay ?? FIRST_DAY;
  return {
    hizbCompleted: options.hizbCompleted ?? 24,
    currentHizbProgress: options.currentHizbProgress ?? 0.5,
    wateredDays: new Set([
      ...wateredDaysOf(history, firstDay),
      ...(options.extraWateredDays ?? []),
    ]),
    firstHizbCompletedOn: firstDay,
    completedOn: options.completedOn ?? null,
    today: todayOf(history, firstDay),
    pauses: [...pausesOf(history, firstDay, options.pauseStyle), ...(options.extraPauses ?? [])],
    variant: options.variant ?? REFERENCE_GARDEN_VARIANT,
    ...(options.config === undefined ? {} : { config: options.config }),
    ...(options.catalog === undefined ? {} : { catalog: options.catalog }),
  };
}

/** A bare earth: no hizb finished yet, so the garden has no first day. */
export function bareEarthInput(
  today: LocalDate,
  wateredDays: readonly LocalDate[] = [],
  pauses: readonly GardenPause[] = [],
): GardenInput {
  return {
    hizbCompleted: 0,
    currentHizbProgress: 0.5,
    wateredDays: new Set(wateredDays),
    firstHizbCompletedOn: null,
    completedOn: null,
    today,
    pauses,
    variant: REFERENCE_GARDEN_VARIANT,
  };
}

// ---------------------------------------------------------------------------------------
// The tester's reference model: the spec's rules, written as simply as possible
// ---------------------------------------------------------------------------------------

export interface ModelGarden {
  readonly droughtDays: number;
  readonly missedDaysInARow: number;
  readonly phase: GardenPhase;
  readonly water: WaterState;
  readonly visibleCount: number;
}

/**
 * "On parcourt les jours de firstHizbCompletedOn à today, en partant de 0" (spec, section
 * Sécheresse et santé). `B` days are refused: the spec does not say what they do.
 */
export function simulateDrought(history: string): {
  readonly droughtDays: number;
  readonly missedDaysInARow: number;
} {
  assertHistory(history);
  if (history.includes('B')) throw new Error('The reference model has no rule for a "B" day');
  let droughtDays = 0;
  let missedDaysInARow = 0;
  const todayIndex = history.length - 1;
  [...history].forEach((letter, index) => {
    if (letter === 'W') {
      droughtDays = Math.max(0, droughtDays - SPEC_DAYS_RECOVERED_PER_WATERED_DAY);
      missedDaysInARow = 0;
    } else if (letter === 'M' && index < todayIndex) {
      droughtDays = Math.min(SPEC_DROUGHT_DAYS_TO_DEATH, droughtDays + 1);
      missedDaysInARow += 1;
    }
    // A paused day changes nothing, and neither does today while nothing is read.
  });
  return { droughtDays, missedDaysInARow };
}

/** Spec, section Phases. For a garden that has at least one hizb. */
export function phaseOfDrought(droughtDays: number): GardenPhase {
  if (droughtDays >= SPEC_DROUGHT_DAYS_TO_DEATH) return 'dead';
  if (droughtDays >= SPEC_DYING_FROM) return 'dying';
  if (droughtDays >= SPEC_WILTING_FROM) return 'wilting';
  if (droughtDays >= SPEC_THIRSTY_FROM) return 'thirsty';
  return 'thriving';
}

/** Spec, section Éléments visibles. Whole-number arithmetic: no rounding surprise. */
export function visibleCountOf(unlocked: number, droughtDays: number): number {
  if (droughtDays >= SPEC_DROUGHT_DAYS_TO_DEATH) return 0;
  if (droughtDays < SPEC_DYING_FROM) return unlocked;
  const numerator = unlocked * (SPEC_DROUGHT_DAYS_TO_DEATH - droughtDays);
  // ceil(numerator / 5) without leaving the integers.
  return Math.floor((numerator + SPEC_DYING_STEPS - 1) / SPEC_DYING_STEPS);
}

/** Spec, section Eau. For a garden that has at least one hizb. */
export function waterOf(isTodayWatered: boolean, missedDaysInARow: number): WaterState {
  if (isTodayWatered || missedDaysInARow === 0) return 'flowing';
  return missedDaysInARow >= SPEC_DRY_WATER_FROM_MISSED_DAYS ? 'dry' : 'still';
}

/** What the spec says of a living, unfinished garden with `unlocked` hizb after a history. */
export function modelGarden(history: string, unlocked: number): ModelGarden {
  const { droughtDays, missedDaysInARow } = simulateDrought(history);
  return {
    droughtDays,
    missedDaysInARow,
    phase: phaseOfDrought(droughtDays),
    water: waterOf(history.endsWith('W'), missedDaysInARow),
    visibleCount: visibleCountOf(unlocked, droughtDays),
  };
}

/** The same five facts, read from a state of the module. */
export function summaryOf(state: GardenState): ModelGarden {
  return {
    droughtDays: state.droughtDays,
    missedDaysInARow: state.missedDaysInARow,
    phase: state.phase,
    water: state.water,
    visibleCount: state.visibleElements.length,
  };
}

// ---------------------------------------------------------------------------------------
// Generated histories
// ---------------------------------------------------------------------------------------

/** Small seeded generator (mulberry32): the same seed always gives the same histories. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function randomInt(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

/**
 * A history of `length` days made of stretches (a few days of the same kind in a row), so
 * that long absences, long pauses and long reading streaks all happen.
 */
export function randomHistory(random: () => number, length: number): string {
  const missedWeight = random();
  const wateredWeight = random();
  const pausedWeight = random() * 0.6;
  const total = missedWeight + wateredWeight + pausedWeight;
  let history = '';
  while (history.length < length) {
    const pick = random() * total;
    const letter = pick < missedWeight ? 'M' : pick < missedWeight + wateredWeight ? 'W' : 'P';
    history += letter.repeat(randomInt(random, 1, random() < 0.15 ? 20 : 4));
  }
  return history.slice(0, length);
}

/** Every history of exactly `length` days written with the given letters. */
export function* allHistories(letters: string, length: number): Generator<string> {
  if (length === 0) {
    yield '';
    return;
  }
  for (const shorter of allHistories(letters, length - 1)) {
    for (const letter of letters) yield shorter + letter;
  }
}

// ---------------------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------------------

/** What `action` throws, or `undefined` when it returns normally. */
export function errorThrownBy(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  return undefined;
}

/**
 * docs/CONTRIBUTING.md: "Entrées invalides : erreur explicite (RangeError, TypeError)".
 * Explicit means here: one of these two classes, and a message that says something, naming
 * the faulty input when `mention` is given.
 */
export function expectExplicitError(action: () => unknown, mention?: RegExp): void {
  const error = errorThrownBy(action);
  expect(error).toBeInstanceOf(Error);
  expect(error instanceof RangeError || error instanceof TypeError).toBe(true);
  const message = error instanceof Error ? error.message : '';
  expect(message.length).toBeGreaterThan(10);
  if (mention !== undefined) expect(message).toMatch(mention);
}

// ---------------------------------------------------------------------------------------
// Self-check of the kit: the reference model against the landmarks of the spec
// ---------------------------------------------------------------------------------------

if (expect.getState().testPath?.endsWith('acceptance-kit.ts')) {
  describe('acceptance kit: the reference model gives the landmarks of the spec', () => {
    it.each([
      // "3 jours sans lecture → il a soif ; 6 → il fane ; 10 → il meurt ; 14 → terre morte"
      ['W' + 'M'.repeat(3) + '.', 3, 'thirsty'],
      ['W' + 'M'.repeat(6) + '.', 6, 'wilting'],
      ['W' + 'M'.repeat(10) + '.', 10, 'dying'],
      ['W' + 'M'.repeat(14) + '.', 14, 'dead'],
      ['W' + 'M'.repeat(40) + '.', 14, 'dead'],
      // "Depuis la terre morte, cinq jours de lecture le ramènent à la pleine santé"
      ['W' + 'M'.repeat(14) + 'W', 11, 'dying'],
      ['W' + 'M'.repeat(14) + 'WW', 8, 'wilting'],
      ['W' + 'M'.repeat(14) + 'WWW', 5, 'thirsty'],
      ['W' + 'M'.repeat(14) + 'WWWW', 2, 'thriving'],
      ['W' + 'M'.repeat(14) + 'WWWWW', 0, 'thriving'],
      // A pause changes nothing; today does not count while nothing is read.
      ['WMMPPPPMM.', 4, 'thirsty'],
      ['WMMM', 2, 'thriving'],
    ])('%s: drought %i, %s', (history, droughtDays, phase) => {
      const model = modelGarden(history, 24);
      expect(model.droughtDays).toBe(droughtDays);
      expect(model.phase).toBe(phase);
    });

    it('visibleCountOf follows "80 %, 60 %, 40 %, 20 %" rounded up', () => {
      expect([10, 11, 12, 13, 14].map((drought) => visibleCountOf(24, drought))).toEqual([
        20, 15, 10, 5, 0,
      ]);
      expect([9, 10, 13, 14].map((drought) => visibleCountOf(1, drought))).toEqual([1, 1, 1, 0]);
    });

    it.each(['one-per-run', 'one-per-day', 'overlapping'] as const)(
      'pausesOf (%s) covers exactly the paused days',
      (style) => {
        const history = 'PWPPMPPPBBW.';
        const covered = new Set<LocalDate>();
        for (const pause of pausesOf(history, FIRST_DAY, style)) {
          expect(pause.from <= pause.to).toBe(true);
          for (let date = pause.from; date <= pause.to; date = addDays(date, 1)) covered.add(date);
        }
        const expected = [0, 2, 3, 5, 6, 7, 8, 9].map((index) => addDays(FIRST_DAY, index));
        expect([...covered].sort()).toEqual(expected);
      },
    );

    it('historyInput places the days on the calendar', () => {
      const input = historyInput('WMB.');
      expect(input.firstHizbCompletedOn).toBe('2026-03-01');
      expect(input.today).toBe('2026-03-04');
      expect([...input.wateredDays].sort()).toEqual(['2026-03-01', '2026-03-03']);
      expect(input.pauses).toEqual([{ from: '2026-03-03', to: '2026-03-03' }]);
    });

    it('generated histories are reproducible and complete', () => {
      expect(randomHistory(seededRandom(7), 50)).toBe(randomHistory(seededRandom(7), 50));
      expect(randomHistory(seededRandom(7), 50)).toHaveLength(50);
      expect([...allHistories('MWP', 3)]).toHaveLength(27);
      expect(new Set(allHistories('MWP', 3)).size).toBe(27);
    });
  });
}
