import { HIZB_PAGE_RANGES } from '@/domain/khatm/__fixtures__/hizb-page-ranges';
import {
  buildCompletedKhatmas,
  day,
  pageRange,
  readPages,
} from '@/domain/khatm/__fixtures__/journal-builders';
import { gardenArtEntry } from '@/data/garden-art';
import { GARDEN_STYLES, getProgression } from '@/domain/levels';

import { celebrationOf, friendShelf, ownShelf } from '../gardens-model';
import { GARDEN_STYLE_ART, packLevelOf } from '../garden-style-art';

const START = day('2026-01-01');

describe('the art of each garden style', () => {
  it('has an entry for every style, so a new style cannot ship without its art decided', () => {
    expect(Object.keys(GARDEN_STYLE_ART).sort()).toEqual([...GARDEN_STYLES].sort());
  });

  it('draws the fountain courtyard with the garden in the app, untinted', () => {
    expect(packLevelOf('fountain-courtyard')).toBeNull();
    expect(GARDEN_STYLE_ART['fountain-courtyard'].placeholderTint).toBeNull();
  });

  it('draws each other style with the pack of its own level, which the manifest has', () => {
    GARDEN_STYLES.forEach((style, index) => {
      if (style === 'fountain-courtyard') return;
      const level = index + 1;
      expect(packLevelOf(style)).toBe(level);
      expect(gardenArtEntry(level)?.style).toBe(style);
    });
  });

  it('gives each downloaded style its own placeholder cast, never a flat colour', () => {
    const others = GARDEN_STYLES.filter((style) => style !== 'fountain-courtyard');
    const tints = others.map((style) => GARDEN_STYLE_ART[style].placeholderTint?.role);
    expect(new Set(tints).size).toBe(others.length);
    for (const style of others) {
      const opacity = GARDEN_STYLE_ART[style].placeholderTint?.opacity ?? 0;
      expect(opacity).toBeGreaterThan(0);
      // A cast: the garden must still be read under it.
      expect(opacity).toBeLessThanOrEqual(0.4);
    }
  });
});

describe('ownShelf', () => {
  it('turns the progression into badges: earned, in progress, then a locked surprise', () => {
    const journal = readPages(buildCompletedKhatmas(1, START, 10), 2, pageRange(1, 91), START);
    expect(ownShelf(getProgression(journal, HIZB_PAGE_RANGES))).toEqual([
      {
        kind: 'earned',
        khatm: 1,
        styleId: 'fountain-courtyard',
        completedOn: day('2026-01-07'),
      },
      { kind: 'in-progress', level: 2, styleId: 'oasis', hizbCompleted: 9 },
      { kind: 'locked', level: 3 },
    ]);
  });
});

describe('friendShelf', () => {
  const badges = [
    { userId: 'f', khatmNumber: 1, completedOn: day('2026-02-02') },
    { userId: 'f', khatmNumber: 2, completedOn: day('2026-08-30') },
  ];

  it('gives a friend the level after their completed khatmas, and their badges', () => {
    const shelf = friendShelf(badges, 18);
    expect(shelf.level).toBe(3);
    expect(shelf.styleId).toBe('waterside-orchard');
    expect(shelf.items).toEqual([
      {
        kind: 'earned',
        khatm: 1,
        styleId: 'fountain-courtyard',
        completedOn: day('2026-02-02'),
      },
      { kind: 'earned', khatm: 2, styleId: 'oasis', completedOn: day('2026-08-30') },
      { kind: 'in-progress', level: 3, styleId: 'waterside-orchard', hizbCompleted: 18 },
    ]);
  });

  it('shows no locked level on a friend’s page, and no hizb when their garden is hidden', () => {
    const shelf = friendShelf([], null);
    expect(shelf.level).toBe(1);
    expect(shelf.items).toEqual([
      { kind: 'in-progress', level: 1, styleId: 'fountain-courtyard', hizbCompleted: null },
    ]);
  });

  it('orders the badges by khatma, whatever order they arrive in', () => {
    const shelf = friendShelf([...badges].reverse(), 0);
    expect(shelf.items.slice(0, 2).map((item) => item.kind === 'earned' && item.khatm)).toEqual([
      1, 2,
    ]);
  });
});

describe('celebrationOf', () => {
  it('says what the celebration shows: the badge, the numbers, and the next garden', () => {
    const { completed } = getProgression(buildCompletedKhatmas(1, START, 10), HIZB_PAGE_RANGES);
    expect(celebrationOf(completed[0]!)).toEqual({
      khatm: 1,
      styleId: 'fountain-courtyard',
      completedOn: day('2026-01-07'),
      hizb: 60,
      pages: 604,
      days: 7,
      next: { level: 2, styleId: 'oasis', isSameStyle: false },
    });
  });

  it('beyond the last style, the next garden is the same style, grown anew', () => {
    const { completed } = getProgression(buildCompletedKhatmas(7, START, 30), HIZB_PAGE_RANGES);
    expect(celebrationOf(completed[6]!).next).toEqual({
      level: 7,
      styleId: 'night-garden',
      isSameStyle: true,
    });
  });
});
