import type { QuranScript, VerseKey, VersesBySurah } from '@/domain/quran';

import integrity from '../../../../assets/data/integrity.json';
import uthmaniMinimalVerses from '../../../../assets/data/verses/uthmani-minimal.json';
import uthmaniVerses from '../../../../assets/data/verses/uthmani.json';
import { BUNDLED_PAGE_FILE_COUNT, bundledQuranDataSource } from '../bundled-source';
import type { QuranDataSource } from '../data-files';
import {
  createQuranRepository,
  QURAN_DATA_CONFIG,
  quranRepository,
  quranStructure,
} from '../index';

/** Text of a verse read straight from a verses file; fails loudly if the verse is not there. */
function verseText(verses: VersesBySurah, key: string): string {
  const { surah, verse } = quranStructure.verseRef(key);
  const text = verses[String(surah)]?.[verse - 1];
  if (text === undefined) throw new Error(`Verse ${key} is missing from the verses file`);
  return text;
}

/** The bundled files behind a counter, to see what is loaded and when. */
function countingSource(overrides: Partial<QuranDataSource> = {}) {
  const loads: string[] = [];
  const source: QuranDataSource = {
    loadVerses(script) {
      loads.push(`verses:${script}`);
      return (overrides.loadVerses ?? bundledQuranDataSource.loadVerses)(script);
    },
    loadPageFile(fileIndex) {
      loads.push(`pages:${fileIndex}`);
      return (overrides.loadPageFile ?? bundledQuranDataSource.loadPageFile)(fileIndex);
    },
  };
  return { source, loads };
}

describe('QuranRepository — getPage', () => {
  it('gives page 1 as printed: the header of Al-Fatiha, then its seven verses on seven lines', async () => {
    const page = await quranRepository.getPage(1);

    expect(page.page).toBe(1);
    expect(page.juz).toBe(1);
    expect(page.hizb).toBe(1);
    expect(page.lines).toHaveLength(8);
    expect(page.lines[0]).toEqual({ kind: 'surah-header', surah: 1 });

    const firstVerse = verseText(uthmaniVerses, '1:1').split(' ');
    expect(page.lines[1]).toEqual({
      kind: 'text',
      words: firstVerse.map((text, index) => ({ verseKey: '1:1', position: index + 1, text })),
      verseEnds: [{ afterWordIndex: 3, verse: 1 }],
    });
  });

  it('gives page 2 with a header, a basmala line and the first verses of Al-Baqara', async () => {
    const page = await quranRepository.getPage(2);

    expect(page.lines[0]).toEqual({ kind: 'surah-header', surah: 2 });
    expect(page.lines[1]).toEqual({ kind: 'basmala' });
    expect(page.lines[2]).toMatchObject({
      kind: 'text',
      verseEnds: [{ afterWordIndex: 0, verse: 1 }],
    });
  });

  it('gives the last page with its three surahs', async () => {
    const page = await quranRepository.getPage(604);
    const headers = page.lines.filter((line) => line.kind === 'surah-header');

    expect(headers).toEqual([
      { kind: 'surah-header', surah: 112 },
      { kind: 'surah-header', surah: 113 },
      { kind: 'surah-header', surah: 114 },
    ]);
    expect(page.juz).toBe(30);
    expect(page.hizb).toBe(60);
  });

  it.each([0, 605, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'page %p is refused with an explicit error',
    async (page) => {
      await expect(quranRepository.getPage(page)).rejects.toThrow(RangeError);
      await expect(quranRepository.getPage(page)).rejects.toThrow(/Invalid page/);
    },
  );
});

describe('QuranRepository — getVerse', () => {
  it('gives a verse in the Uthmani script by default, exactly as in the data file', async () => {
    const verse = await quranRepository.getVerse('18:10');

    expect(verse).toEqual({
      surah: 18,
      verse: 10,
      key: '18:10',
      text: verseText(uthmaniVerses, '18:10'),
    });
  });

  it('gives the same verse in the Uthmani-minimal text on request', async () => {
    const verse = await quranRepository.getVerse('18:10', 'uthmani-minimal');

    expect(verse).toEqual({
      surah: 18,
      verse: 10,
      key: '18:10',
      text: verseText(uthmaniMinimalVerses, '18:10'),
    });
    expect(verse.text).not.toBe(verseText(uthmaniVerses, '18:10'));
  });

  it('gives the first and the last verse of the Quran', async () => {
    expect((await quranRepository.getVerse('1:1')).text).toBe(verseText(uthmaniVerses, '1:1'));
    expect((await quranRepository.getVerse('114:6')).text).toBe(verseText(uthmaniVerses, '114:6'));
  });

  it.each(['0:1', '115:1', '1:0', '1:8', '1:300', '2:287', '114:7'])(
    'verse %s does not exist: RangeError',
    async (key) => {
      // Cast on purpose: the type accepts any "<number>:<number>", the data decides.
      await expect(quranRepository.getVerse(key as VerseKey)).rejects.toThrow(RangeError);
    },
  );

  it.each(['', '18', 'abc', '18:10:1', '18-10'])(
    'key "%s" is malformed: TypeError',
    async (key) => {
      await expect(quranRepository.getVerse(key as VerseKey)).rejects.toThrow(TypeError);
    },
  );

  it('an unknown script is refused', async () => {
    const unknown = 'naskh' as QuranScript;
    await expect(quranRepository.getVerse('1:1', unknown)).rejects.toThrow(RangeError);
    await expect(quranRepository.getSurahVerses(1, unknown)).rejects.toThrow(/Invalid script/);
  });
});

describe('QuranRepository — getSurahVerses', () => {
  it('gives the verses of a surah in order, with their keys', async () => {
    const verses = await quranRepository.getSurahVerses(1);

    expect(verses).toHaveLength(7);
    expect(verses.map((verse) => verse.key)).toEqual([
      '1:1',
      '1:2',
      '1:3',
      '1:4',
      '1:5',
      '1:6',
      '1:7',
    ]);
    expect(verses.map((verse) => verse.text)).toEqual(uthmaniVerses['1']);
    expect(verses[6]).toMatchObject({ surah: 1, verse: 7 });
  });

  it('gives the Uthmani-minimal text on request', async () => {
    const verses = await quranRepository.getSurahVerses(112, 'uthmani-minimal');

    expect(verses.map((verse) => verse.text)).toEqual(uthmaniMinimalVerses['112']);
  });

  it.each([0, 115, -1, 1.5, Number.NaN])(
    'surah %p is refused with an explicit error',
    async (surah) => {
      await expect(quranRepository.getSurahVerses(surah)).rejects.toThrow(RangeError);
      await expect(quranRepository.getSurahVerses(surah)).rejects.toThrow(/Invalid surah/);
    },
  );
});

describe('QuranRepository — files are loaded on demand', () => {
  it('loads nothing until something is asked', () => {
    const { source, loads } = countingSource();
    createQuranRepository({ structure: quranStructure, source });

    expect(loads).toEqual([]);
  });

  it('a page loads its page file and the Uthmani verses, nothing else', async () => {
    const { source, loads } = countingSource();
    const repository = createQuranRepository({ structure: quranStructure, source });

    await repository.getPage(45);

    expect(loads.sort()).toEqual(['pages:2', 'verses:uthmani']);
  });

  it('the second text is loaded only when it is asked for', async () => {
    const { source, loads } = countingSource();
    const repository = createQuranRepository({ structure: quranStructure, source });

    await repository.getVerse('2:255');
    expect(loads).toEqual(['verses:uthmani']);

    await repository.getVerse('2:255', 'uthmani-minimal');
    expect(loads).toEqual(['verses:uthmani', 'verses:uthmani-minimal']);
  });

  it('pages of the same file, and later calls, do not load again', async () => {
    const { source, loads } = countingSource();
    const repository = createQuranRepository({ structure: quranStructure, source });

    await repository.getPage(1);
    await repository.getPage(20);
    await repository.getPage(1);
    await repository.getVerse('1:1');
    await repository.getSurahVerses(2);

    expect(loads.sort()).toEqual(['pages:0', 'verses:uthmani']);
  });

  it('calls made at the same time share one load', async () => {
    const { source, loads } = countingSource();
    const repository = createQuranRepository({ structure: quranStructure, source });

    await Promise.all([repository.getPage(1), repository.getPage(2), repository.getPage(3)]);

    expect(loads.sort()).toEqual(['pages:0', 'verses:uthmani']);
  });

  it('an invalid request loads nothing', async () => {
    const { source, loads } = countingSource();
    const repository = createQuranRepository({ structure: quranStructure, source });

    await expect(repository.getPage(605)).rejects.toThrow(RangeError);
    await expect(repository.getVerse('1:300')).rejects.toThrow(RangeError);
    await expect(repository.getSurahVerses(0)).rejects.toThrow(RangeError);

    expect(loads).toEqual([]);
  });
});

describe('QuranRepository — bounded memory cache of page files', () => {
  it('keeps at most `maxCachedPageFiles` page files: an older file is loaded again', async () => {
    const { source, loads } = countingSource();
    const repository = createQuranRepository({
      structure: quranStructure,
      source,
      maxCachedPageFiles: 2,
    });
    const pageLoads = () => loads.filter((load) => load.startsWith('pages:'));

    await repository.getPage(1); // file 0
    await repository.getPage(21); // file 1
    await repository.getPage(41); // file 2: file 0 is dropped
    expect(pageLoads()).toEqual(['pages:0', 'pages:1', 'pages:2']);

    await repository.getPage(22); // file 1 is still there
    expect(pageLoads()).toEqual(['pages:0', 'pages:1', 'pages:2']);

    await repository.getPage(2); // file 0 was dropped: loaded again
    expect(pageLoads()).toEqual(['pages:0', 'pages:1', 'pages:2', 'pages:0']);
  });

  it('gives the same page after its file was dropped and loaded again', async () => {
    const { source } = countingSource();
    const repository = createQuranRepository({
      structure: quranStructure,
      source,
      maxCachedPageFiles: 1,
    });

    const before = await repository.getPage(3);
    await repository.getPage(300);
    const after = await repository.getPage(3);

    expect(after).toEqual(before);
  });

  it('the default keeps three page files', () => {
    expect(QURAN_DATA_CONFIG.maxCachedPageFiles).toBe(3);
  });

  it('refuses a cache without room', () => {
    const { source } = countingSource();
    expect(() =>
      createQuranRepository({ structure: quranStructure, source, maxCachedPageFiles: 0 }),
    ).toThrow(RangeError);
  });
});

describe('QuranRepository — failures are explicit and not remembered', () => {
  it('a failed load is reported and tried again at the next call', async () => {
    let attempts = 0;
    const { source } = countingSource({
      loadPageFile(fileIndex) {
        attempts += 1;
        if (attempts === 1) return Promise.reject(new Error('disk unavailable'));
        return bundledQuranDataSource.loadPageFile(fileIndex);
      },
    });
    const repository = createQuranRepository({ structure: quranStructure, source });

    await expect(repository.getPage(1)).rejects.toThrow('disk unavailable');
    await expect(repository.getPage(1)).resolves.toMatchObject({ page: 1 });
    expect(attempts).toBe(2);
  });

  it('a page file that holds other pages is refused', async () => {
    const { source } = countingSource({
      loadPageFile: () => bundledQuranDataSource.loadPageFile(5),
    });
    const repository = createQuranRepository({ structure: quranStructure, source });

    await expect(repository.getPage(1)).rejects.toThrow(
      /Corrupted Quran data: expected pages 1\.\.20/,
    );
  });

  it('a verses file with a missing surah is refused', async () => {
    const { source } = countingSource({
      loadVerses: async () => ({ ...uthmaniVerses, '114': undefined }),
    });
    const repository = createQuranRepository({ structure: quranStructure, source });

    await expect(repository.getVerse('1:1')).rejects.toThrow(/Corrupted Quran data: surah 114/);
  });

  it('a layout that points to a word that does not exist is refused', async () => {
    const { source } = countingSource({
      loadPageFile: async () => ({
        firstPage: 1,
        lastPage: 20,
        pages: Array.from({ length: 20 }, (_, index) => ({
          page: index + 1,
          lines: [{ surah: 1, words: [[1, 1, 99]] }],
        })),
      }),
    });
    const repository = createQuranRepository({ structure: quranStructure, source });

    await expect(repository.getPage(1)).rejects.toThrow(/Invalid layout of page 1/);
  });
});

describe('Bundled files — what the app ships', () => {
  it('names one page file per run of `pagesPerFile` pages, up to page 604', () => {
    expect(BUNDLED_PAGE_FILE_COUNT).toBe(Math.ceil(604 / QURAN_DATA_CONFIG.pagesPerFile));
    expect(BUNDLED_PAGE_FILE_COUNT).toBe(31);
  });

  it('uses the page-file size recorded by the generator in integrity.json', () => {
    expect(QURAN_DATA_CONFIG.pagesPerFile).toBe(integrity.pagesPerFile);
  });

  it('has no page file after the last one', async () => {
    await expect(bundledQuranDataSource.loadPageFile(BUNDLED_PAGE_FILE_COUNT)).rejects.toThrow(
      RangeError,
    );
    await expect(bundledQuranDataSource.loadPageFile(-1)).rejects.toThrow(RangeError);
  });
});
