import { quranStructure } from '@/data/quran';
import { recordPageRead } from '@/domain/khatm';
import { addDays, parseLocalDate } from '@/domain/shared/local-date';

import {
  buildReadingHistory,
  READING_HISTORY_CONFIG,
  type ReadingHistoryName,
} from '../dev-preview/reading-histories';
import { buildHomeModel, type HomeModelInput } from '../home-model';

/**
 * The facts the validated home screens show (docs/design/accueil.png, soif.png, mort.png,
 * khatm.png), each read from the khatm and garden modules, never made up.
 */

const TODAY = parseLocalDate('2026-11-24');
const RANGES = quranStructure.hizbPageRanges();
const GARDEN_HIZB = READING_HISTORY_CONFIG.gardenHizb;
const HIZB_IN_PROGRESS = RANGES[GARDEN_HIZB];

function inputOf(history: ReadingHistoryName): HomeModelInput {
  return { ...buildReadingHistory(history, TODAY, RANGES), today: TODAY, hizbPageRanges: RANGES };
}
const modelOf = (history: ReadingHistoryName) => buildHomeModel(inputOf(history));

describe('the layout of the home screen follows the state of the garden', () => {
  it.each<[ReadingHistoryName, string]>([
    ['bare-earth', 'growing'],
    ['thriving', 'growing'],
    ['recovering', 'growing'],
    ['thirsty', 'thirsty'],
    ['wilting', 'thirsty'],
    ['dying', 'thirsty'],
    ['dead', 'dead'],
    ['khatma-complete', 'complete'],
  ])('%s is shown as the %s home', (history, layout) => {
    expect(modelOf(history).layout).toBe(layout);
  });
});

describe('the hizb in progress ("Encore 3 pages pour finir le hizb 25")', () => {
  it('names the first unfinished hizb and the pages of it still unread', () => {
    const model = modelOf('thriving');
    if (HIZB_IN_PROGRESS === undefined) throw new Error('missing range');
    const pagesInHizb = HIZB_IN_PROGRESS.lastPage - HIZB_IN_PROGRESS.firstPage + 1;
    // A page on which hizb 24 ends and hizb 25 starts was read with hizb 24.
    const sharedPage = RANGES[GARDEN_HIZB - 1]?.lastPage === HIZB_IN_PROGRESS.firstPage ? 1 : 0;
    expect(model.hizb).toEqual({
      completed: GARDEN_HIZB,
      total: 60,
      inProgress: GARDEN_HIZB + 1,
      pagesLeft: pagesInHizb - sharedPage - READING_HISTORY_CONFIG.pagesReadToday,
    });
  });

  it('a new person starts hizb 1, with all of its pages ahead', () => {
    const first = RANGES[0];
    if (first === undefined) throw new Error('missing range');
    expect(modelOf('bare-earth').hizb).toEqual({
      completed: 0,
      total: 60,
      inProgress: 1,
      pagesLeft: first.lastPage - first.firstPage + 1,
    });
  });

  it('a complete khatma has no hizb in progress', () => {
    expect(modelOf('khatma-complete').hizb).toEqual({
      completed: 60,
      total: 60,
      inProgress: null,
      pagesLeft: null,
    });
  });
});

describe('the water beside the hizb count ("Arrosé depuis 12 j", "À sec depuis 3 j")', () => {
  it('a garden read every day is watered for as many days as the streak', () => {
    const model = modelOf('thriving');
    expect(model.waterRun).toEqual({ kind: 'watered', days: model.streakDays });
    expect(model.streakDays).toBeGreaterThan(1);
  });

  it('after three days without reading the water is dry since three days', () => {
    expect(modelOf('thirsty').waterRun).toEqual({ kind: 'dry', days: 3 });
  });

  it('after one missed day the water is still, not dry', () => {
    // The thirsty history was last read four days before TODAY.
    const input = inputOf('thirsty');
    const dayAfter = buildHomeModel({ ...input, today: addDays(TODAY, -3) });
    expect(dayAfter.waterRun.kind).toBe('watered');
    const oneMissed = buildHomeModel({ ...input, today: addDays(TODAY, -2) });
    expect(oneMissed.waterRun).toEqual({ kind: 'still', days: 1 });
  });

  it('the bare earth has no water yet', () => {
    expect(modelOf('bare-earth').waterRun).toEqual({ kind: 'none' });
  });
});

describe('the drought ("Trois jours sans lecture", "Seize jours sans lecture")', () => {
  it('counts the days without reading, and when the garden will look worse', () => {
    const thirsty = modelOf('thirsty');
    expect(thirsty.drought).toEqual({
      daysWithoutReading: 3,
      next: { phase: 'wilting', inDays: 3 },
    });
    expect(modelOf('dying').drought).toEqual({
      daysWithoutReading: 10,
      next: { phase: 'dead', inDays: 4 },
    });
  });

  it('a dead garden has nothing worse ahead', () => {
    expect(modelOf('dead').drought).toEqual({ daysWithoutReading: 14, next: null });
  });

  it('there is no drought to tell while the garden grows', () => {
    expect(modelOf('thriving').drought).toBeNull();
    expect(modelOf('recovering').drought).toBeNull();
  });
});

describe('the completed khatma ("60 hizb · 604 pages · 64 jours")', () => {
  it('gives the hizb, the pages and the days it took, and where the next one starts', () => {
    const model = modelOf('khatma-complete');
    const pagesPerDay = READING_HISTORY_CONFIG.khatmaPagesPerDay;
    expect(model.completedKhatma).toEqual({
      khatm: 1,
      hizb: 60,
      pages: 604,
      days: Math.ceil(604 / pagesPerDay),
      nextKhatmaFirstPage: 1,
    });
  });

  it('is absent while the khatma is in progress', () => {
    expect(modelOf('thriving').completedKhatma).toBeNull();
  });

  it('starts the next one at page 1 even when the reader was left on the last page', () => {
    const input = inputOf('khatma-complete');
    const model = buildHomeModel({
      ...input,
      settings: { ...input.settings, lastOpenedPage: 604 },
    });
    expect(model.completedKhatma?.nextKhatmaFirstPage).toBe(1);
  });

  it('is told no more once the next khatma has a page', () => {
    const input = inputOf('khatma-complete');
    const journal = recordPageRead(input.journal, { page: 1, date: TODAY });
    expect(buildHomeModel({ ...input, journal }).completedKhatma).toBeNull();
  });
});
