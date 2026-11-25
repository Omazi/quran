import {
  buildMushafPage,
  createQuranStructure,
  PAGE_COUNT,
  splitVerseWords,
  type MushafPage,
  type PageLayout,
  type QuranStructureData,
  type VersesBySurah,
} from '@/domain/quran';

import structureFile from '../../../../assets/data/structure.json';
import versesFile from '../../../../assets/data/verses/uthmani.json';

const PAGES_PER_FILE = 20;

/**
 * The generated page files, read with `require` like the app's bundled source does. Each file is
 * `{ firstPage, lastPage, pages }` (docs/specs/quran.md).
 */
function loadPageLayouts(): PageLayout[] {
  const layouts: PageLayout[] = [];
  for (let first = 1; first <= PAGE_COUNT; first += PAGES_PER_FILE) {
    const last = Math.min(first + PAGES_PER_FILE - 1, PAGE_COUNT);
    const name = `pages-${String(first).padStart(3, '0')}-${String(last).padStart(3, '0')}`;
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- one file per name, as in the app
    const file = require(`../../../../assets/data/pages/${name}.json`) as { pages: PageLayout[] };
    layouts.push(...file.pages);
  }
  return layouts;
}

/**
 * The 604 pages of the real mushaf, built exactly as the app's repository builds them: the
 * layout files plus the Uthmani verses. Tests of the real totals use this and nothing else.
 */
export function loadWholeMushaf(): MushafPage[] {
  // JSON imports are plain data: the structure file has the shape of QuranStructureData and the
  // verses file the shape of VersesBySurah (both are checked by the data tests and data:verify).
  const structure = createQuranStructure(structureFile as unknown as QuranStructureData);
  const verses = versesFile as unknown as VersesBySurah;
  return loadPageLayouts().map((layout) =>
    buildMushafPage(layout, structure, ({ surah, verse }) => {
      const text = verses[String(surah)]?.[verse - 1];
      if (text === undefined) throw new RangeError(`No verse ${surah}:${verse}`);
      return splitVerseWords(text);
    }),
  );
}

/** Every word of the Uthmani text, verse by verse: the totals the pages must add up to. */
export function allVerseTexts(): string[] {
  return Object.values(versesFile as unknown as VersesBySurah).flat();
}
