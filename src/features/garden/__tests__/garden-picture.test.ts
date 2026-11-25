import {
  computeGardenState,
  DEFAULT_GARDEN_CONFIG,
  type GardenConfig,
  type GardenState,
} from '@/domain/garden';

import { BARE_TREES_AFTER_WILTING_DAYS, GARDEN_STEP_COUNT } from '../config';
import {
  gardenPicture,
  pictureNames,
  type GardenImageNames,
  type GardenPicture,
} from '../garden-picture';
import { previewGardenState } from '../garden-preview';

const { thirstyMinDroughtDays, wiltingMinDroughtDays, dyingMinDroughtDays, droughtDaysToDeath } =
  DEFAULT_GARDEN_CONFIG;
const BARE_TREES_FROM = wiltingMinDroughtDays + BARE_TREES_AFTER_WILTING_DAYS;

/** The complete set of the level-1 garden, as the tool checks it: written here from the spec. */
function completeSet(): GardenImageNames {
  const base = new Set<string>();
  const water = new Set<string>();
  for (let count = 0; count <= GARDEN_STEP_COUNT; count += 1) {
    for (let foliage = 0; foliage < 4; foliage += 1) {
      const name = `h${String(count).padStart(2, '0')}-f${foliage}`;
      base.add(name);
      if (count >= 1) for (const level of [1, 2]) water.add(`${name}-w${level}`);
    }
  }
  return { base, water };
}
const IMAGES = completeSet();

const after = (daysWithoutReading: number, hizbCompleted = 24): GardenState =>
  previewGardenState({ hizbCompleted, daysWithoutReading });

function pictureOf(state: GardenState, images = IMAGES): GardenPicture {
  const picture = gardenPicture(state, { images });
  if (picture === null) throw new Error('The test needs a picture.');
  return picture;
}

describe('gardenPicture: the number of elements', () => {
  it.each([0, 1, 8, 24, 59, 60])('shows as many elements as the state shows: %i', (hizb) => {
    const state = previewGardenState({ hizbCompleted: hizb });
    expect(pictureOf(state).stage.count).toBe(state.visibleElements.length);
    expect(pictureNames(pictureOf(state)).base).toBe(`h${String(hizb).padStart(2, '0')}-f0`);
  });

  it('shows what is left of a dying garden, not what was earned', () => {
    const dying = after(dyingMinDroughtDays);
    expect(dying.visibleElements.length).toBeLessThan(dying.hizbCompleted);
    expect(pictureOf(dying).stage.count).toBe(dying.visibleElements.length);
  });
});

describe('gardenPicture: the foliage follows the drought, thresholds from the garden config', () => {
  const rows: readonly (readonly [string, number, 0 | 1 | 2 | 3])[] = [
    ['no drought', 0, 0],
    ['the day before the garden is thirsty', thirstyMinDroughtDays - 1, 0],
    ['the first thirsty day', thirstyMinDroughtDays, 1],
    ['the day before the trees lose their leaves', wiltingMinDroughtDays - 1, 1],
    ['the first day the trees lose their leaves', wiltingMinDroughtDays, 2],
    ['the day before every tree is bare', BARE_TREES_FROM - 1, 2],
    ['the first day every tree is bare', BARE_TREES_FROM, 3],
    ['the last day before the garden dies', droughtDaysToDeath - 1, 3],
  ];

  it.each(rows)('%s (%i days)', (_, days, foliage) => {
    const state = after(days);
    expect(state.droughtDays).toBe(days);
    expect(pictureOf(state).stage.foliage).toBe(foliage);
  });

  it('never leaves the trees in leaf in the dying phase, whatever the settings', () => {
    // Every tree must be bare by the time the elements start to disappear.
    const config: GardenConfig = { ...DEFAULT_GARDEN_CONFIG, dyingMinDroughtDays: 7 };
    const state = computeGardenFor(7, config);
    expect(state.phase).toBe('dying');
    expect(gardenPicture(state, { images: IMAGES, config })?.stage.foliage).toBe(3);
  });

  it('reads its thresholds from the config it is given', () => {
    const config: GardenConfig = {
      ...DEFAULT_GARDEN_CONFIG,
      thirstyMinDroughtDays: 1,
      wiltingMinDroughtDays: 2,
      dyingMinDroughtDays: 12,
    };
    const state = computeGardenFor(1, config);
    expect(gardenPicture(state, { images: IMAGES, config })?.stage.foliage).toBe(1);
    expect(gardenPicture(state, { images: IMAGES })?.stage.foliage).toBe(0);
  });
});

/** A garden of 24 hizb read on its first day only, after `days` missed days. */
function computeGardenFor(days: number, config: GardenConfig): GardenState {
  const first = '2026-01-01';
  const today = new Date(Date.UTC(2026, 0, 1 + days + 1)).toISOString().slice(0, 10);
  return computeGardenState({
    hizbCompleted: 24,
    currentHizbProgress: 0,
    wateredDays: new Set([first as never]),
    firstHizbCompletedOn: first as never,
    completedOn: null,
    today: today as never,
    pauses: [],
    variant: previewGardenState({ hizbCompleted: 24 }).variant,
    config,
  });
}

describe('gardenPicture: the water', () => {
  it('shows the water flowing on a watered garden', () => {
    const state = after(0);
    expect(state.water).toBe('flowing');
    expect(pictureOf(state).stage.water).toBe(2);
    expect(pictureNames(pictureOf(state)).water).toBe('h24-f0-w2');
  });

  it('shows it still after the first missed days, when the water leaves first', () => {
    const state = after(1);
    expect(state.water).toBe('still');
    expect(pictureOf(state).stage.water).toBe(1);
    expect(pictureOf(state).stage.foliage).toBe(0);
    expect(pictureNames(pictureOf(state)).water).toBe('h24-f0-w1');
  });

  it('shows no water once it is dry', () => {
    const state = after(DEFAULT_GARDEN_CONFIG.dryWaterMinMissedDays);
    expect(state.water).toBe('dry');
    expect(pictureOf(state).stage.water).toBe(0);
    expect(pictureNames(pictureOf(state)).water).toBeNull();
  });

  it('shows water on a garden that is coming back to life: water flowing, trees still bare', () => {
    const revived = previewGardenState({
      hizbCompleted: 40,
      daysWithoutReading: droughtDaysToDeath,
      readsToday: true,
    });
    expect(revived.water).toBe('flowing');
    const picture = pictureOf(revived);
    expect(picture.stage).toEqual({
      count: revived.visibleElements.length,
      foliage: 3,
      water: 2,
    });
  });

  it('has no water on the bare earth, which has no channel yet', () => {
    const picture = pictureOf(previewGardenState({ hizbCompleted: 0 }));
    expect(picture.stage).toEqual({ count: 0, foliage: 0, water: 0 });
    expect(pictureNames(picture)).toEqual({ base: 'h00-f0', water: null });
  });

  it('never asks for water at 0 elements, even if the state says so', () => {
    const state: GardenState = { ...after(0), visibleElements: [] };
    expect(pictureOf(state).stage.water).toBe(0);
  });
});

describe('gardenPicture: the dead earth', () => {
  it('shows the dead earth for a dead garden, whatever it had earned', () => {
    const dead = after(droughtDaysToDeath);
    expect(dead.phase).toBe('dead');
    expect(dead.hizbCompleted).toBe(24);
    expect(dead.visibleElements).toHaveLength(0);
    expect(pictureNames(pictureOf(dead))).toEqual({ base: 'h00-f3', water: null });
  });

  it('is not the bare earth: both have no element, the foliage tells them apart', () => {
    const bare = pictureNames(pictureOf(after(0, 0))).base;
    expect(bare).toBe('h00-f0');
    expect(bare).not.toBe(pictureNames(pictureOf(after(droughtDaysToDeath))).base);
  });
});

describe('gardenPicture: the element that grows is not drawn (D35)', () => {
  function growing(state: GardenState, growth: number): GardenState {
    if (state.nextElement === null) throw new Error('The test needs a next element.');
    return { ...state, nextElement: { ...state.nextElement, growth } };
  }

  it.each([0.1, 0.4, 0.99, 1])('shows no half-grown element, at a growth of %s', (growth) => {
    const state = growing(after(0), growth);
    const picture = pictureOf(state);
    expect(picture).toEqual({ stage: pictureOf(after(0)).stage });
    expect(picture.stage.count).toBe(24);
    expect(pictureNames(picture)).toEqual({ base: 'h24-f0', water: 'h24-f0-w2' });
  });

  it('keeps the growth in the garden state, for the words', () => {
    expect(growing(after(0), 0.4).nextElement?.growth).toBe(0.4);
  });

  it('shows the element once its hizb is complete', () => {
    expect(pictureOf(after(0, 25)).stage.count).toBe(25);
  });
});

describe('gardenPicture: an incomplete set of pictures', () => {
  it('gives no picture, so that the scene shows its neutral placeholder', () => {
    const base = new Set(IMAGES.base);
    base.delete('h24-f0');
    expect(gardenPicture(after(0), { images: { base, water: IMAGES.water } })).toBeNull();
  });

  it('gives none either when the water the state asks for is missing', () => {
    const water = new Set(IMAGES.water);
    water.delete('h24-f0-w2');
    expect(gardenPicture(after(0), { images: { base: IMAGES.base, water } })).toBeNull();
    // A dry garden does not need it.
    expect(gardenPicture(after(3), { images: { base: IMAGES.base, water } })).not.toBeNull();
  });

  it('gives none for an empty set, and never throws', () => {
    const empty = { base: new Set<string>(), water: new Set<string>() };
    expect(gardenPicture(after(0), { images: empty })).toBeNull();
  });
});

describe('gardenPicture: the garden module decides, the picture shows', () => {
  it('finds a picture for every state the garden module can produce', () => {
    // Every number of hizb, every drought, reading or not on the last day: nothing is missed.
    for (let hizb = 0; hizb <= GARDEN_STEP_COUNT; hizb += 1) {
      for (let days = 0; days <= droughtDaysToDeath + 2; days += 1) {
        for (const readsToday of [false, true]) {
          const state = previewGardenState({
            hizbCompleted: hizb,
            daysWithoutReading: days,
            readsToday,
          });
          const picture = gardenPicture(state, { images: IMAGES });
          expect(picture).not.toBeNull();
          expect(picture?.stage.count).toBe(state.visibleElements.length);
        }
      }
    }
  });
});
