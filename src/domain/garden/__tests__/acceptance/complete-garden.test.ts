/**
 * Acceptance tests of docs/specs/garden.md, rule "Jardin complet": from `completedOn` on,
 * the garden is shown in full health and nothing changes until the next khatma.
 * Histories use the notation of acceptance-kit.ts.
 */
import {
  completedGardenState,
  computeGardenState,
  forecastGardenWithoutReading,
  GARDEN_CATALOG,
  gardenVariant,
  REFERENCE_GARDEN_VARIANT,
  type GardenInput,
  type GardenState,
} from '@/domain/garden';
import { addDays, type LocalDate } from '@/domain/shared/local-date';

import { errorThrownBy, FIRST_DAY, historyInput } from './acceptance-kit';

/** A finished khatma seen `daysAfter` days after its last day, nothing read since. */
function completeInput(historyUntilCompletion: string, daysAfter: number): GardenInput {
  const completedOn = addDays(FIRST_DAY, historyUntilCompletion.length - 1);
  const history =
    daysAfter === 0
      ? historyUntilCompletion
      : historyUntilCompletion + 'M'.repeat(daysAfter - 1) + '.';
  return historyInput(history, { hizbCompleted: 60, currentHizbProgress: 0, completedOn });
}

function expectFullGarden(state: GardenState): void {
  expect(state.hizbCompleted).toBe(60);
  expect(state.isComplete).toBe(true);
  expect(state.droughtDays).toBe(0);
  expect(state.health).toBe(1);
  expect(state.phase).toBe('thriving');
  expect(state.water).toBe('flowing');
  expect(state.visibleElements).toEqual(GARDEN_CATALOG);
  expect(state.lastUnlocked).toEqual(GARDEN_CATALOG[59]);
  expect(state.nextElement).toBeNull();
}

describe('complete garden: full health from the day of completion', () => {
  it.each([
    ['a perfect reader', 'W'.repeat(120)],
    ['thirsty the day before', 'W' + 'MMM' + 'W'],
    ['wilting the day before', 'W' + 'M'.repeat(8) + 'W'],
    ['dying the day before', 'W' + 'M'.repeat(12) + 'W'],
    ['dead for a year before', 'W' + 'M'.repeat(365) + 'W'],
    ['never watered at all', 'M'.repeat(20) + 'M'],
    ['paused on the day of completion', 'W' + 'M'.repeat(20) + 'P'],
    ['first hizb and completion on the same day', 'W'],
  ])('%s: full garden on the day of completion', (_name, history) => {
    expectFullGarden(computeGardenState(completeInput(history, 0)));
  });

  it.each([1, 2, 3, 6, 10, 14, 15, 30, 365, 3650])(
    'full garden %i days after the completion, nothing read',
    (daysAfter) => {
      expectFullGarden(computeGardenState(completeInput('W' + 'M'.repeat(20) + 'W', daysAfter)));
    },
  );

  it('nothing changes: the state of every later day equals the state of the day of completion', () => {
    const history = 'W' + 'M'.repeat(20) + 'W';
    const onTheDay = computeGardenState(completeInput(history, 0));
    for (const daysAfter of [1, 2, 3, 4, 13, 14, 15, 30, 365]) {
      expect(computeGardenState(completeInput(history, daysAfter))).toEqual(onTheDay);
    }
  });

  it('reading after the completion (same khatma still shown) changes nothing either', () => {
    const history = 'W' + 'M'.repeat(20) + 'W';
    const completedOn = addDays(FIRST_DAY, history.length - 1);
    const options = { hizbCompleted: 60, currentHizbProgress: 0, completedOn };
    expectFullGarden(computeGardenState(historyInput(history + 'MMMMW', options)));
    expectFullGarden(computeGardenState(historyInput(history + 'WWWW.', options)));
  });

  it('pauses do not change a complete garden', () => {
    const history = 'W'.repeat(10);
    const completedOn = addDays(FIRST_DAY, history.length - 1);
    const state = computeGardenState(
      historyInput(history + 'PPPPMMMM.', {
        hizbCompleted: 60,
        currentHizbProgress: 0,
        completedOn,
      }),
    );
    expectFullGarden(state);
  });

  it('the forecast of a complete garden is the same full garden every day', () => {
    const forecast = forecastGardenWithoutReading(completeInput('W' + 'M'.repeat(20) + 'W', 0), 30);
    expect(forecast).toHaveLength(30);
    for (const forecastDay of forecast) expectFullGarden(forecastDay.state);
  });

  it('the day before completion the garden was what its history says (59 hizb, dying)', () => {
    // Same reader, the evening before: 12 missed days, 59 hizb. ceil(59 × 2 / 5) = 24.
    const state = computeGardenState(
      historyInput('W' + 'M'.repeat(12) + '.', { hizbCompleted: 59, currentHizbProgress: 0.9 }),
    );
    expect(state.phase).toBe('dying');
    expect(state.visibleElements).toHaveLength(24);
    expect(state.isComplete).toBe(false);
  });
});

describe('completedGardenState: the garden of a badge', () => {
  it('is the full garden of the reference variant', () => {
    const state = completedGardenState(REFERENCE_GARDEN_VARIANT);
    expectFullGarden(state);
    expect(state.missedDaysInARow).toBe(0);
    expect(state.variant).toEqual(REFERENCE_GARDEN_VARIANT);
  });

  it('is what computeGardenState shows from the day of completion on', () => {
    const badge = completedGardenState(REFERENCE_GARDEN_VARIANT);
    const history = 'W' + 'M'.repeat(20) + 'W';
    for (const daysAfter of [0, 1, 30]) {
      const shown = computeGardenState(completeInput(history, daysAfter));
      // The picture is the same; only the journal facts of the day may differ.
      expect({
        ...shown,
        daysSinceLastWatered: null,
        isPausedToday: false,
      }).toEqual({ ...badge, daysSinceLastWatered: null, isPausedToday: false });
    }
  });

  it('is the same garden each time it is asked for', () => {
    const variant = gardenVariant(3, 123_456);
    expect(completedGardenState(variant)).toEqual(completedGardenState(variant));
  });
});

describe('complete garden and odd dates', () => {
  const history = 'W' + 'M'.repeat(20) + 'W';
  const completedOn: LocalDate = addDays(FIRST_DAY, history.length - 1);

  it('today one day before completedOn (time-zone change): no error, still the 60 hizb', () => {
    const input: GardenInput = { ...completeInput(history, 0), today: addDays(completedOn, -1) };
    const state = computeGardenState(input);
    expect(state.hizbCompleted).toBe(60);
    expect(state.isComplete).toBe(true);
    expect(state.nextElement).toBeNull();
  });

  it('today one day before completedOn (time-zone change): the finished khatma is not shown dying', () => {
    // The khatma IS finished (60 hizb, completedOn set). Stepping back one calendar day
    // must not turn the celebration into a dead earth.
    const input: GardenInput = { ...completeInput(history, 0), today: addDays(completedOn, -1) };
    const state = computeGardenState(input);
    expect(state.phase).toBe('thriving');
    expect(state.visibleElements).toHaveLength(60);
  });

  it('60 hizb whose completedOn is not recorded: a garden is never both complete and dying', () => {
    // The spec refuses "completedOn without the 60 hizb" but says nothing of the reverse.
    // Whatever is decided (an error, or the full garden), "isComplete, dying, 36 elements of
    // 60" is not what a finished khatma should show (here: 14 − 3 = 11, ceil(60 × 3 / 5) = 36).
    const input: GardenInput = { ...completeInput(history, 0), completedOn: null };
    const state =
      errorThrownBy(() => computeGardenState(input)) === undefined
        ? computeGardenState(input)
        : null;
    if (state !== null) {
      expect(state.isComplete).toBe(true);
      expect([state.phase, state.visibleElements.length]).toEqual(['thriving', 60]);
    }
  });
});
