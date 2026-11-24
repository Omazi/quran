/**
 * Acceptance tests of the scenarios listed at the end of docs/specs/garden.md ("Propriétés à
 * garantir par les tests"), one test per scenario, named after it.
 * Histories use the notation of acceptance-kit.ts.
 */
import {
  completedGardenState,
  computeGardenState,
  REFERENCE_GARDEN_VARIANT,
  type GardenInput,
} from '@/domain/garden';
import { addDays } from '@/domain/shared/local-date';

import { day, FIRST_DAY, historyInput } from './acceptance-kit';

const TWELVE_WATERED_DAYS = 'W'.repeat(12);

describe('scenario: hizb 24, watered 12 days in a row, then left alone', () => {
  it('watered 12 days in a row: thriving, water flowing, last element springs, next tree-12 (orange)', () => {
    const state = computeGardenState(historyInput(TWELVE_WATERED_DAYS));
    expect(state.phase).toBe('thriving');
    expect(state.water).toBe('flowing');
    expect(state.droughtDays).toBe(0);
    expect(state.health).toBe(1);
    expect(state.hizbCompleted).toBe(24);
    expect(state.visibleElements).toHaveLength(24);
    expect(state.lastUnlocked).toMatchObject({ hizb: 24, id: 'springs', kind: 'springs' });
    expect(state.nextElement?.element).toMatchObject({ hizb: 25, id: 'tree-12', kind: 'orange' });
    expect(state.nextElement?.growth).toBe(0.5);
    expect(state.nextElement?.isVisible).toBe(true);
    expect(state.missedDaysInARow).toBe(0);
    expect(state.daysSinceLastWatered).toBe(0);
    expect(state.isComplete).toBe(false);
    expect(state.isPausedToday).toBe(false);
    expect(state.variant).toEqual(REFERENCE_GARDEN_VARIANT);
  });

  it('3 missed days: thirsty, water dry, drought 3', () => {
    const state = computeGardenState(historyInput(TWELVE_WATERED_DAYS + 'MMM' + '.'));
    expect(state.phase).toBe('thirsty');
    expect(state.water).toBe('dry');
    expect(state.droughtDays).toBe(3);
    expect(state.health).toBeCloseTo(11 / 14, 12);
    expect(state.visibleElements).toHaveLength(24);
  });

  it('6 missed days: wilting', () => {
    const state = computeGardenState(historyInput(TWELVE_WATERED_DAYS + 'M'.repeat(6) + '.'));
    expect(state.phase).toBe('wilting');
    expect(state.droughtDays).toBe(6);
    expect(state.visibleElements).toHaveLength(24);
  });

  it('10 missed days: dying, 80 % of the elements (20 of 24)', () => {
    const state = computeGardenState(historyInput(TWELVE_WATERED_DAYS + 'M'.repeat(10) + '.'));
    expect(state.phase).toBe('dying');
    expect(state.droughtDays).toBe(10);
    expect(state.visibleElements).toHaveLength(20);
    expect(state.visibleElements[19]?.hizb).toBe(20);
    expect(state.nextElement?.isVisible).toBe(false);
  });

  it('14 missed days: dead, no element, hizbCompleted still 24', () => {
    const state = computeGardenState(historyInput(TWELVE_WATERED_DAYS + 'M'.repeat(14) + '.'));
    expect(state.phase).toBe('dead');
    expect(state.droughtDays).toBe(14);
    expect(state.health).toBe(0);
    expect(state.visibleElements).toEqual([]);
    expect(state.hizbCompleted).toBe(24);
    expect(state.lastUnlocked?.id).toBe('springs');
    expect(state.water).toBe('dry');
  });

  it('then one day of reading: drought 11, water flowing', () => {
    const state = computeGardenState(historyInput(TWELVE_WATERED_DAYS + 'M'.repeat(14) + 'W'));
    expect(state.droughtDays).toBe(11);
    expect(state.water).toBe('flowing');
    expect(state.phase).toBe('dying');
    // ceil(24 × (14 − 11) / 5) = ceil(14.4) = 15
    expect(state.visibleElements).toHaveLength(15);
    expect(state.hizbCompleted).toBe(24);
  });

  it('the hizb read are never lost, however long the absence', () => {
    const state = computeGardenState(historyInput(TWELVE_WATERED_DAYS + 'M'.repeat(700) + '.'));
    expect(state.hizbCompleted).toBe(24);
    expect(state.lastUnlocked?.id).toBe('springs');
    expect(state.nextElement?.element.id).toBe('tree-12');
    expect(state.nextElement?.growth).toBe(0.5);
  });
});

describe('scenario: a single hizb, finished after a month of absence', () => {
  // The user read for three days, stopped for 31 days, then came back and finished hizb 1.
  const firstHizbDay = day('2026-04-10');
  const readBefore = [day('2026-03-07'), day('2026-03-08'), day('2026-03-09')];

  function inputOn(today: string): GardenInput {
    return {
      hizbCompleted: 1,
      currentHizbProgress: 0,
      wateredDays: new Set([...readBefore, firstHizbDay]),
      firstHizbCompletedOn: firstHizbDay,
      completedOn: null,
      today: day(today),
      pauses: [],
      variant: REFERENCE_GARDEN_VARIANT,
    };
  }

  it('the garden is born in full health', () => {
    const state = computeGardenState(inputOn('2026-04-10'));
    expect(state.droughtDays).toBe(0);
    expect(state.health).toBe(1);
    expect(state.phase).toBe('thriving');
    expect(state.water).toBe('flowing');
    expect(state.missedDaysInARow).toBe(0);
    expect(state.visibleElements.map((element) => element.id)).toEqual(['channels']);
    expect(state.nextElement).toMatchObject({ growth: 0, isVisible: true });
  });

  it('and the absence of before is not held against it on the following days', () => {
    expect(computeGardenState(inputOn('2026-04-11')).droughtDays).toBe(0);
    // 11 and 12 April missed, the 13th is today.
    expect(computeGardenState(inputOn('2026-04-13')).droughtDays).toBe(2);
  });

  it('the day before, the earth was bare and not dead', () => {
    const state = computeGardenState({
      ...inputOn('2026-04-09'),
      hizbCompleted: 0,
      currentHizbProgress: 0.6,
      wateredDays: new Set(readBefore),
      firstHizbCompletedOn: null,
    });
    expect(state.phase).toBe('bare');
    expect(state.health).toBe(1);
  });
});

describe('scenario: complete garden, then a month without reading', () => {
  const completedOn = addDays(FIRST_DAY, 99);
  // 100 days of reading, the last one finishes the khatma.
  const reading = 'W'.repeat(100);

  it('unchanged', () => {
    const onTheDay = computeGardenState(
      historyInput(reading, { hizbCompleted: 60, currentHizbProgress: 0, completedOn }),
    );
    const aMonthLater = computeGardenState(
      historyInput(reading + 'M'.repeat(30) + '.', {
        hizbCompleted: 60,
        currentHizbProgress: 0,
        completedOn,
      }),
    );
    expect(aMonthLater.droughtDays).toBe(0);
    expect(aMonthLater.health).toBe(1);
    expect(aMonthLater.phase).toBe('thriving');
    expect(aMonthLater.water).toBe('flowing');
    expect(aMonthLater.visibleElements).toHaveLength(60);
    expect(aMonthLater.isComplete).toBe(true);
    // "plus rien ne change jusqu'à la khatma suivante"
    expect(aMonthLater).toEqual(onTheDay);
  });
});

describe('scenario: khatma finished after an absence', () => {
  it('complete garden in full health, not dying', () => {
    // 20 missed days (dead earth), then the day of reading that finishes the khatma.
    // Without the rule of the complete garden this would be 14 − 3 = 11: dying.
    const history = 'W' + 'M'.repeat(20) + 'W';
    const completedOn = addDays(FIRST_DAY, history.length - 1);
    const state = computeGardenState(
      historyInput(history, { hizbCompleted: 60, currentHizbProgress: 0, completedOn }),
    );
    expect(state.droughtDays).toBe(0);
    expect(state.health).toBe(1);
    expect(state.phase).toBe('thriving');
    expect(state.water).toBe('flowing');
    expect(state.visibleElements).toHaveLength(60);
    expect(state.isComplete).toBe(true);
    expect(state.nextElement).toBeNull();
  });

  it('the badge of the same khatma shows a complete garden too', () => {
    const badge = completedGardenState(REFERENCE_GARDEN_VARIANT);
    expect(badge.visibleElements).toHaveLength(60);
    expect(badge.health).toBe(1);
    expect(badge.droughtDays).toBe(0);
    expect(badge.water).toBe('flowing');
  });
});

describe('scenario: a single element, dead garden, then one day of reading', () => {
  it('the element is visible again', () => {
    const dead = computeGardenState(historyInput('W' + 'M'.repeat(14) + '.', { hizbCompleted: 1 }));
    expect(dead.phase).toBe('dead');
    expect(dead.visibleElements).toEqual([]);

    const revived = computeGardenState(
      historyInput('W' + 'M'.repeat(14) + 'W', { hizbCompleted: 1 }),
    );
    // 14 − 3 = 11 ; ceil(1 × (14 − 11) / 5) = ceil(0.6) = 1
    expect(revived.droughtDays).toBe(11);
    expect(revived.visibleElements.map((element) => element.id)).toEqual(['channels']);
    expect(revived.water).toBe('flowing');
  });

  it.each([2, 3, 4, 5, 7, 59])(
    'with %i elements, the first reading after death always brings at least one back',
    (hizbCompleted) => {
      const revived = computeGardenState(
        historyInput('W' + 'M'.repeat(60) + 'W', { hizbCompleted }),
      );
      expect(revived.visibleElements.length).toBeGreaterThanOrEqual(1);
      expect(revived.visibleElements[0]?.id).toBe('channels');
    },
  );
});
