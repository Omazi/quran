import {
  assertPageNumber,
  buildMushafPage,
  DEFAULT_QURAN_SCRIPT,
  formatVerseKey,
  splitVerseWords,
  type MushafPage,
  type QuranRepository,
  type QuranScript,
  type QuranStructure,
  type Verse,
  type VerseKey,
  type VerseRef,
  type VersesBySurah,
} from '@/domain/quran';

import { BoundedCache } from './bounded-cache';
import { QURAN_DATA_CONFIG } from './config';
import { readPageFile, readVersesFile, type PageFile, type QuranDataSource } from './data-files';

export interface QuranRepositoryOptions {
  readonly structure: QuranStructure;
  readonly source: QuranDataSource;
  /** Defaults to `QURAN_DATA_CONFIG.maxCachedPageFiles`. */
  readonly maxCachedPageFiles?: number;
}

const SCRIPTS: readonly QuranScript[] = ['uthmani', 'uthmani-minimal'];

/** What `Map` and `BoundedCache` have in common: a place to keep loads in progress or done. */
interface PendingLoads<Key, Value> {
  get(key: Key): Promise<Value> | undefined;
  set(key: Key, value: Promise<Value>): void;
  delete(key: Key): void;
}

function assertScript(script: QuranScript): void {
  if (!SCRIPTS.includes(script)) {
    throw new RangeError(`Invalid script: ${String(script)} (expected ${SCRIPTS.join(' or ')})`);
  }
}

/**
 * `QuranRepository` on the generated JSON files.
 *
 * Files are loaded on first use. Page files go through a bounded cache (the least recently
 * used file is dropped). The two verse files stay loaded once used: each is a single file
 * by specification, so there is nothing smaller to drop.
 *
 * Known limit: the cache bounds what this repository holds. With the bundled source, the
 * JavaScript engine also keeps every JSON module it has loaded, so memory is only really
 * bounded with a source that reads files or a database (docs/DECISIONS.md, D3).
 */
export function createQuranRepository(options: QuranRepositoryOptions): QuranRepository {
  const { structure, source } = options;
  const { pagesPerFile } = QURAN_DATA_CONFIG;
  const pageFiles = new BoundedCache<number, Promise<PageFile>>(
    options.maxCachedPageFiles ?? QURAN_DATA_CONFIG.maxCachedPageFiles,
  );
  const versesByScript = new Map<QuranScript, Promise<VersesBySurah>>();

  /** Loads once, shares the pending load between callers, and forgets a failed load. */
  function loadOnce<Key, Value>(
    loads: PendingLoads<Key, Value>,
    key: Key,
    load: () => Promise<Value>,
  ): Promise<Value> {
    const pending = loads.get(key);
    if (pending !== undefined) return pending;

    const loading = load();
    loads.set(key, loading);
    loading.catch(() => {
      if (loads.get(key) === loading) loads.delete(key);
    });
    return loading;
  }

  function versesOf(script: QuranScript): Promise<VersesBySurah> {
    assertScript(script);
    return loadOnce(versesByScript, script, async () =>
      readVersesFile(await source.loadVerses(script), structure),
    );
  }

  function pageFileOf(page: number): Promise<PageFile> {
    const fileIndex = Math.floor((page - 1) / pagesPerFile);
    const firstPage = fileIndex * pagesPerFile + 1;
    return loadOnce(pageFiles, fileIndex, async () =>
      readPageFile(await source.loadPageFile(fileIndex), firstPage, pagesPerFile),
    );
  }

  function textOf(verses: VersesBySurah, ref: VerseRef): string {
    const text = verses[String(ref.surah)]?.[ref.verse - 1];
    if (text === undefined) throw new RangeError(`Invalid verse: ${ref.surah}:${ref.verse}`);
    return text;
  }

  function toVerse(verses: VersesBySurah, ref: VerseRef): Verse {
    return {
      surah: ref.surah,
      verse: ref.verse,
      key: formatVerseKey(ref),
      text: textOf(verses, ref),
    };
  }

  return {
    async getPage(page: number): Promise<MushafPage> {
      assertPageNumber(page);
      const [file, verses] = await Promise.all([pageFileOf(page), versesOf(DEFAULT_QURAN_SCRIPT)]);
      const layout = file.pages[page - file.firstPage];
      if (layout === undefined) throw new RangeError(`Invalid page: ${page}`);
      return buildMushafPage(layout, structure, (ref) => splitVerseWords(textOf(verses, ref)));
    },

    async getVerse(key: VerseKey, script: QuranScript = DEFAULT_QURAN_SCRIPT): Promise<Verse> {
      const ref = structure.verseRef(key);
      return toVerse(await versesOf(script), ref);
    },

    async getSurahVerses(
      surah: number,
      script: QuranScript = DEFAULT_QURAN_SCRIPT,
    ): Promise<readonly Verse[]> {
      const { verseCount } = structure.surah(surah);
      const verses = await versesOf(script);
      return Array.from({ length: verseCount }, (_, index) =>
        toVerse(verses, { surah, verse: index + 1 }),
      );
    },
  };
}
