import {
  PAGE_COUNT,
  type PageLayout,
  type PageLineLayout,
  type QuranScript,
  type QuranStructure,
  type VersesBySurah,
  type WordSegment,
} from '@/domain/quran';

/**
 * Where the generated JSON of `assets/data` comes from. The files are returned as raw,
 * untyped JSON: `readVersesFile` and `readPageFile` check them before anything uses them.
 */
export interface QuranDataSource {
  loadVerses(script: QuranScript): Promise<unknown>;
  /** `fileIndex` is 0 for the first file of `assets/data/pages`, 1 for the second... */
  loadPageFile(fileIndex: number): Promise<unknown>;
}

/** One file of `assets/data/pages`: a run of consecutive pages. */
export interface PageFile {
  readonly firstPage: number;
  readonly lastPage: number;
  readonly pages: readonly PageLayout[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

function corrupted(what: string): Error {
  return new Error(`Corrupted Quran data: ${what}. Regenerate it with "npm run data:build".`);
}

/** Checks a verses file against the structure: 114 surahs, the right number of verses each. */
export function readVersesFile(raw: unknown, structure: QuranStructure): VersesBySurah {
  if (!isRecord(raw)) throw corrupted('the verses file is not an object');
  const knownSurahs = new Set(structure.surahs.map(({ surah }) => String(surah)));
  const unknownKey = Object.keys(raw).find((key) => !knownSurahs.has(key));
  if (unknownKey !== undefined)
    throw corrupted(`the verses file holds an unknown surah "${unknownKey}"`);

  const verses: Record<string, readonly string[]> = {};
  for (const { surah, verseCount } of structure.surahs) {
    const surahVerses = raw[String(surah)];
    if (!Array.isArray(surahVerses) || surahVerses.length !== verseCount) {
      throw corrupted(`surah ${surah} does not have its ${verseCount} verses`);
    }
    if (!surahVerses.every((text): text is string => typeof text === 'string' && text !== '')) {
      throw corrupted(`surah ${surah} has an empty verse`);
    }
    verses[String(surah)] = surahVerses;
  }
  return verses;
}

function readSegment(raw: unknown, where: string): WordSegment {
  if (!Array.isArray(raw) || raw.length !== 3) throw corrupted(`${where}: unreadable words`);
  const [verse, firstWord, lastWord]: unknown[] = raw;
  if (!isPositiveInteger(verse) || !isPositiveInteger(firstWord) || !isPositiveInteger(lastWord)) {
    throw corrupted(`${where}: unreadable words`);
  }
  return [verse, firstWord, lastWord];
}

function readLine(raw: unknown, where: string): PageLineLayout {
  if (!isRecord(raw)) throw corrupted(`${where}: unreadable line`);
  if (isPositiveInteger(raw.header)) return { header: raw.header };
  if (isPositiveInteger(raw.basmala)) return { basmala: raw.basmala };
  if (isPositiveInteger(raw.surah) && Array.isArray(raw.words) && raw.words.length > 0) {
    return { surah: raw.surah, words: raw.words.map((segment) => readSegment(segment, where)) };
  }
  throw corrupted(`${where}: unreadable line`);
}

/** Checks a page file: the expected run of pages, each with readable lines. */
export function readPageFile(
  raw: unknown,
  expectedFirstPage: number,
  pagesPerFile: number,
): PageFile {
  const expectedLastPage = Math.min(expectedFirstPage + pagesPerFile - 1, PAGE_COUNT);
  if (!isRecord(raw) || !Array.isArray(raw.pages)) throw corrupted('unreadable page file');
  if (raw.firstPage !== expectedFirstPage || raw.lastPage !== expectedLastPage) {
    throw corrupted(
      `expected pages ${expectedFirstPage}..${expectedLastPage}, ` +
        `found ${String(raw.firstPage)}..${String(raw.lastPage)}`,
    );
  }
  if (raw.pages.length !== expectedLastPage - expectedFirstPage + 1) {
    throw corrupted(`pages ${expectedFirstPage}..${expectedLastPage} are incomplete`);
  }

  const pages = raw.pages.map((rawPage: unknown, index): PageLayout => {
    const page = expectedFirstPage + index;
    if (!isRecord(rawPage) || rawPage.page !== page || !Array.isArray(rawPage.lines)) {
      throw corrupted(`page ${page} is unreadable`);
    }
    const lines = rawPage.lines.map((line: unknown, lineIndex) =>
      readLine(line, `page ${page}, line ${lineIndex + 1}`),
    );
    return { page, lines };
  });
  return { firstPage: expectedFirstPage, lastPage: expectedLastPage, pages };
}
