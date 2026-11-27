import { GARDEN_CATALOG, type GardenElement } from '@/domain/garden';

import { LIFE, dayLifeOpacity, fireflyOpacity, gardenLifeOf } from '../life-rules';

/** The elements a garden shows once `hizb` hizb are finished, from the shipped catalogue. */
function elementsAt(hizb: number): readonly GardenElement[] {
  return GARDEN_CATALOG.slice(0, hizb);
}

const DEFAULTS = { isLowPower: false, isMotionReduced: false } as const;

describe('the life of the garden, earned by hizb (owner, 27 November 2026)', () => {
  it('has no birds and no butterflies at hizb 25, as in the mockup', () => {
    const life = gardenLifeOf(elementsAt(25), DEFAULTS);
    expect(life.birds).toBe(0);
    expect(life.butterflies).toBe(0);
  });

  it('earns a small flock of birds at hizb 27, a bigger one at 37, and again at 57', () => {
    const at26 = gardenLifeOf(elementsAt(26), DEFAULTS).birds;
    const at27 = gardenLifeOf(elementsAt(27), DEFAULTS).birds;
    const at37 = gardenLifeOf(elementsAt(37), DEFAULTS).birds;
    const at57 = gardenLifeOf(elementsAt(57), DEFAULTS).birds;
    expect(at26).toBe(0);
    expect(at27).toBeGreaterThan(0);
    expect(at37).toBeGreaterThan(at27);
    expect(at57).toBeGreaterThan(at37);
    expect(at57).toBe(LIFE.birdsByFlocks[3]);
  });

  it('earns the butterflies at hizb 47', () => {
    expect(gardenLifeOf(elementsAt(46), DEFAULTS).butterflies).toBe(0);
    expect(gardenLifeOf(elementsAt(47), DEFAULTS).butterflies).toBe(LIFE.butterflies);
  });

  it('has fireflies from the start (they only show at night)', () => {
    expect(gardenLifeOf(elementsAt(0), DEFAULTS).fireflies).toBe(LIFE.fireflies);
  });

  it('lets a few leaves drift once a tree stands, never on bare earth', () => {
    expect(gardenLifeOf(elementsAt(0), DEFAULTS).leaves).toBe(0);
    const firstTree = GARDEN_CATALOG.findIndex((element) => element.id.startsWith('tree')) + 1;
    expect(gardenLifeOf(elementsAt(firstTree - 1), DEFAULTS).leaves).toBe(0);
    expect(gardenLifeOf(elementsAt(firstTree), DEFAULTS).leaves).toBe(LIFE.leaves);
  });

  it('loses what the drought hides: the counts follow the visible elements only', () => {
    // A garden whose drought hides the birds shows none, whatever was earned.
    const withoutBirds = elementsAt(57).filter((element) => element.kind !== 'birds');
    expect(gardenLifeOf(withoutBirds, DEFAULTS).birds).toBe(0);
  });

  it('draws fewer particles in Low Power Mode', () => {
    const full = gardenLifeOf(elementsAt(60), DEFAULTS);
    const low = gardenLifeOf(elementsAt(60), { ...DEFAULTS, isLowPower: true });
    expect(low.fireflies).toBeLessThan(full.fireflies);
    expect(low.leaves).toBeLessThan(full.leaves);
    expect(low.butterflies).toBeLessThan(full.butterflies);
    expect(low.fireflies).toBeGreaterThan(0);
  });

  it('keeps nothing that flies or falls with Reduce Motion; the fireflies stay, still', () => {
    const life = gardenLifeOf(elementsAt(60), { ...DEFAULTS, isMotionReduced: true });
    expect(life.leaves).toBe(0);
    expect(life.butterflies).toBe(0);
    expect(life.birds).toBe(0);
    expect(life.fireflies).toBe(LIFE.fireflies);
  });
});

describe('what shows at which hour', () => {
  it('shows fireflies only at night', () => {
    expect(fireflyOpacity(0)).toBe(0);
    expect(fireflyOpacity(0.04)).toBe(0);
    expect(fireflyOpacity(1)).toBe(1);
  });

  it('shows birds and butterflies by day only', () => {
    expect(dayLifeOpacity(0)).toBe(1);
    expect(dayLifeOpacity(1)).toBe(0);
  });

  it('refuses a night amount outside 0 to 1', () => {
    expect(() => fireflyOpacity(1.5)).toThrow(RangeError);
    expect(() => dayLifeOpacity(-0.1)).toThrow(RangeError);
  });
});
