import { previewGardenState } from '../garden-preview';
import {
  easeOutStrong,
  growingTarget,
  growthDurationMs,
  growthSegments,
  growthTween,
  plantKey,
  readGrowthMemory,
  rememberGrowth,
  shownGrowth,
  writeGrowthMemory,
} from '../growth-motion';

describe('the tween of a growth', () => {
  it('goes from the growth shown to the new one, fast first then settling (strong ease-out)', () => {
    expect(growthTween(0.2, 0.5, 0)).toBe(0.2);
    expect(growthTween(0.2, 0.5, 1)).toBe(0.5);
    // Past half the distance in the first quarter of the time.
    expect(growthTween(0.2, 0.5, 0.25)).toBeGreaterThan(0.35);
    expect(growthTween(0.2, 0.5, 0.5)).toBeLessThan(0.5);
  });

  it('is monotonic and stays between its ends', () => {
    let previous = 0;
    for (let t = 0; t <= 1.0001; t += 0.01) {
      const value = easeOutStrong(Math.min(1, t));
      expect(value).toBeGreaterThanOrEqual(previous - 1e-9);
      expect(value).toBeLessThanOrEqual(1 + 1e-9);
      previous = value;
    }
  });

  it('lasts from 1.2 s for a page to 2.5 s for a long reading', () => {
    expect(growthDurationMs(0.3, 0.4)).toBeGreaterThanOrEqual(1200);
    expect(growthDurationMs(0.3, 0.4)).toBeLessThan(1700);
    expect(growthDurationMs(0, 0.9)).toBe(2500);
    expect(growthDurationMs(0.3, 0.3)).toBe(1200);
  });
});

describe('what to play when the garden is shown', () => {
  const plant = (hizb: number, cycle = 1) => plantKey(cycle, hizb);

  it('the same plant, grown since it was last shown: from where it was to where it is', () => {
    expect(
      growthSegments({ plant: plant(25), growth: 0.2 }, { plant: plant(25), growth: 0.5 }),
    ).toEqual([{ plant: plant(25), hizb: 25, from: 0.2, to: 0.5 }]);
  });

  it('nothing to play when it has not grown since', () => {
    expect(
      growthSegments({ plant: plant(25), growth: 0.5 }, { plant: plant(25), growth: 0.5 }),
    ).toEqual([]);
    // A growth that went back (a journal restored): shown as it is, without a reverse animation.
    expect(
      growthSegments({ plant: plant(25), growth: 0.6 }, { plant: plant(25), growth: 0.5 }),
    ).toEqual([]);
  });

  it('its hizb finished in the meantime: the plant ends its growth, then the next one starts', () => {
    expect(
      growthSegments({ plant: plant(25), growth: 0.7 }, { plant: plant(26), growth: 0.1 }),
    ).toEqual([
      { plant: plant(25), hizb: 25, from: 0.7, to: 1 },
      { plant: plant(26), hizb: 26, from: 0, to: 0.1 },
    ]);
  });

  it('a plant never shown: it grows from the ground', () => {
    expect(growthSegments(null, { plant: plant(25), growth: 0.3 })).toEqual([
      { plant: plant(25), hizb: 25, from: 0, to: 0.3 },
    ]);
  });

  it('several hizb, or another khatma, since: only the plant of today grows', () => {
    expect(
      growthSegments({ plant: plant(20), growth: 0.7 }, { plant: plant(26), growth: 0.4 }),
    ).toEqual([{ plant: plant(26), hizb: 26, from: 0, to: 0.4 }]);
    expect(
      growthSegments({ plant: plant(25, 1), growth: 0.7 }, { plant: plant(26, 2), growth: 0.4 }),
    ).toEqual([{ plant: plant(26, 2), hizb: 26, from: 0, to: 0.4 }]);
  });
});

describe('the growth last shown, kept per plant', () => {
  it('starts empty, and from text that is not its own', () => {
    expect(shownGrowth(readGrowthMemory(null), plantKey(1, 25))).toBeNull();
    expect(shownGrowth(readGrowthMemory('{not json'), plantKey(1, 25))).toBeNull();
    expect(shownGrowth(readGrowthMemory('{"plants":{"1:25":7}}'), plantKey(1, 25))).toBeNull();
  });

  it('remembers the growth shown of each plant, and reads it back', () => {
    let memory = readGrowthMemory(null);
    memory = rememberGrowth(memory, plantKey(1, 25), 0.4);
    memory = rememberGrowth(memory, plantKey(1, 26), 0.1);
    const read = readGrowthMemory(writeGrowthMemory(memory));

    expect(shownGrowth(read, plantKey(1, 25))).toBe(0.4);
    expect(shownGrowth(read, plantKey(1, 26))).toBe(0.1);
  });

  it('keeps only the last plants: it never grows without end', () => {
    let memory = readGrowthMemory(null);
    for (let hizb = 1; hizb <= 30; hizb += 1)
      memory = rememberGrowth(memory, plantKey(1, hizb), 0.5);
    const read = readGrowthMemory(writeGrowthMemory(memory));

    expect(shownGrowth(read, plantKey(1, 30))).toBe(0.5);
    expect(shownGrowth(read, plantKey(1, 1))).toBeNull();
    expect(writeGrowthMemory(memory).length).toBeLessThan(200);
  });
});

describe('the plant growing in a garden', () => {
  it('is the element of the hizb in progress, from its first counted page', () => {
    const base = previewGardenState({ hizbCompleted: 24 });
    const next = base.nextElement;
    if (next === null) throw new Error('a garden of 24 hizb grows a 25th element');
    const growing = { ...base, nextElement: { ...next, growth: 0.3 } };

    expect(growingTarget(growing)).toEqual({
      plant: plantKey(base.variant.cycle, 25),
      hizb: 25,
      growth: 0.3,
    });
    expect(growingTarget(base)).toBeNull();
    expect(
      growingTarget({ ...growing, nextElement: { ...next, growth: 0.3, isVisible: false } }),
    ).toBeNull();
  });
});
