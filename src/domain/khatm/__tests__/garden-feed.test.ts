import { isLocalDate } from '@/domain/shared/local-date';
import { HIZB_PAGE_RANGES, withHizbRange } from '../__fixtures__/hizb-page-ranges';
import {
  allPagesOutOfOrder,
  buildCompletedKhatmas,
  day,
  pageRange,
  readPages,
} from '../__fixtures__/journal-builders';
import {
  DEFAULT_KHATM_CONFIG,
  EMPTY_JOURNAL,
  getBadges,
  getCurrentKhatm,
  getGardenFeed,
  getKhatmProgress,
  getWateredDays,
  recordPageRead,
  type ReadingJournal,
} from '../index';

// Fixture reminder: hizb 1 = pages 1..11, hizb 2 = 11..21, hizb 3 = 21..31 ... hizb 60 = 591..604.
const TWO_NEW_PAGES_TO_WATER = { ...DEFAULT_KHATM_CONFIG, minPagesPerWateredDay: 2 };

/** Khatma 1 read in September except the given pages, which are still to read. */
function firstKhatmaExcept(unreadPages: readonly number[]): ReadingJournal {
  const pages = allPagesOutOfOrder().filter((page) => !unreadPages.includes(page));
  return readPages(EMPTY_JOURNAL, 1, pages, day('2026-09-01'));
}

describe('Rule 10 — what the garden receives (ce que reçoit le jardin)', () => {
  it('empty journal: bare ground of khatma 1, no start date, no watered day', () => {
    const feed = getGardenFeed(EMPTY_JOURNAL, HIZB_PAGE_RANGES);

    expect(feed).toEqual({
      khatm: 1,
      hizbCompleted: 0,
      currentHizbProgress: 0,
      currentHizbPagesRead: 0,
      currentHizbPageCount: 11,
      startDate: null,
      wateredDays: new Set(),
      firstHizbCompletedOn: null,
      completedOn: null,
    });
  });

  it('khatma in progress: completed hizb, progress of the current hizb, start date, watered days', () => {
    let journal = readPages(EMPTY_JOURNAL, 1, pageRange(1, 11), day('2026-11-20'));
    journal = readPages(journal, 1, pageRange(12, 15), day('2026-11-22'));

    const feed = getGardenFeed(journal, HIZB_PAGE_RANGES);

    expect(feed.khatm).toBe(1);
    expect(feed.hizbCompleted).toBe(1);
    // Hizb 2 is pages 11..21: pages 11 to 15 are read, 5 out of 11.
    expect(feed.currentHizbProgress).toBeCloseTo(5 / 11);
    expect(feed.startDate).toBe('2026-11-20');
    expect(feed.wateredDays).toEqual(new Set([day('2026-11-20'), day('2026-11-22')]));
  });

  it('gives the same hizb numbers as getKhatmProgress for the khatma in progress', () => {
    const journal = readPages(EMPTY_JOURNAL, 1, pageRange(1, 250), day('2026-11-20'));

    const feed = getGardenFeed(journal, HIZB_PAGE_RANGES);
    const progress = getKhatmProgress(journal, 1, HIZB_PAGE_RANGES);

    expect(feed.hizbCompleted).toBe(progress.hizbCompleted);
    expect(feed.currentHizbProgress).toBe(progress.currentHizbProgress);
  });

  it('counts the pages of the hizb in progress: the growth is pages read over pages of the hizb', () => {
    // Hizb 2 is pages 11..21 (11 pages); page 11 also ends hizb 1.
    let journal = readPages(EMPTY_JOURNAL, 1, pageRange(1, 10), day('2026-11-20'));
    let feed = getGardenFeed(journal, HIZB_PAGE_RANGES);
    expect([feed.currentHizbPagesRead, feed.currentHizbPageCount]).toEqual([10, 11]);

    // The page shared by hizb 1 and 2 completes the first and is the first counted page of the second.
    journal = recordPageRead(journal, { page: 11, date: day('2026-11-20') });
    feed = getGardenFeed(journal, HIZB_PAGE_RANGES);
    expect(feed.hizbCompleted).toBe(1);
    expect([feed.currentHizbPagesRead, feed.currentHizbPageCount]).toEqual([1, 11]);
    expect(feed.currentHizbProgress).toBe(feed.currentHizbPagesRead / feed.currentHizbPageCount);

    journal = readPages(journal, 1, [12, 13], day('2026-11-21'));
    feed = getGardenFeed(journal, HIZB_PAGE_RANGES);
    expect([feed.currentHizbPagesRead, feed.currentHizbPageCount]).toEqual([3, 11]);
    expect(feed.currentHizbProgress).toBeCloseTo(3 / 11);
  });

  it('D10 — between two hizb, the next element grows with every new page', () => {
    // Hizb 1 (pages 1..11) is completed; page 11 is also the first page of hizb 2 (11..21).
    let journal = readPages(EMPTY_JOURNAL, 1, pageRange(1, 11), day('2026-11-20'));
    expect(getGardenFeed(journal, HIZB_PAGE_RANGES).currentHizbProgress).toBeCloseTo(1 / 11);

    for (let page = 12; page <= 20; page += 1) {
      journal = recordPageRead(journal, { page, date: day('2026-11-21') });
      const feed = getGardenFeed(journal, HIZB_PAGE_RANGES);
      const pagesOfHizbTwoRead = page - 10;

      expect(feed.hizbCompleted).toBe(1);
      expect(feed.currentHizbProgress).toBeCloseTo(pagesOfHizbTwoRead / 11);
    }

    // Page 21 completes hizb 2 and is the first page of hizb 3: a new element starts growing.
    journal = recordPageRead(journal, { page: 21, date: day('2026-11-21') });
    const feed = getGardenFeed(journal, HIZB_PAGE_RANGES);

    expect(feed.hizbCompleted).toBe(2);
    expect(feed.currentHizbProgress).toBeCloseTo(1 / 11);
  });

  it('page read again another day: a re-read does not make the next element grow', () => {
    const journal = readPages(EMPTY_JOURNAL, 1, pageRange(1, 15), day('2026-11-20'));
    const reread = readPages(journal, 1, pageRange(1, 15), day('2026-11-21'));

    expect(getGardenFeed(reread, HIZB_PAGE_RANGES)).toEqual(
      getGardenFeed(journal, HIZB_PAGE_RANGES),
    );
  });

  it('pages read in any order: the growing element is the first unfinished hizb of the mushaf', () => {
    // Hizb 2 (pages 11..21) is read first: one element is earned, hizb 1 is the one growing.
    const journal = readPages(EMPTY_JOURNAL, 1, pageRange(11, 21), day('2026-11-20'));

    const feed = getGardenFeed(journal, HIZB_PAGE_RANGES);

    expect(feed.hizbCompleted).toBe(1);
    expect(feed.currentHizbProgress).toBeCloseTo(1 / 11);
  });

  it('the complete garden stays on display: 60 hizb once the khatma is completed, until the next one starts', () => {
    const almostDone = firstKhatmaExcept([604]);
    const done = recordPageRead(almostDone, { page: 604, date: day('2026-11-20') });

    const beforeLastPage = getGardenFeed(almostDone, HIZB_PAGE_RANGES);
    const afterLastPage = getGardenFeed(done, HIZB_PAGE_RANGES);

    expect(beforeLastPage.khatm).toBe(1);
    expect(beforeLastPage.hizbCompleted).toBe(59);
    // Hizb 60 is pages 591..604: 13 of its 14 pages are read.
    expect(beforeLastPage.currentHizbProgress).toBeCloseTo(13 / 14);
    expect(beforeLastPage.completedOn).toBeNull();
    expect(afterLastPage).toEqual({
      khatm: 1,
      hizbCompleted: 60,
      currentHizbProgress: 0,
      // Nothing is left to grow.
      currentHizbPagesRead: 0,
      currentHizbPageCount: 0,
      startDate: '2026-09-01',
      wateredDays: new Set([day('2026-09-01'), day('2026-11-20')]),
      // The 59 first hizb were completed in September, the khatma with its last page.
      firstHizbCompletedOn: '2026-09-01',
      completedOn: '2026-11-20',
    });
    expect(getBadges(done).map((badge) => badge.khatm)).toEqual([1]);
  });

  it('the complete garden gives way to the next garden with the first page of the next khatma', () => {
    const done = readPages(EMPTY_JOURNAL, 1, allPagesOutOfOrder(), day('2026-11-20'));

    const nextStarted = recordPageRead(done, { page: 1, date: day('2026-11-25') });

    expect(getGardenFeed(done, HIZB_PAGE_RANGES).khatm).toBe(1);
    expect(getGardenFeed(nextStarted, HIZB_PAGE_RANGES)).toEqual({
      khatm: 2,
      hizbCompleted: 0,
      // Hizb 1 is pages 1..11: one page read.
      currentHizbProgress: 1 / 11,
      currentHizbPagesRead: 1,
      currentHizbPageCount: 11,
      startDate: '2026-11-25',
      wateredDays: new Set([day('2026-11-25')]),
      // The new garden has its own days: nothing is inherited from the completed khatma.
      firstHizbCompletedOn: null,
      completedOn: null,
    });
  });

  it('several khatmas completed: the garden on display is the last completed one', () => {
    const journal = buildCompletedKhatmas(3, day('2026-01-01'), 10);

    const feed = getGardenFeed(journal, HIZB_PAGE_RANGES);

    // Khatma 3 was read from the 21st to the 27th of January (100 pages a day).
    expect(feed.khatm).toBe(3);
    expect(feed.hizbCompleted).toBe(60);
    expect(feed.startDate).toBe('2026-01-21');
    expect(feed.wateredDays.size).toBe(7);
  });

  it('stays within what docs/specs/garden.md accepts, all along a khatma read out of order', () => {
    let journal = EMPTY_JOURNAL;

    for (const page of allPagesOutOfOrder()) {
      journal = recordPageRead(journal, { page, date: day('2026-11-20') });
      const feed = getGardenFeed(journal, HIZB_PAGE_RANGES);

      // hizbCompleted: whole number 0..60; currentHizbProgress: fraction 0..1.
      expect(Number.isInteger(feed.hizbCompleted)).toBe(true);
      expect(feed.hizbCompleted).toBeGreaterThanOrEqual(0);
      expect(feed.hizbCompleted).toBeLessThanOrEqual(60);
      expect(feed.currentHizbProgress).toBeGreaterThanOrEqual(0);
      expect(feed.currentHizbProgress).toBeLessThan(1);
      // wateredDays: a set of local dates; startDate: a local date once the khatma has started.
      expect(feed.wateredDays).toBeInstanceOf(Set);
      expect([...feed.wateredDays].every((wateredDay) => isLocalDate(wateredDay))).toBe(true);
      expect(feed.startDate === null || isLocalDate(feed.startDate)).toBe(true);
      // firstHizbCompletedOn is set from the first completed hizb; completedOn exactly at 60.
      expect(feed.firstHizbCompletedOn !== null).toBe(feed.hizbCompleted >= 1);
      expect(feed.completedOn !== null).toBe(feed.hizbCompleted === 60);
    }

    // The last page completed khatma 1: its garden stays on display, complete.
    const completeGarden = getGardenFeed(journal, HIZB_PAGE_RANGES);
    expect(completeGarden.khatm).toBe(1);
    expect(completeGarden.hizbCompleted).toBe(60);
    expect(completeGarden.currentHizbProgress).toBe(0);
  });

  it('the start date is the earliest reading date of the khatma, even when entered late', () => {
    let journal = readPages(EMPTY_JOURNAL, 1, [1], day('2026-11-22'));
    journal = readPages(journal, 1, [2], day('2026-11-18'));

    expect(getGardenFeed(journal, HIZB_PAGE_RANGES).startDate).toBe('2026-11-18');
  });

  it('page read again another day: a re-read does not water the garden', () => {
    let journal = readPages(EMPTY_JOURNAL, 1, [1], day('2026-11-20'));
    journal = readPages(journal, 1, [1], day('2026-11-21'));

    expect(getGardenFeed(journal, HIZB_PAGE_RANGES).wateredDays).toEqual(
      new Set([day('2026-11-20')]),
    );
  });

  it('completed khatma then new khatma not started: the garden received is still the completed one, with its start date and watered days', () => {
    let journal = readPages(EMPTY_JOURNAL, 1, pageRange(1, 600), day('2026-11-18'));
    journal = readPages(journal, 1, pageRange(601, 604), day('2026-11-20'));

    expect(getCurrentKhatm(journal)).toBe(2);
    expect(getGardenFeed(journal, HIZB_PAGE_RANGES)).toEqual({
      khatm: 1,
      hizbCompleted: 60,
      currentHizbProgress: 0,
      currentHizbPagesRead: 0,
      currentHizbPageCount: 0,
      startDate: '2026-11-18',
      wateredDays: new Set([day('2026-11-18'), day('2026-11-20')]),
      firstHizbCompletedOn: '2026-11-18',
      completedOn: '2026-11-20',
    });
  });

  it('the start date is null only while no page has ever been read', () => {
    const onePage = recordPageRead(EMPTY_JOURNAL, { page: 1, date: day('2026-11-20') });
    const completed = buildCompletedKhatmas(1, day('2026-01-01'), 1);

    expect(getGardenFeed(EMPTY_JOURNAL, HIZB_PAGE_RANGES).startDate).toBeNull();
    expect(getGardenFeed(onePage, HIZB_PAGE_RANGES).startDate).toBe('2026-11-20');
    expect(getGardenFeed(completed, HIZB_PAGE_RANGES).startDate).toBe('2026-01-01');
  });

  it('completed khatma then new khatma: the garden restarts from the first page of the new khatma', () => {
    let journal = readPages(EMPTY_JOURNAL, 1, allPagesOutOfOrder(), day('2026-09-01'));
    journal = readPages(journal, 2, pageRange(1, 11), day('2026-11-20'));
    journal = readPages(journal, 2, [12], day('2026-11-21'));

    const feed = getGardenFeed(journal, HIZB_PAGE_RANGES);

    expect(feed.khatm).toBe(2);
    expect(feed.hizbCompleted).toBe(1);
    expect(feed.currentHizbProgress).toBeCloseTo(2 / 11);
    expect(feed.startDate).toBe('2026-11-20');
  });

  it('watered days: only from the start date of the khatma in progress', () => {
    let journal = firstKhatmaExcept([604]);
    journal = readPages(journal, 1, [604], day('2026-11-10'));
    journal = readPages(journal, 2, [1], day('2026-11-20'));
    journal = readPages(journal, 2, [2], day('2026-11-22'));

    const feed = getGardenFeed(journal, HIZB_PAGE_RANGES);

    expect(feed.wateredDays).toEqual(new Set([day('2026-11-20'), day('2026-11-22')]));
    // The older days are still watered days for the streak: they are only left out of the feed.
    expect(getWateredDays(journal).has(day('2026-11-10'))).toBe(true);
    expect(getWateredDays(journal).has(day('2026-09-01'))).toBe(true);
  });

  it('watered days: the day a khatma ends and the next one starts is watered as one day', () => {
    // Two new pages are needed to water a day. On the 20th: the last page of khatma 1 and
    // the first page of khatma 2.
    let journal = firstKhatmaExcept([604]);
    journal = readPages(journal, 1, [604], day('2026-11-20'));
    journal = readPages(journal, 2, [1], day('2026-11-20'));

    const feed = getGardenFeed(journal, HIZB_PAGE_RANGES, TWO_NEW_PAGES_TO_WATER);

    expect(feed.startDate).toBe('2026-11-20');
    expect(feed.wateredDays).toEqual(new Set([day('2026-11-20')]));
  });

  it('watered days follow minPagesPerWateredDay', () => {
    let journal = readPages(EMPTY_JOURNAL, 1, [1], day('2026-11-20'));
    journal = readPages(journal, 1, [2, 3], day('2026-11-21'));

    const feed = getGardenFeed(journal, HIZB_PAGE_RANGES, TWO_NEW_PAGES_TO_WATER);

    expect(feed.startDate).toBe('2026-11-20');
    expect(feed.wateredDays).toEqual(new Set([day('2026-11-21')]));
  });

  it('firstHizbCompletedOn: null while no hizb is completed', () => {
    // Hizb 1 is pages 1..11: page 11 is missing.
    const journal = readPages(EMPTY_JOURNAL, 1, pageRange(1, 10), day('2026-11-20'));

    expect(getGardenFeed(journal, HIZB_PAGE_RANGES).firstHizbCompletedOn).toBeNull();
  });

  it('firstHizbCompletedOn: a hizb is completed on the most recent date among its pages', () => {
    let journal = readPages(EMPTY_JOURNAL, 1, pageRange(1, 5), day('2026-11-18'));
    journal = readPages(journal, 1, pageRange(6, 10), day('2026-11-20'));
    journal = readPages(journal, 1, [11], day('2026-11-22'));

    const feed = getGardenFeed(journal, HIZB_PAGE_RANGES);

    expect(feed.hizbCompleted).toBe(1);
    expect(feed.startDate).toBe('2026-11-18');
    expect(feed.firstHizbCompletedOn).toBe('2026-11-22');
  });

  it('firstHizbCompletedOn: does not move when other hizb are completed afterwards', () => {
    let journal = readPages(EMPTY_JOURNAL, 1, pageRange(1, 11), day('2026-11-20'));
    journal = readPages(journal, 1, pageRange(12, 31), day('2026-11-25'));

    const feed = getGardenFeed(journal, HIZB_PAGE_RANGES);

    expect(feed.hizbCompleted).toBe(3);
    expect(feed.firstHizbCompletedOn).toBe('2026-11-20');
  });

  it('firstHizbCompletedOn: the earliest day over the completed hizb, whatever their place in the mushaf', () => {
    // Hizb 2 (pages 11..21) is completed on the 18th, hizb 1 (pages 1..11) on the 20th.
    let journal = readPages(EMPTY_JOURNAL, 1, pageRange(11, 21), day('2026-11-18'));
    const onlyHizbTwo = getGardenFeed(journal, HIZB_PAGE_RANGES);
    journal = readPages(journal, 1, pageRange(1, 10), day('2026-11-20'));

    expect(onlyHizbTwo.firstHizbCompletedOn).toBe('2026-11-18');
    expect(getGardenFeed(journal, HIZB_PAGE_RANGES).firstHizbCompletedOn).toBe('2026-11-18');
  });

  it('firstHizbCompletedOn with back-dated entries: the latest date of the pages, not the last page recorded', () => {
    // Pages 1..10 are dated the 20th; page 11 is recorded last but for the 15th.
    let journal = readPages(EMPTY_JOURNAL, 1, pageRange(1, 10), day('2026-11-20'));
    journal = readPages(journal, 1, [11], day('2026-11-15'));

    const feed = getGardenFeed(journal, HIZB_PAGE_RANGES);

    expect(feed.hizbCompleted).toBe(1);
    expect(feed.startDate).toBe('2026-11-15');
    expect(feed.firstHizbCompletedOn).toBe('2026-11-20');
  });

  it('firstHizbCompletedOn with back-dated entries: a hizb completed later for an earlier day becomes the first', () => {
    // Hizb 1 is completed on the 20th. Hizb 3 (pages 21..31) is then recorded for the 10th.
    let journal = readPages(EMPTY_JOURNAL, 1, pageRange(1, 11), day('2026-11-20'));
    expect(getGardenFeed(journal, HIZB_PAGE_RANGES).firstHizbCompletedOn).toBe('2026-11-20');

    journal = readPages(journal, 1, pageRange(21, 31), day('2026-11-10'));

    expect(getGardenFeed(journal, HIZB_PAGE_RANGES).firstHizbCompletedOn).toBe('2026-11-10');
  });

  it('firstHizbCompletedOn with a hizb sharing a page with its neighbour: the shared page counts for both', () => {
    // Page 11 ends hizb 1 and starts hizb 2. Everything but page 11 is read by the 18th.
    let journal = readPages(EMPTY_JOURNAL, 1, pageRange(1, 10), day('2026-11-17'));
    journal = readPages(journal, 1, pageRange(12, 21), day('2026-11-18'));
    const withoutSharedPage = getGardenFeed(journal, HIZB_PAGE_RANGES);

    // The shared page, read on the 20th, completes both hizb that day.
    journal = readPages(journal, 1, [11], day('2026-11-20'));
    const withSharedPage = getGardenFeed(journal, HIZB_PAGE_RANGES);

    expect(withoutSharedPage.hizbCompleted).toBe(0);
    expect(withoutSharedPage.firstHizbCompletedOn).toBeNull();
    expect(withSharedPage.hizbCompleted).toBe(2);
    expect(withSharedPage.firstHizbCompletedOn).toBe('2026-11-20');
  });

  it('firstHizbCompletedOn with a hizb sharing a page with its neighbour: a late shared page delays the hizb that came before it', () => {
    // The shared page 11 is dated the 25th; pages 12..21 the 18th; pages 1..10 the 17th.
    // Both hizb hold page 11, so both are completed on the 25th, not on the 17th or 18th.
    let journal = readPages(EMPTY_JOURNAL, 1, [11], day('2026-11-25'));
    journal = readPages(journal, 1, pageRange(12, 21), day('2026-11-18'));
    const hizbTwoOnly = getGardenFeed(journal, HIZB_PAGE_RANGES);
    journal = readPages(journal, 1, pageRange(1, 10), day('2026-11-17'));

    expect(hizbTwoOnly.hizbCompleted).toBe(1);
    expect(hizbTwoOnly.firstHizbCompletedOn).toBe('2026-11-25');
    expect(getGardenFeed(journal, HIZB_PAGE_RANGES).firstHizbCompletedOn).toBe('2026-11-25');
  });

  it('firstHizbCompletedOn with a hizb that shares no page: its neighbour does not delay it', () => {
    // Hand-made edge: hizb 2 starts at the top of page 12, so page 11 belongs to hizb 1 only.
    const ranges = withHizbRange({ hizb: 2, firstPage: 12, lastPage: 21 });
    let journal = readPages(EMPTY_JOURNAL, 1, pageRange(12, 21), day('2026-11-18'));
    journal = readPages(journal, 1, pageRange(1, 11), day('2026-11-25'));

    expect(getGardenFeed(journal, ranges).firstHizbCompletedOn).toBe('2026-11-18');
  });

  it('completedOn: null while the khatma is in progress, then the day it is completed, the same as on its badge', () => {
    let journal = readPages(EMPTY_JOURNAL, 1, pageRange(1, 600), day('2026-11-18'));
    const inProgress = getGardenFeed(journal, HIZB_PAGE_RANGES);
    journal = readPages(journal, 1, pageRange(601, 604), day('2026-11-20'));
    const completed = getGardenFeed(journal, HIZB_PAGE_RANGES);

    expect(inProgress.hizbCompleted).toBe(59);
    expect(inProgress.completedOn).toBeNull();
    expect(completed.hizbCompleted).toBe(60);
    expect(completed.completedOn).toBe('2026-11-20');
    expect(completed.completedOn).toBe(getBadges(journal)[0]?.completedOn);
  });

  it('completedOn with back-dated entries: the latest reading date, not the date of the last page recorded', () => {
    // The last pages are recorded for the 12th, after pages dated the 15th.
    let journal = readPages(EMPTY_JOURNAL, 1, pageRange(1, 400), day('2026-11-15'));
    journal = readPages(journal, 1, pageRange(401, 604), day('2026-11-12'));

    const feed = getGardenFeed(journal, HIZB_PAGE_RANGES);

    expect(feed.startDate).toBe('2026-11-12');
    expect(feed.completedOn).toBe('2026-11-15');
    expect(feed.completedOn).toBe(getBadges(journal)[0]?.completedOn);
  });

  it('completedOn and firstHizbCompletedOn belong to the khatma fed: the next khatma starts with neither', () => {
    const journal = buildCompletedKhatmas(2, day('2026-01-01'), 10);
    // Khatma 2 ran from the 11th to the 17th of January, 100 pages a day.
    const completedGarden = getGardenFeed(journal, HIZB_PAGE_RANGES);
    const nextStarted = recordPageRead(journal, { page: 1, date: day('2026-02-01') });
    const nextGarden = getGardenFeed(nextStarted, HIZB_PAGE_RANGES);

    expect(completedGarden.khatm).toBe(2);
    expect(completedGarden.firstHizbCompletedOn).toBe('2026-01-11');
    expect(completedGarden.completedOn).toBe('2026-01-17');
    expect(nextGarden.khatm).toBe(3);
    expect(nextGarden.firstHizbCompletedOn).toBeNull();
    expect(nextGarden.completedOn).toBeNull();
  });

  it('the days come in order: start date, first hizb completed, khatma completed', () => {
    const journal = buildCompletedKhatmas(1, day('2026-01-01'), 10);

    const feed = getGardenFeed(journal, HIZB_PAGE_RANGES);

    // 100 pages a day from the 1st of January: hizb 1 (pages 1..11) is done on the first day.
    expect(feed.startDate).toBe('2026-01-01');
    expect(feed.firstHizbCompletedOn).toBe('2026-01-01');
    expect(feed.completedOn).toBe('2026-01-07');
  });

  it('invalid input: rejects incomplete hizb ranges, a bad configuration and a corrupted journal', () => {
    const duplicated: ReadingJournal = [
      { khatm: 1, page: 5, date: day('2026-11-20') },
      { khatm: 1, page: 5, date: day('2026-11-21') },
    ];

    expect(() => getGardenFeed(EMPTY_JOURNAL, HIZB_PAGE_RANGES.slice(0, 59))).toThrow(RangeError);
    expect(() =>
      getGardenFeed(EMPTY_JOURNAL, HIZB_PAGE_RANGES, {
        ...DEFAULT_KHATM_CONFIG,
        minPagesPerWateredDay: 0,
      }),
    ).toThrow(RangeError);
    expect(() => getGardenFeed(duplicated, HIZB_PAGE_RANGES)).toThrow(RangeError);
  });

  it('invalid input: the hizb ranges and the configuration are checked even for an empty journal', () => {
    const noWindow = { ...DEFAULT_KHATM_CONFIG, averagePaceWindowDays: 0 };

    expect(() => getGardenFeed(EMPTY_JOURNAL, [])).toThrow(RangeError);
    expect(() => getGardenFeed(EMPTY_JOURNAL, HIZB_PAGE_RANGES, noWindow)).toThrow(RangeError);
  });
});
