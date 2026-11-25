/**
 * The model of the reader in continuous vertical scroll (docs/specs/reader.md, D41): the sections
 * of the 604 pages, the text they show in each script, the place read in the bar, and the rule
 * that turns a page section seen long enough into a page read.
 */

import { quranRepository, quranStructure } from '@/data/quran';
import { PAGE_COUNT, VERSE_COUNT, type QuranScript, type VerseRef } from '@/domain/quran';

import { READER_CONFIG } from '../config';
import { readingPlace, type SegmentExtent } from '../reading-place';
import { pageWordCounts } from '../page-words';
import { pageSection, pageSections } from '../reading-sections';
import {
  createReadingTracker,
  observeReading,
  progressOf,
  type ReadingObservation,
  type ReadingRules,
  type ReadingTracker,
  type SectionExtent,
} from '../scroll-reading';
import { buildSectionBlocks, verseMark, type SectionBlock } from '../section-content';

const SECOND = 1000;

async function textsOf(script: QuranScript): Promise<(ref: VerseRef) => string> {
  const bySurah = new Map<number, readonly string[]>();
  for (const { surah } of quranStructure.surahs) {
    bySurah.set(
      surah,
      (await quranRepository.getSurahVerses(surah, script)).map((verse) => verse.text),
    );
  }
  return ({ surah, verse }) => {
    const text = bySurah.get(surah)?.[verse - 1];
    if (text === undefined) throw new RangeError(`No verse ${surah}:${verse}`);
    return text;
  };
}

describe('the sections of the scroll: one per page of the mushaf', () => {
  const sections = pageSections(quranStructure);

  it('has 604 sections, in the order of the pages', () => {
    expect(sections).toHaveLength(PAGE_COUNT);
    expect(sections.map((section) => section.page)).toEqual(
      Array.from({ length: PAGE_COUNT }, (_, index) => index + 1),
    );
  });

  it('holds the 6236 verses once each, in reading order, so a section is exactly its page', () => {
    const keys = sections.flatMap((section) =>
      section.segments.flatMap((segment) =>
        Array.from(
          { length: segment.lastVerse - segment.firstVerse + 1 },
          (_, index) => `${segment.surah}:${segment.firstVerse + index}`,
        ),
      ),
    );
    expect(keys).toHaveLength(VERSE_COUNT);
    expect(new Set(keys).size).toBe(VERSE_COUNT);
    for (const section of sections) {
      for (const segment of section.segments) {
        expect(
          quranStructure.pageOfVerse({ surah: segment.surah, verse: segment.firstVerse }),
        ).toBe(section.page);
        expect(quranStructure.pageOfVerse({ surah: segment.surah, verse: segment.lastVerse })).toBe(
          section.page,
        );
      }
    }
  });

  it('cuts a page into one segment per surah, and says which segment opens its surah', () => {
    expect(pageSection(quranStructure, 1).segments).toEqual([
      { surah: 1, firstVerse: 1, lastVerse: 7, startsSurah: true },
    ]);
    expect(pageSection(quranStructure, 293).segments).toEqual([
      { surah: 17, firstVerse: 105, lastVerse: 111, startsSurah: false },
      { surah: 18, firstVerse: 1, lastVerse: 4, startsSurah: true },
    ]);
    expect(pageSection(quranStructure, 604).segments.map((segment) => segment.surah)).toEqual([
      112, 113, 114,
    ]);
  });

  it.each([0, 605, 1.5])('refuses page %p', (page) => {
    expect(() => pageSection(quranStructure, page)).toThrow(RangeError);
  });
});

describe('the text of a section (exigence absolue: exactly the source text)', () => {
  let uthmani: (ref: VerseRef) => string;
  let imlaei: (ref: VerseRef) => string;
  beforeAll(async () => {
    uthmani = await textsOf('uthmani');
    imlaei = await textsOf('imlaei');
  });

  function versesOf(blocks: readonly SectionBlock[]) {
    return blocks.flatMap((block) => (block.kind === 'verses' ? block.verses : []));
  }

  it.each([
    ['uthmani', 1],
    ['uthmani', 2],
    ['uthmani', 293],
    ['uthmani', 604],
    ['imlaei', 1],
    ['imlaei', 293],
    ['imlaei', 604],
  ] as const)('%s, page %i: every verse is the repository text, untouched', (script, page) => {
    const textOf = script === 'uthmani' ? uthmani : imlaei;
    const blocks = buildSectionBlocks(pageSection(quranStructure, page), textOf, script);
    for (const verse of versesOf(blocks)) {
      expect(verse.text).toBe(textOf({ surah: verse.surah, verse: verse.verse }));
    }
  });

  it('every verse of the 604 sections is the repository text, in both scripts', () => {
    for (const [script, textOf] of [
      ['uthmani', uthmani],
      ['imlaei', imlaei],
    ] as const) {
      let count = 0;
      for (const section of pageSections(quranStructure)) {
        for (const verse of versesOf(buildSectionBlocks(section, textOf, script))) {
          expect(verse.text).toBe(textOf(verse));
          count += 1;
        }
      }
      expect(count).toBe(VERSE_COUNT);
    }
  });

  it('opens a surah with its header, then the basmala (the text of 1:1), except surahs 1 and 9', () => {
    const page293 = buildSectionBlocks(pageSection(quranStructure, 293), uthmani, 'uthmani');
    expect(page293.map((block) => block.kind)).toEqual([
      'verses',
      'surah-header',
      'basmala',
      'verses',
    ]);
    expect(page293[2]).toEqual({ kind: 'basmala', text: uthmani({ surah: 1, verse: 1 }) });

    // Al-Fatiha's first verse is the basmala itself: no second one.
    const page1 = buildSectionBlocks(pageSection(quranStructure, 1), uthmani, 'uthmani');
    expect(page1.map((block) => block.kind)).toEqual(['surah-header', 'verses']);

    // At-Tawba opens page 187, without a basmala.
    const page187 = buildSectionBlocks(pageSection(quranStructure, 187), uthmani, 'uthmani');
    expect(page187.map((block) => block.kind)).toEqual(['surah-header', 'verses']);
  });

  it('takes the basmala of the simple script from the simple text', () => {
    const blocks = buildSectionBlocks(pageSection(quranStructure, 293), imlaei, 'imlaei');
    expect(blocks[2]).toEqual({ kind: 'basmala', text: imlaei({ surah: 1, verse: 1 }) });
  });

  it('ends each verse with its mark: the publisher number in the Uthmani font, ornate brackets in the simple one', () => {
    expect(verseMark(110, 'uthmani')).toBe('١١٠');
    expect(verseMark(7, 'imlaei')).toBe(
      `${READER_CONFIG.simpleVerseMark.open}٧${READER_CONFIG.simpleVerseMark.close}`,
    );
    const [verse] = versesOf(
      buildSectionBlocks(pageSection(quranStructure, 1), uthmani, 'uthmani'),
    );
    expect(verse?.mark).toBe('١');
  });

  it('gives an integrity error rather than a partial text', () => {
    const broken = (ref: VerseRef) => (ref.verse === 3 ? '' : uthmani(ref));
    expect(() => buildSectionBlocks(pageSection(quranStructure, 1), broken, 'uthmani')).toThrow(
      RangeError,
    );
  });
});

describe('the place in the bar while scrolling', () => {
  const segments: SegmentExtent[] = [
    { page: 292, surah: 17, top: 0, bottom: 900 },
    { page: 293, surah: 17, top: 900, bottom: 1200 },
    { page: 293, surah: 18, top: 1200, bottom: 1800 },
  ];

  it('is the segment under the reading line, a third down the screen', () => {
    const height = 600;
    const line = READER_CONFIG.readingLineRatio * height;
    expect(readingPlace(segments, { top: 0, height })).toEqual({ page: 292, surah: 17 });
    expect(readingPlace(segments, { top: 900 - line, height })).toEqual({ page: 293, surah: 17 });
    expect(readingPlace(segments, { top: 1300 - line, height })).toEqual({ page: 293, surah: 18 });
  });

  it('keeps the last segment above the line when the line falls past every segment', () => {
    expect(readingPlace(segments, { top: 5000, height: 600 })).toEqual({ page: 293, surah: 18 });
  });

  it('knows nothing before any segment is measured', () => {
    expect(readingPlace([], { top: 0, height: 600 })).toBeNull();
  });
});

describe('the time a page asks grows with its words (owner, 25 November 2026)', () => {
  let words: readonly number[];
  beforeAll(async () => {
    words = pageWordCounts(await textsOf('uthmani'));
  });

  it('counts the words of each page in the Uthmani text: 77430 in all, 129 for the median page', () => {
    expect(words).toHaveLength(PAGE_COUNT);
    expect(words.reduce((total, count) => total + count, 0)).toBe(77430);
    const sorted = [...words].sort((first, second) => first - second);
    expect(sorted[Math.floor(PAGE_COUNT / 2)]).toBe(129);
    expect(words[0]).toBe(29);
  });

  it('asks about 25 seconds of the median page, the minimum of the shortest, at most about 32', () => {
    const { secondsPerWord, minimumSeconds } = READER_CONFIG.readingTime;
    expect(129 * secondsPerWord).toBeCloseTo(25.8);
    expect(Math.max(minimumSeconds, (words[0] ?? 0) * secondsPerWord)).toBe(minimumSeconds);
    expect(Math.max(...words) * secondsPerWord).toBeLessThanOrEqual(33);
  });
});

describe('a page counts once its section was seen long enough (D8, D41)', () => {
  const HEIGHT = 600;
  /** In these tests every page asks 30 seconds; the time per word is tested above. */
  const RULES: ReadingRules = {
    requiredSecondsOf: () => 30,
    flingScreensPerSecond: READER_CONFIG.flingScreensPerSecond,
  };
  /** Three pages of 900 points, one under the other. */
  const extents: SectionExtent[] = [
    { page: 10, top: 0, bottom: 900 },
    { page: 11, top: 900, bottom: 1800 },
    { page: 12, top: 1800, bottom: 2700 },
  ];

  let tracker: ReadingTracker;
  let counted: number[];
  beforeEach(() => {
    tracker = createReadingTracker();
    counted = [];
  });

  function at(seconds: number, top: number, isForeground = true): void {
    const observation: ReadingObservation = {
      now: seconds * SECOND,
      viewport: { top, height: HEIGHT },
      extents,
      isForeground,
    };
    const result = observeReading(tracker, observation, RULES);
    tracker = result.tracker;
    counted.push(...result.counted);
  }

  /** Scrolls slowly, a reader's pace, from one place to another. */
  function readDown(fromSeconds: number, toSeconds: number, fromTop: number, toTop: number) {
    const steps = toSeconds - fromSeconds;
    for (let step = 0; step <= steps; step += 1) {
      at(fromSeconds + step, fromTop + ((toTop - fromTop) * step) / steps);
    }
  }

  it('a page read from its top to its bottom for 40 seconds counts, once', () => {
    readDown(0, 40, 0, 300);
    expect(counted).toEqual([10]);
    readDown(40, 80, 300, 300);
    expect(counted).toEqual([10]);
  });

  it('a page whose end never came on screen does not count, however long', () => {
    at(0, 0);
    at(120, 0);
    at(240, 200);
    expect(counted).toEqual([]);
  });

  it('a page seen to its end but for less than 30 seconds does not count', () => {
    readDown(0, 20, 0, 300);
    expect(counted).toEqual([]);
  });

  it('flinging past pages counts nothing: no time while the scroll is fast', () => {
    at(0, 0);
    // 120 points every tenth of a second: twice the speed past which nothing is counted.
    for (let step = 1; step <= 30; step += 1) at(step * 0.1, step * 120);
    // Settles at the end of page 12 after a long fling, then reads it.
    at(10, 1800);
    expect(counted).toEqual([]);
  });

  it('shares the time between the pages on screen, by the room each takes', () => {
    // Half of the screen shows the end of page 10, half the top of page 11, for 60 seconds.
    at(0, 0);
    at(1, 600);
    at(61, 600);
    // Page 10 was seen top and bottom; it got half of 60 seconds: it counts.
    expect(counted).toEqual([10]);
    // Page 11 got 30 seconds too but its end was never on screen.
    readDown(61, 70, 600, 1200);
    expect(counted).toEqual([10, 11]);
  });

  it('does not count the time in the background', () => {
    at(0, 0);
    at(1, 300, false);
    at(600, 300, false);
    at(601, 300);
    expect(counted).toEqual([]);
  });

  it('a page counts again only in a new reading session: the journal decides about the khatma (D8)', () => {
    readDown(0, 40, 0, 300);
    readDown(40, 200, 300, 0);
    readDown(200, 260, 0, 300);
    expect(counted).toEqual([10]);
  });

  it('adds up the time of a page across stays: away and back, and across reading sessions', () => {
    readDown(0, 20, 0, 300);
    // Away to page 12 for a while, slowly enough to be reading: page 10 gets nothing there.
    readDown(20, 40, 300, 1800);
    readDown(40, 100, 1800, 1800);
    expect(counted).toEqual([]);
    // The reader closes; a new session starts from what was kept, the time away never counts.
    tracker = createReadingTracker(tracker.pages);
    at(5000, 0);
    at(5011, 0);
    expect(progressOf(tracker, 10).creditedMs).toBeGreaterThanOrEqual(30 * SECOND);
    expect(counted).toEqual([10]);
  });

  it('asks each page its own time', () => {
    const byPage: ReadingRules = { ...RULES, requiredSecondsOf: (page) => (page === 10 ? 8 : 60) };
    const observation = (seconds: number): ReadingObservation => ({
      now: seconds * SECOND,
      viewport: { top: 0, height: HEIGHT },
      extents: [{ page: 10, top: 0, bottom: 500 }],
      isForeground: true,
    });
    let state = observeReading(createReadingTracker(), observation(0), byPage).tracker;
    const result = observeReading(state, observation(8), byPage);
    state = result.tracker;
    expect(result.counted).toEqual([10]);
  });

  it('refuses a clock that goes back', () => {
    at(10, 0);
    expect(() => at(5, 0)).toThrow(RangeError);
  });
});
