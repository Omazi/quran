/**
 * Acceptance tests of the shape of the output (docs/specs/garden.md, "But": a plain
 * `GardenState` any renderer can display) and of purity: the output survives a JSON
 * round-trip, the inputs are never mutated, nothing depends on the clock, and a caller who
 * damages a state it received cannot damage the next ones.
 */
import {
  completedGardenState,
  computeGardenState,
  forecastGardenWithoutReading,
  GARDEN_CATALOG,
  gardenVariant,
  REFERENCE_GARDEN_VARIANT,
  type GardenElement,
  type GardenInput,
  type GardenState,
} from '@/domain/garden';
import { addDays } from '@/domain/shared/local-date';

import { bareEarthInput, day, FIRST_DAY, historyInput } from './acceptance-kit';

const EXPECTED_STATE_FIELDS = [
  'daysSinceLastWatered',
  'droughtDays',
  'health',
  'hizbCompleted',
  'isComplete',
  'isPausedToday',
  'lastUnlocked',
  'missedDaysInARow',
  'nextElement',
  'phase',
  'variant',
  'visibleElements',
  'water',
];

const SAMPLE_INPUTS: readonly (readonly [string, GardenInput])[] = [
  ['bare earth', bareEarthInput(day('2026-03-10'), [day('2026-03-09')])],
  ['thriving, read today', historyInput('WWW')],
  ['thirsty', historyInput('WMMM.')],
  ['wilting, paused today', historyInput('W' + 'M'.repeat(7) + 'P')],
  ['dying', historyInput('W' + 'M'.repeat(12) + '.')],
  ['dead', historyInput('W' + 'M'.repeat(20) + '.')],
  ['never watered', historyInput('MM.')],
  ['one hizb', historyInput('W.', { hizbCompleted: 1, currentHizbProgress: 0 })],
  ['59 hizb', historyInput('W.', { hizbCompleted: 59, currentHizbProgress: 1 })],
  [
    'complete',
    historyInput('WW.', { hizbCompleted: 60, currentHizbProgress: 0, completedOn: FIRST_DAY }),
  ],
  ['another variant', historyInput('WMM.', { variant: gardenVariant(7, 4_000_000_000) })],
];

/** Fails on anything JSON would drop or change: undefined, NaN, Infinity, Date, Set, Map... */
function expectPlainData(value: unknown, path: string): void {
  if (value === null) return;
  if (typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    expect([path, Number.isFinite(value)]).toEqual([path, true]);
    // JSON would turn -0 into 0.
    expect([path, Object.is(value, -0)]).toEqual([path, false]);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => expectPlainData(item, `${path}[${index}]`));
    return;
  }
  expect([path, typeof value]).toEqual([path, 'object']);
  const prototype: unknown = Object.getPrototypeOf(value);
  expect([path, prototype === Object.prototype || prototype === null]).toEqual([path, true]);
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    // `as`: Object.entries of a plain object, checked just above.
    expect([`${path}.${key}`, item === undefined]).toEqual([`${path}.${key}`, false]);
    expectPlainData(item, `${path}.${key}`);
  }
}

describe('the output is plain serializable data', () => {
  it.each(SAMPLE_INPUTS)('%s: survives a JSON round-trip unchanged', (_name, input) => {
    const state = computeGardenState(input);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    expectPlainData(state, 'state');
  });

  it.each(SAMPLE_INPUTS)('%s: has exactly the fields of the spec', (_name, input) => {
    expect(Object.keys(computeGardenState(input)).sort()).toEqual(EXPECTED_STATE_FIELDS);
  });

  it('a forecast survives a JSON round-trip unchanged', () => {
    for (const [, input] of SAMPLE_INPUTS) {
      const forecast = forecastGardenWithoutReading(input, 20);
      expect(JSON.parse(JSON.stringify(forecast))).toEqual(forecast);
      expectPlainData(forecast, 'forecast');
    }
  });

  it('the garden of a badge survives a JSON round-trip unchanged', () => {
    const state = completedGardenState(gardenVariant(12, 987_654_321));
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    expectPlainData(state, 'badge');
    expect(Object.keys(state).sort()).toEqual(EXPECTED_STATE_FIELDS);
  });

  it('a state rebuilt from JSON gives back the same JSON (what a store would persist)', () => {
    const state = computeGardenState(historyInput('W' + 'M'.repeat(12) + '.'));
    const text = JSON.stringify(state);
    // `as`: JSON.parse returns `any`; the round-trip is exactly what is being tested.
    const rebuilt = JSON.parse(text) as GardenState;
    expect(JSON.stringify(rebuilt)).toBe(text);
    expect(rebuilt.visibleElements).toHaveLength(10);
  });

  it('the variant of the output is the variant received', () => {
    const variant = gardenVariant(4, 77);
    expect(computeGardenState(historyInput('W', { variant })).variant).toEqual(variant);
  });
});

/** A Set that refuses to be changed: `Object.freeze` does not protect the content of a Set. */
class ReadOnlySet<Item> extends Set<Item> {
  private isSealed = false;

  constructor(items: readonly Item[]) {
    super(items);
    this.isSealed = true;
  }

  override add(item: Item): this {
    if (this.isSealed) throw new Error('The module tried to add a watered day to its input');
    return super.add(item);
  }

  override delete(_item: Item): boolean {
    throw new Error('The module tried to delete a watered day from its input');
  }

  override clear(): void {
    throw new Error('The module tried to clear the watered days of its input');
  }
}

function deepFreeze<Value>(value: Value): Value {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
}

/** Text picture of an input, to compare before and after a call. */
function pictureOf(input: GardenInput): string {
  return JSON.stringify({ ...input, wateredDays: [...input.wateredDays] });
}

describe('the inputs are never mutated', () => {
  it.each(SAMPLE_INPUTS)('%s: frozen input, sealed set of watered days', (_name, input) => {
    const frozen: GardenInput = deepFreeze({
      ...input,
      wateredDays: new ReadOnlySet([...input.wateredDays]),
      pauses: input.pauses.map((pause) => ({ ...pause })),
      variant: { ...input.variant },
    });
    const before = pictureOf(frozen);

    const state = computeGardenState(frozen);
    const forecast = forecastGardenWithoutReading(frozen, 20);

    expect(pictureOf(frozen)).toBe(before);
    expect(state).toEqual(computeGardenState(input));
    expect(forecast).toEqual(forecastGardenWithoutReading(input, 20));
  });

  it('pauses given out of order are left in the order they were given', () => {
    const pauses = [
      { from: addDays(FIRST_DAY, 4), to: addDays(FIRST_DAY, 5) },
      { from: addDays(FIRST_DAY, 1), to: addDays(FIRST_DAY, 2) },
      { from: addDays(FIRST_DAY, 1), to: addDays(FIRST_DAY, 1) },
    ];
    const copy = pauses.map((pause) => ({ ...pause }));
    computeGardenState({ ...historyInput('WMMMMMM.'), pauses });
    forecastGardenWithoutReading({ ...historyInput('WMMMMMM.'), pauses }, 10);
    expect(pauses).toEqual(copy);
  });

  it('a frozen custom catalogue and a frozen configuration are accepted', () => {
    // A deep copy: freezing must not reach the module's own catalogue.
    // `as`: JSON.parse returns `any`.
    const catalog = deepFreeze(JSON.parse(JSON.stringify(GARDEN_CATALOG)) as GardenElement[]);
    const config = deepFreeze({
      droughtDaysToDeath: 14,
      droughtDaysRecoveredPerWateredDay: 3,
      thirstyMinDroughtDays: 3,
      wiltingMinDroughtDays: 6,
      dyingMinDroughtDays: 10,
      dryWaterMinMissedDays: 3,
    });
    const input = historyInput('WMMM.', { catalog, config });
    expect(computeGardenState(input)).toEqual(computeGardenState(historyInput('WMMM.')));
  });
});

describe('nothing depends on the clock', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('the same input gives the same state whatever the system date', () => {
    const input = historyInput('WMMMM.');
    const forecastNow = forecastGardenWithoutReading(input, 10);
    const stateNow = computeGardenState(input);

    jest.useFakeTimers();
    for (const systemDate of [
      '1999-12-31T23:59:59Z',
      '2026-03-05T00:00:00Z',
      '2099-06-15T12:00:00Z',
    ]) {
      jest.setSystemTime(new Date(systemDate));
      expect(computeGardenState(input)).toEqual(stateNow);
      expect(forecastGardenWithoutReading(input, 10)).toEqual(forecastNow);
      expect(completedGardenState(REFERENCE_GARDEN_VARIANT)).toEqual(
        completedGardenState(REFERENCE_GARDEN_VARIANT),
      );
    }
  });
});

describe('a caller cannot damage the module through a state it received', () => {
  /** What a careless renderer could do to a state: `readonly` only exists at compile time. */
  function damage(state: GardenState): void {
    // `as`: deliberately breaking the readonly contract, as untyped code could.
    const elements = state.visibleElements as GardenElement[];
    const first = elements[0] as { id: string; hizb: number; kind: string } | undefined;
    try {
      if (first !== undefined) {
        first.id = 'damaged';
        first.hizb = 999;
        first.kind = 'damaged';
      }
      elements.reverse();
      elements.length = 0;
    } catch {
      // A frozen state refuses the damage: that is a fine way to pass this test.
    }
  }

  it('damaging a computed state does not change the next computation', () => {
    const input = historyInput('WMM.');
    const reference = JSON.stringify(computeGardenState(input));
    damage(computeGardenState(input));
    expect(JSON.stringify(computeGardenState(input))).toBe(reference);
  });

  it('damaging a badge garden does not change the next one, nor the catalogue', () => {
    const catalogue = JSON.stringify(GARDEN_CATALOG);
    const reference = JSON.stringify(completedGardenState(REFERENCE_GARDEN_VARIANT));
    damage(completedGardenState(REFERENCE_GARDEN_VARIANT));
    expect(JSON.stringify(completedGardenState(REFERENCE_GARDEN_VARIANT))).toBe(reference);
    expect(JSON.stringify(GARDEN_CATALOG)).toBe(catalogue);
  });

  // Last test of the file on purpose: if the damage succeeds, the catalogue of this suite
  // is corrupted (Jest gives every suite its own copy of the module, so only this one).
  it('the published catalogue cannot be corrupted by a caller', () => {
    const catalogue = JSON.stringify(GARDEN_CATALOG);
    const reference = JSON.stringify(computeGardenState(historyInput('WMM.')));
    // `as`: deliberately breaking the readonly contract, as untyped code could.
    const writable = GARDEN_CATALOG as { id: string; hizb: number; kind: string }[];
    try {
      const second = writable[1];
      if (second !== undefined) second.id = 'damaged';
      writable[0] = { id: 'damaged', hizb: 999, kind: 'damaged' };
      writable.length = 3;
    } catch {
      // A frozen catalogue refuses the damage: that is the expected protection.
    }
    expect(JSON.stringify(GARDEN_CATALOG)).toBe(catalogue);
    expect(JSON.stringify(computeGardenState(historyInput('WMM.')))).toBe(reference);
  });
});
