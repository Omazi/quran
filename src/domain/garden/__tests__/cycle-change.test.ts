/**
 * From one khatma to the next (docs/DECISIONS.md, D9): the finished garden becomes a
 * badge, and the next khatma grows a new, different garden from a bare earth.
 */
import { addDays, parseLocalDate, type LocalDate } from '@/domain/shared/local-date';

import {
  completedGardenState,
  computeGardenState,
  gardenVariant,
  type GardenInput,
  type GardenKhatmInput,
} from '../index';

const USER_SEED = 20_261_124;
const FIRST_HIZB_OF_FIRST_KHATMA = parseLocalDate('2026-03-01');
const LAST_DAY_OF_FIRST_KHATMA = parseLocalDate('2026-06-30');

/** What the integration layer does with the reading of one khatma. */
function gardenOf(cycle: number, reading: GardenKhatmInput, today: LocalDate): GardenInput {
  return { ...reading, today, pauses: [], variant: gardenVariant(cycle, USER_SEED) };
}

/** The first khatma, finished: read every day of its last week. */
const FIRST_KHATMA_FINISHED: GardenKhatmInput = {
  hizbCompleted: 60,
  currentHizbProgress: 0,
  wateredDays: new Set(
    Array.from({ length: 7 }, (_, index) => addDays(LAST_DAY_OF_FIRST_KHATMA, -index)),
  ),
  firstHizbCompletedOn: FIRST_HIZB_OF_FIRST_KHATMA,
  completedOn: LAST_DAY_OF_FIRST_KHATMA,
};

/** A khatma in which no hizb is finished yet. */
const NO_HIZB_YET: GardenKhatmInput = {
  hizbCompleted: 0,
  currentHizbProgress: 0,
  wateredDays: new Set(),
  firstHizbCompletedOn: null,
  completedOn: null,
};

describe('cycle change: each finished khatma starts a new, different garden', () => {
  it('keeps the finished garden whole, as a badge', () => {
    const badge = completedGardenState(gardenVariant(1, USER_SEED));
    expect(badge.isComplete).toBe(true);
    expect(badge.visibleElements).toHaveLength(60);
    expect(badge.variant.cycle).toBe(1);
  });

  it('leaves the finished garden as it is while the next khatma has no page yet', () => {
    const onLastDay = computeGardenState(
      gardenOf(1, FIRST_KHATMA_FINISHED, LAST_DAY_OF_FIRST_KHATMA),
    );
    expect(onLastDay).toMatchObject({ phase: 'thriving', water: 'flowing', isComplete: true });
    expect(onLastDay.visibleElements).toHaveLength(60);
    for (const daysLater of [1, 14, 400]) {
      const later = addDays(LAST_DAY_OF_FIRST_KHATMA, daysLater);
      expect(computeGardenState(gardenOf(1, FIRST_KHATMA_FINISHED, later))).toEqual(onLastDay);
    }
  });

  it('shows the finished garden exactly as its badge, even when the khatma ended after an absence', () => {
    const finishedAfterAbsence: GardenKhatmInput = {
      ...FIRST_KHATMA_FINISHED,
      // Nothing read during the last three weeks, except the last pages.
      wateredDays: new Set([FIRST_HIZB_OF_FIRST_KHATMA, LAST_DAY_OF_FIRST_KHATMA]),
    };
    const badge = completedGardenState(gardenVariant(1, USER_SEED));
    for (const daysLater of [0, 1, 30]) {
      const today = addDays(LAST_DAY_OF_FIRST_KHATMA, daysLater);
      expect(computeGardenState(gardenOf(1, finishedAfterAbsence, today))).toEqual(badge);
    }
  });

  it('starts the next khatma from a bare earth', () => {
    const state = computeGardenState(gardenOf(2, NO_HIZB_YET, LAST_DAY_OF_FIRST_KHATMA));
    expect(state.phase).toBe('bare');
    expect(state.hizbCompleted).toBe(0);
    expect(state.visibleElements).toEqual([]);
    expect(state.lastUnlocked).toBeNull();
    expect(state.nextElement).toMatchObject({ growth: 0, isVisible: true });
    expect(state.nextElement?.element.id).toBe('channels');
    expect(state.droughtDays).toBe(0);
    expect(state.health).toBe(1);
  });

  it('grows a garden different from the previous one', () => {
    const previous = completedGardenState(gardenVariant(1, USER_SEED)).variant;
    const next = computeGardenState(gardenOf(2, NO_HIZB_YET, LAST_DAY_OF_FIRST_KHATMA)).variant;
    expect(next.cycle).toBe(2);
    expect(next.themeId).not.toBe(previous.themeId);
    expect(next.seed).not.toBe(previous.seed);
  });

  it('waits without damage until its first hizb, however long, read or not', () => {
    const firstPages: GardenKhatmInput = {
      ...NO_HIZB_YET,
      currentHizbProgress: 0.3,
      wateredDays: new Set([addDays(LAST_DAY_OF_FIRST_KHATMA, 1)]),
    };
    for (const daysLater of [1, 14, 400]) {
      const today = addDays(LAST_DAY_OF_FIRST_KHATMA, daysLater);
      const state = computeGardenState(gardenOf(2, firstPages, today));
      expect(state.phase).toBe('bare');
      expect(state.droughtDays).toBe(0);
      expect(state.missedDaysInARow).toBe(0);
      expect(state.nextElement).toMatchObject({ growth: 0.3, isVisible: true });
    }
  });

  it('is born at full health with its first hizb, whatever the state of the previous garden', () => {
    const firstHizbDay = addDays(LAST_DAY_OF_FIRST_KHATMA, 45);
    const reading: GardenKhatmInput = {
      hizbCompleted: 1,
      currentHizbProgress: 0.2,
      // Days of the previous khatma, then nothing for 45 days, then the first hizb.
      wateredDays: new Set([...FIRST_KHATMA_FINISHED.wateredDays, firstHizbDay]),
      firstHizbCompletedOn: firstHizbDay,
      completedOn: null,
    };
    const state = computeGardenState(gardenOf(2, reading, firstHizbDay));
    expect(state.droughtDays).toBe(0);
    expect(state.phase).toBe('thriving');
    expect(state.water).toBe('flowing');
    expect(state.missedDaysInARow).toBe(0);
  });

  it('counts against the new garden only the days after its first hizb', () => {
    const firstHizbDay = addDays(LAST_DAY_OF_FIRST_KHATMA, 20);
    const reading: GardenKhatmInput = {
      hizbCompleted: 1,
      currentHizbProgress: 0,
      wateredDays: new Set([LAST_DAY_OF_FIRST_KHATMA, firstHizbDay]),
      firstHizbCompletedOn: firstHizbDay,
      completedOn: null,
    };
    const state = computeGardenState(gardenOf(2, reading, addDays(firstHizbDay, 2)));
    // Only the day after the first hizb is missed.
    expect(state.missedDaysInARow).toBe(1);
    expect(state.droughtDays).toBe(1);
    expect(state.daysSinceLastWatered).toBe(2);
  });

  it('handles the day a khatma ends and the next one starts: a bare earth already growing', () => {
    const reading: GardenKhatmInput = {
      ...NO_HIZB_YET,
      currentHizbProgress: 0.1,
      wateredDays: new Set([LAST_DAY_OF_FIRST_KHATMA]),
    };
    const state = computeGardenState(gardenOf(2, reading, LAST_DAY_OF_FIRST_KHATMA));
    expect(state.phase).toBe('bare');
    expect(state.daysSinceLastWatered).toBe(0);
    expect(state.nextElement).toMatchObject({ growth: 0.1, isVisible: true });
  });

  it('never changes the badges already earned when a new khatma starts', () => {
    const badgesBefore = [1, 2, 3].map((cycle) =>
      completedGardenState(gardenVariant(cycle, USER_SEED)),
    );
    computeGardenState(gardenOf(4, NO_HIZB_YET, LAST_DAY_OF_FIRST_KHATMA));
    const badgesAfter = [1, 2, 3].map((cycle) =>
      completedGardenState(gardenVariant(cycle, USER_SEED)),
    );
    expect(badgesAfter).toEqual(badgesBefore);
  });
});
