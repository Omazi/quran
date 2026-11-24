/**
 * Acceptance tests of docs/specs/garden.md, section "Entrées invalides": everything the spec
 * lists is refused with an explicit error (RangeError or TypeError, docs/CONTRIBUTING.md),
 * and nothing else is, in particular no date "in the future".
 */
import {
  computeGardenState,
  DEFAULT_GARDEN_CONFIG,
  forecastGardenWithoutReading,
  REFERENCE_GARDEN_VARIANT,
  type GardenConfig,
  type GardenInput,
} from '@/domain/garden';
import { addDays, type LocalDate } from '@/domain/shared/local-date';

import {
  bareEarthInput,
  day,
  errorThrownBy,
  expectExplicitError,
  FIRST_DAY,
  historyInput,
} from './acceptance-kit';

const TODAY = addDays(FIRST_DAY, 3);

/** A valid living garden; each test breaks one thing in it. */
const VALID: GardenInput = historyInput('WWM.');

/** A valid complete garden. */
const VALID_COMPLETE: GardenInput = historyInput('WWM.', {
  hizbCompleted: 60,
  currentHizbProgress: 0,
  completedOn: addDays(FIRST_DAY, 1),
});

/** A valid bare earth. */
const VALID_BARE: GardenInput = bareEarthInput(TODAY, [addDays(TODAY, -1)]);

describe('the three valid gardens of this suite are accepted', () => {
  it.each([
    ['living', VALID],
    ['complete', VALID_COMPLETE],
    ['bare', VALID_BARE],
  ])('%s', (_name, input) => {
    expect(errorThrownBy(() => computeGardenState(input))).toBeUndefined();
    expect(errorThrownBy(() => forecastGardenWithoutReading(input, 5))).toBeUndefined();
  });
});

describe('invalid: hizbCompleted outside 0..60 or not a whole number', () => {
  it.each([-1, 61, 1000, -60, 1.5, 23.999, 0.5, Number.NaN, Number.POSITIVE_INFINITY, -Infinity])(
    'hizbCompleted %d on a living garden',
    (hizbCompleted) => {
      expectExplicitError(() => computeGardenState({ ...VALID, hizbCompleted }), /hizb/i);
    },
  );

  it('61 is refused even when everything else describes a finished khatma', () => {
    expectExplicitError(
      () => computeGardenState({ ...VALID_COMPLETE, hizbCompleted: 61 }),
      /hizb/i,
    );
  });

  it('-1 is refused even when everything else describes a bare earth', () => {
    expectExplicitError(() => computeGardenState({ ...VALID_BARE, hizbCompleted: -1 }), /hizb/i);
  });

  it.each([0, 1, 59, 60])('the bounds are accepted: %i', (hizbCompleted) => {
    const input = hizbCompleted === 0 ? VALID_BARE : hizbCompleted === 60 ? VALID_COMPLETE : VALID;
    const state = computeGardenState({ ...input, hizbCompleted });
    expect(state.hizbCompleted).toBe(hizbCompleted);
  });
});

describe('invalid: currentHizbProgress outside 0..1', () => {
  it.each([-0.000001, 1.000001, -1, 2, 100, Number.NaN, Number.POSITIVE_INFINITY, -Infinity])(
    'currentHizbProgress %d',
    (currentHizbProgress) => {
      expectExplicitError(
        () => computeGardenState({ ...VALID, currentHizbProgress }),
        /progress|fraction/i,
      );
      expectExplicitError(
        () => computeGardenState({ ...VALID_BARE, currentHizbProgress }),
        /progress|fraction/i,
      );
    },
  );

  it.each([0, 1, 0.5, Number.MIN_VALUE, 1 - Number.EPSILON])(
    'the bounds are accepted: %d',
    (currentHizbProgress) => {
      const state = computeGardenState({ ...VALID, currentHizbProgress });
      expect(state.nextElement?.growth).toBe(currentHizbProgress);
    },
  );
});

describe('invalid: firstHizbCompletedOn must be there exactly when a hizb is finished', () => {
  it.each([1, 24, 59])('absent with %i finished hizb', (hizbCompleted) => {
    expectExplicitError(
      () => computeGardenState({ ...VALID, hizbCompleted, firstHizbCompletedOn: null }),
      /firstHizbCompletedOn/,
    );
  });

  it('absent on a finished khatma', () => {
    expectExplicitError(
      () => computeGardenState({ ...VALID_COMPLETE, firstHizbCompletedOn: null }),
      /firstHizbCompletedOn/,
    );
  });

  it('present while no hizb is finished', () => {
    expectExplicitError(
      () => computeGardenState({ ...VALID_BARE, firstHizbCompletedOn: FIRST_DAY }),
      /firstHizbCompletedOn/,
    );
  });
});

describe('invalid: completedOn without the 60 hizb', () => {
  it.each([59, 24, 1])('present with %i finished hizb', (hizbCompleted) => {
    expectExplicitError(
      () => computeGardenState({ ...VALID, hizbCompleted, completedOn: TODAY }),
      /completedOn/,
    );
  });

  it('present on a bare earth', () => {
    expectExplicitError(
      () => computeGardenState({ ...VALID_BARE, completedOn: TODAY }),
      /completedOn/,
    );
  });
});

describe('invalid: a pause whose end is before its start', () => {
  const backwards = { from: addDays(FIRST_DAY, 2), to: addDays(FIRST_DAY, 1) };

  it.each([
    ['a living garden', VALID],
    ['a bare earth', VALID_BARE],
    ['a complete garden', VALID_COMPLETE],
  ])('on %s', (_name, input) => {
    expectExplicitError(() => computeGardenState({ ...input, pauses: [backwards] }), /pause/i);
  });

  it('hidden among valid pauses', () => {
    const pauses = [
      { from: FIRST_DAY, to: FIRST_DAY },
      { from: addDays(FIRST_DAY, 1), to: addDays(FIRST_DAY, 2) },
      backwards,
      { from: addDays(FIRST_DAY, 1), to: addDays(FIRST_DAY, 9) },
    ];
    expectExplicitError(() => computeGardenState({ ...VALID, pauses }), /pause/i);
  });

  it('even when it lies entirely before the garden or after today', () => {
    const longBefore = { from: addDays(FIRST_DAY, -100), to: addDays(FIRST_DAY, -200) };
    const longAfter = { from: addDays(TODAY, 200), to: addDays(TODAY, 100) };
    expectExplicitError(() => computeGardenState({ ...VALID, pauses: [longBefore] }), /pause/i);
    expectExplicitError(() => computeGardenState({ ...VALID, pauses: [longAfter] }), /pause/i);
  });

  it('across a year change (a comparison of text would not be fooled, a comparison of day-of-month would)', () => {
    const pause = { from: day('2027-01-01'), to: day('2026-12-31') };
    expectExplicitError(() => computeGardenState({ ...VALID, pauses: [pause] }), /pause/i);
  });

  it('a pause of a single day (from = to) is valid', () => {
    const pauses = [{ from: TODAY, to: TODAY }];
    expect(computeGardenState({ ...VALID, pauses }).isPausedToday).toBe(true);
  });
});

describe('invalid: incoherent configuration', () => {
  function withConfig(change: Partial<GardenConfig>): GardenInput {
    return { ...VALID, config: { ...DEFAULT_GARDEN_CONFIG, ...change } };
  }

  it.each([
    ['droughtDaysToDeath 0', { droughtDaysToDeath: 0 }],
    ['droughtDaysToDeath negative', { droughtDaysToDeath: -14 }],
    ['droughtDaysToDeath not whole', { droughtDaysToDeath: 14.5 }],
    ['droughtDaysToDeath NaN', { droughtDaysToDeath: Number.NaN }],
    ['droughtDaysToDeath infinite', { droughtDaysToDeath: Number.POSITIVE_INFINITY }],
    ['recovery negative (reading would harm)', { droughtDaysRecoveredPerWateredDay: -1 }],
    ['recovery not whole', { droughtDaysRecoveredPerWateredDay: 2.5 }],
    ['recovery NaN', { droughtDaysRecoveredPerWateredDay: Number.NaN }],
    ['thirsty after wilting', { thirstyMinDroughtDays: 7 }],
    ['wilting after dying', { wiltingMinDroughtDays: 11 }],
    ['dying after death', { dyingMinDroughtDays: 15 }],
    ['thirsty negative', { thirstyMinDroughtDays: -1 }],
    ['thirsty not whole', { thirstyMinDroughtDays: 2.5 }],
    ['wilting NaN', { wiltingMinDroughtDays: Number.NaN }],
    ['dying not whole', { dyingMinDroughtDays: 10.5 }],
    ['dry water threshold negative', { dryWaterMinMissedDays: -1 }],
    ['dry water threshold not whole', { dryWaterMinMissedDays: 2.5 }],
    ['dry water threshold NaN', { dryWaterMinMissedDays: Number.NaN }],
  ] as const)('%s', (_name, change) => {
    expectExplicitError(() => computeGardenState(withConfig(change)));
    expectExplicitError(() => forecastGardenWithoutReading(withConfig(change), 3));
  });

  it('an incoherent configuration is refused on a bare earth and on a complete garden too', () => {
    const config = { ...DEFAULT_GARDEN_CONFIG, droughtDaysToDeath: -1 };
    expectExplicitError(() => computeGardenState({ ...VALID_BARE, config }));
    expectExplicitError(() => computeGardenState({ ...VALID_COMPLETE, config }));
  });

  it('the default configuration, given explicitly, is accepted and changes nothing', () => {
    expect(computeGardenState({ ...VALID, config: DEFAULT_GARDEN_CONFIG })).toEqual(
      computeGardenState(VALID),
    );
  });
});

// docs/CONTRIBUTING.md: "Entrées invalides : erreur explicite, jamais de valeur
// silencieusement corrigée". The types forbid these values; a damaged store could hold them.
describe('invalid: values the types forbid', () => {
  // `as`: building on purpose what the compiler refuses.
  const notADate = (value: string): LocalDate => value as LocalDate;

  it.each([
    ['today is not a date', { ...VALID, today: notADate('today') }, /today/],
    ['today is 30 February', { ...VALID, today: notADate('2026-02-30') }, /today/],
    [
      'firstHizbCompletedOn is month 13',
      { ...VALID, firstHizbCompletedOn: notADate('2026-13-01') },
      /firstHizbCompletedOn/,
    ],
    [
      'a watered day is not a date',
      { ...VALID, wateredDays: new Set([FIRST_DAY, notADate('2026-3-1')]) },
      /watered/i,
    ],
    [
      'a pause bound is not a date',
      { ...VALID, pauses: [{ from: FIRST_DAY, to: notADate('') }] },
      /pause/i,
    ],
    [
      'completedOn is not a date',
      { ...VALID_COMPLETE, completedOn: notADate('2026/03/02') },
      /completedOn/,
    ],
  ] as readonly (readonly [string, GardenInput, RegExp])[])('%s', (_name, input, mention) => {
    expectExplicitError(() => computeGardenState(input), mention);
    expectExplicitError(() => forecastGardenWithoutReading(input, 3), mention);
  });
});

describe('never an error for what the spec does not list', () => {
  it.each([
    ['today before firstHizbCompletedOn', { ...VALID, today: addDays(FIRST_DAY, -1) }],
    ['today years before firstHizbCompletedOn', { ...VALID, today: day('2001-01-01') }],
    [
      'a watered day after today',
      { ...VALID, wateredDays: new Set([FIRST_DAY, addDays(TODAY, 1), addDays(TODAY, 300)]) },
    ],
    ['no watered day at all, with hizb finished', { ...VALID, wateredDays: new Set<never>() }],
    ['the first day of the garden not watered', { ...VALID, wateredDays: new Set([TODAY]) }],
    ['no pause', { ...VALID, pauses: [] }],
    [
      'pauses before the garden, after today, overlapping and repeated',
      {
        ...VALID,
        pauses: [
          { from: addDays(FIRST_DAY, -50), to: addDays(FIRST_DAY, -40) },
          { from: addDays(TODAY, 40), to: addDays(TODAY, 50) },
          { from: FIRST_DAY, to: TODAY },
          { from: FIRST_DAY, to: TODAY },
          { from: addDays(FIRST_DAY, 1), to: addDays(TODAY, 100) },
        ],
      },
    ],
    [
      'a pause of a century',
      { ...VALID, pauses: [{ from: day('1990-01-01'), to: day('2090-01-01') }] },
    ],
    ['completedOn after today', { ...VALID_COMPLETE, today: addDays(FIRST_DAY, 0) }],
    ['completedOn on the first day of the garden', { ...VALID_COMPLETE, completedOn: FIRST_DAY }],
    ['growth 1 at hizb 59', { ...VALID, hizbCompleted: 59, currentHizbProgress: 1 }],
    ['bare earth read today', { ...VALID_BARE, wateredDays: new Set([TODAY]) }],
    ['bare earth, nothing ever read', { ...VALID_BARE, wateredDays: new Set<never>() }],
    ['bare earth paused today', { ...VALID_BARE, pauses: [{ from: TODAY, to: TODAY }] }],
  ] as readonly (readonly [string, GardenInput])[])('%s', (_name, input) => {
    expect(errorThrownBy(() => computeGardenState(input))).toBeUndefined();
    expect(errorThrownBy(() => forecastGardenWithoutReading(input, 20))).toBeUndefined();
  });

  it('60 hizb whose completedOn is not known yet: the spec does not list it as invalid', () => {
    // The spec lists "completedOn présent sans les 60 hizb", not the reverse. A home screen
    // that receives 60 hizb before the completion day is recorded must not crash.
    const input: GardenInput = { ...VALID_COMPLETE, completedOn: null };
    expect(errorThrownBy(() => computeGardenState(input))).toBeUndefined();
  });

  it('completedOn before firstHizbCompletedOn: the spec does not list it as invalid', () => {
    const input: GardenInput = { ...VALID_COMPLETE, completedOn: addDays(FIRST_DAY, -1) };
    expect(errorThrownBy(() => computeGardenState(input))).toBeUndefined();
  });

  it('a hizb in progress on a complete garden: the spec does not list it as invalid', () => {
    const input: GardenInput = { ...VALID_COMPLETE, currentHizbProgress: 0.3 };
    expect(errorThrownBy(() => computeGardenState(input))).toBeUndefined();
  });

  it('every variant made by the module is accepted', () => {
    expect(
      errorThrownBy(() => computeGardenState({ ...VALID, variant: REFERENCE_GARDEN_VARIANT })),
    ).toBeUndefined();
  });
});
