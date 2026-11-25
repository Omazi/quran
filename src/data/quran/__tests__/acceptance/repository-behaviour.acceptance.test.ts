/**
 * Acceptance tests — behaviour of the repository.
 * Spec (docs/specs/quran.md, livrable 4): "Implémentation de QuranRepository sur les
 * fichiers JSON, avec chargement à la demande et cache mémoire borné", and "Entrées
 * invalides (sourate 0, verset 300 de la sourate 1, page 605) : erreur explicite".
 * types.ts: invalid input REJECTS (the methods return promises).
 */
import {
  createQuranRepository,
  QURAN_DATA_CONFIG,
  quranRepository,
  quranStructure,
  type QuranDataSource,
} from '@/data/quran';
import type { MushafPage, QuranRepository, QuranScript, Verse, VerseKey } from '@/domain/quran';
import { itemAt } from '@/domain/quran/__tests__/acceptance/mushaf-anchors';

import { dataFilePath, nodeFileSystem, readJsonFile } from './acceptance-kit';

const PAGE_FILE_COUNT = 31;
const PAGE_FILE_NAMES = nodeFileSystem.readdirSync(dataFilePath('pages')).sort();

/** Outcome of a call that must not throw synchronously. */
type Outcome = { readonly resolved: unknown } | { readonly rejected: unknown };

async function outcomeOf(call: () => Promise<unknown>): Promise<Outcome> {
  let promise: Promise<unknown>;
  try {
    promise = call();
  } catch (error) {
    throw new Error(`The call threw synchronously instead of rejecting: ${String(error)}`);
  }
  expect(promise).toBeInstanceOf(Promise);
  try {
    return { resolved: await promise };
  } catch (error) {
    return { rejected: error };
  }
}

async function expectExplicitRejection(call: () => Promise<unknown>): Promise<void> {
  const outcome = await outcomeOf(call);
  expect(Object.keys(outcome)).toEqual(['rejected']);
  if ('rejected' in outcome) {
    const error = outcome.rejected;
    expect(error instanceof RangeError || error instanceof TypeError).toBe(true);
    // as: narrowed by the line above; an explicit error says what is wrong.
    expect((error as Error).message.length).toBeGreaterThan(0);
  }
}

async function expectRejection(call: () => Promise<unknown>): Promise<void> {
  const outcome = await outcomeOf(call);
  expect(Object.keys(outcome)).toEqual(['rejected']);
  if ('rejected' in outcome) {
    expect(outcome.rejected).toBeInstanceOf(Error);
  }
}

/** A data source that reads the generated files and records every load. */
interface RecordingSource extends QuranDataSource {
  readonly loads: string[];
}

interface SourceChanges {
  readonly verses?: (script: QuranScript, raw: unknown) => unknown;
  readonly pageFile?: (fileIndex: number, raw: unknown) => unknown;
  readonly failures?: { count: number };
}

function recordingSource(changes: SourceChanges = {}): RecordingSource {
  const loads: string[] = [];
  const failIfAsked = (): void => {
    if (changes.failures !== undefined && changes.failures.count > 0) {
      changes.failures.count -= 1;
      throw new Error('The storage is not available.');
    }
  };
  return {
    loads,
    async loadVerses(script) {
      loads.push(`verses:${script}`);
      failIfAsked();
      const raw = readJsonFile(dataFilePath(`verses/${script}.json`));
      return changes.verses === undefined ? raw : changes.verses(script, raw);
    },
    async loadPageFile(fileIndex) {
      loads.push(`pages:${fileIndex}`);
      failIfAsked();
      const raw = readJsonFile(dataFilePath(`pages/${itemAt(PAGE_FILE_NAMES, fileIndex)}`));
      return changes.pageFile === undefined ? raw : changes.pageFile(fileIndex, raw);
    },
  };
}

function repositoryOn(source: QuranDataSource, maxCachedPageFiles?: number): QuranRepository {
  return createQuranRepository({ structure: quranStructure, source, maxCachedPageFiles });
}

function countOf(loads: readonly string[], entry: string): number {
  return loads.filter((load) => load === entry).length;
}

/** A fixed, shuffled order of the 604 pages (no randomness: the test must be repeatable). */
function shuffledPages(): number[] {
  const pages = Array.from({ length: 604 }, (_, index) => index + 1);
  const STEP_COPRIME_WITH_604 = 229;
  return pages.map((_, index) => ((index * STEP_COPRIME_WITH_604) % 604) + 1);
}

describe('Entrées invalides (sourate 0, verset 300 de la sourate 1, page 605) : erreur explicite', () => {
  it('page 605 rejects with a RangeError', async () => {
    await expect(quranRepository.getPage(605)).rejects.toThrow(RangeError);
  });

  it('sourate 0 rejects with a RangeError', async () => {
    await expect(quranRepository.getSurahVerses(0)).rejects.toThrow(RangeError);
    // as: the key is deliberately wrong.
    await expect(quranRepository.getVerse('0:1' as VerseKey)).rejects.toThrow(RangeError);
  });

  it('verset 300 de la sourate 1 rejects with a RangeError', async () => {
    await expect(quranRepository.getVerse('1:300')).rejects.toThrow(RangeError);
    await expect(quranRepository.getVerse('1:300', 'uthmani-minimal')).rejects.toThrow(RangeError);
  });

  it.each([0, -1, 605, 1.5, 604.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53])(
    'getPage(%p) rejects explicitly and does not throw synchronously',
    async (page) => {
      await expectExplicitRejection(() => quranRepository.getPage(page));
    },
  );

  it.each([0, -1, 115, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'getSurahVerses(%p) rejects explicitly in both scripts',
    async (surah) => {
      await expectExplicitRejection(() => quranRepository.getSurahVerses(surah));
      await expectExplicitRejection(() => quranRepository.getSurahVerses(surah, 'uthmani-minimal'));
    },
  );

  it.each(['1:8', '1:0', '2:287', '114:7', '115:1', '0:0', '9:130', '108:4'])(
    'getVerse("%s") rejects: the verse does not exist',
    async (key) => {
      // as: the key is deliberately wrong.
      await expectExplicitRejection(() => quranRepository.getVerse(key as VerseKey));
      await expectExplicitRejection(() =>
        quranRepository.getVerse(key as VerseKey, 'uthmani-minimal'),
      );
    },
  );

  it.each([
    '',
    'abc',
    '18',
    '18:',
    ':10',
    '18:10:1',
    ' 18:10',
    '18:10 ',
    '018:10',
    '18:010',
    '1e0:1',
  ])('getVerse(%j) rejects: the key is malformed', async (key) => {
    // as: the key is deliberately wrong.
    await expectExplicitRejection(() => quranRepository.getVerse(key as VerseKey));
  });

  it.each(['1', null, undefined, {}, [1], true])(
    'a page or a surah that is not a number (%p) rejects explicitly',
    async (value) => {
      // as: simulates an untyped caller (navigation parameter, stored JSON).
      await expectExplicitRejection(() => quranRepository.getPage(value as number));
      await expectExplicitRejection(() => quranRepository.getSurahVerses(value as number));
    },
  );

  it.each([null, undefined, 1810, {}, ['18:10']])(
    'a verse key that is not a string (%p) rejects explicitly',
    async (value) => {
      // as: simulates an untyped caller.
      await expectExplicitRejection(() => quranRepository.getVerse(value as VerseKey));
    },
  );

  // `imlaei` became a known script with D41; `warsh` stands for any reading the app does not ship.
  it.each(['simple', 'warsh', 'UTHMANI', '', null, 0])(
    'an unknown script (%p) rejects explicitly instead of falling back to another text',
    async (script) => {
      // as: simulates an untyped caller (a stored preference from an older version).
      await expectExplicitRejection(() => quranRepository.getVerse('1:1', script as QuranScript));
      await expectExplicitRejection(() => quranRepository.getSurahVerses(1, script as QuranScript));
    },
  );

  it('still answers correctly after a series of invalid calls', async () => {
    await expectExplicitRejection(() => quranRepository.getPage(605));
    await expectExplicitRejection(() => quranRepository.getVerse('1:300'));
    await expectExplicitRejection(() => quranRepository.getSurahVerses(0));
    expect((await quranRepository.getPage(604)).page).toBe(604);
    expect((await quranRepository.getVerse('114:6')).key).toBe('114:6');
    expect(await quranRepository.getSurahVerses(114)).toHaveLength(6);
  });
});

describe('Appels répétés et concurrents', () => {
  it('the same page asked twice is the same page', async () => {
    const first = await quranRepository.getPage(300);
    const second = await quranRepository.getPage(300);
    expect(second).toEqual(first);
  });

  it('604 pages asked at once, in shuffled order, are the pages asked one by one', async () => {
    const order = shuffledPages();
    expect(new Set(order).size).toBe(604);
    const together = await Promise.all(order.map((page) => quranRepository.getPage(page)));
    expect(together.map((page) => page.page)).toEqual(order);
    for (const page of [1, 2, 187, 300, 585, 604]) {
      const alone = await quranRepository.getPage(page);
      expect(itemAt(together, order.indexOf(page))).toEqual(alone);
    }
  });

  it('jumping between distant pages many times always gives the page asked (cache under stress)', async () => {
    const reference = new Map<number, string>();
    const distantPages = [1, 604, 300, 21, 20, 41, 583, 302, 1, 604];
    for (const page of distantPages) {
      reference.set(page, JSON.stringify(await quranRepository.getPage(page)));
    }
    for (let round = 0; round < 20; round += 1) {
      for (const page of distantPages) {
        expect(JSON.stringify(await quranRepository.getPage(page))).toBe(reference.get(page));
      }
    }
  });

  it('pages, verses and surahs asked together in both scripts do not disturb each other', async () => {
    const [page, verse, minimalVerse, surah, minimalSurah, lastPage] = await Promise.all([
      quranRepository.getPage(50),
      quranRepository.getVerse('3:1'),
      quranRepository.getVerse('3:1', 'uthmani-minimal'),
      quranRepository.getSurahVerses(3),
      quranRepository.getSurahVerses(3, 'uthmani-minimal'),
      quranRepository.getPage(604),
    ]);
    expect(page.page).toBe(50);
    expect(lastPage.page).toBe(604);
    expect(surah).toHaveLength(200);
    expect(minimalSurah).toHaveLength(200);
    expect(itemAt(surah, 0)).toEqual(verse);
    expect(itemAt(minimalSurah, 0)).toEqual(minimalVerse);
    expect(verse.text).not.toBe(minimalVerse.text);
  });

  it('a rejected call next to valid ones does not make them fail', async () => {
    const results = await Promise.allSettled([
      quranRepository.getPage(10),
      quranRepository.getPage(605),
      quranRepository.getVerse('2:255'),
      quranRepository.getVerse('2:999'),
    ]);
    expect(results.map((result) => result.status)).toEqual([
      'fulfilled',
      'rejected',
      'fulfilled',
      'rejected',
    ]);
  });
});

describe('Les résultats ne sont pas modifiables par l’appelant', () => {
  function tryTo(mutate: () => void): void {
    try {
      mutate();
    } catch {
      // A frozen result refuses the change: that is one of the two accepted outcomes.
    }
  }

  it('changing a page that was returned does not change the page returned next', async () => {
    const page = await quranRepository.getPage(1);
    const before = JSON.stringify(page);
    // as: the test deliberately breaks the read-only contract, like careless calling code.
    const mutable = page as unknown as {
      page: number;
      juz: number;
      lines: {
        kind: string;
        words?: { text: string; position: number }[];
        verseEnds?: unknown[];
      }[];
    };
    tryTo(() => {
      mutable.page = 99;
    });
    tryTo(() => {
      mutable.juz = 30;
    });
    tryTo(() => {
      const words = itemAt(mutable.lines, 1).words;
      if (words !== undefined) {
        itemAt(words, 0).text = 'changed';
        itemAt(words, 1).position = 99;
        words.pop();
      }
    });
    tryTo(() => {
      itemAt(mutable.lines, 2).verseEnds?.pop();
    });
    tryTo(() => {
      mutable.lines.pop();
    });
    tryTo(() => {
      itemAt(mutable.lines, 0).kind = 'basmala';
    });
    expect(JSON.stringify(await quranRepository.getPage(1))).toBe(before);
  });

  it('changing a verse or a list of verses does not change later answers', async () => {
    const before = JSON.stringify(await quranRepository.getSurahVerses(112));
    // as: the test deliberately breaks the read-only contract.
    const verses = (await quranRepository.getSurahVerses(112)) as unknown as {
      text: string;
      verse: number;
    }[];
    tryTo(() => {
      itemAt(verses, 0).text = 'changed';
    });
    tryTo(() => {
      itemAt(verses, 1).verse = 99;
    });
    tryTo(() => {
      verses.reverse();
    });
    tryTo(() => {
      verses.pop();
    });
    const verse = (await quranRepository.getVerse('112:3')) as unknown as {
      text: string;
      key: string;
    };
    tryTo(() => {
      verse.text = 'changed';
    });
    tryTo(() => {
      verse.key = '1:1';
    });
    expect(JSON.stringify(await quranRepository.getSurahVerses(112))).toBe(before);
    const again = await quranRepository.getVerse('112:3');
    expect(again.key).toBe('112:3');
    expect(again.text).not.toBe('changed');
    expect(again.text).toBe(itemAt(await quranRepository.getSurahVerses(112), 2).text);
  });

  it('changing the words of a page does not change the text of its verses', async () => {
    const verseBefore = (await quranRepository.getVerse('1:1')).text;
    // as: the test deliberately breaks the read-only contract.
    const page = (await quranRepository.getPage(1)) as unknown as {
      lines: { words?: { text: string }[] }[];
    };
    tryTo(() => {
      const words = itemAt(page.lines, 1).words;
      if (words !== undefined) {
        itemAt(words, 0).text = 'changed';
      }
    });
    expect((await quranRepository.getVerse('1:1')).text).toBe(verseBefore);
  });
});

describe('Chargement à la demande', () => {
  it('creating a repository loads nothing', () => {
    const source = recordingSource();
    repositoryOn(source);
    expect(source.loads).toEqual([]);
  });

  it('reading a verse loads the verses of its script only, and no page', async () => {
    const source = recordingSource();
    const repository = repositoryOn(source);
    await repository.getVerse('2:255');
    expect(source.loads).toEqual(['verses:uthmani']);
    await repository.getVerse('2:255', 'uthmani-minimal');
    expect(source.loads).toEqual(['verses:uthmani', 'verses:uthmani-minimal']);
  });

  it('reading page 1 loads the first page file and the Uthmani verses, nothing else', async () => {
    const source = recordingSource();
    const repository = repositoryOn(source);
    await repository.getPage(1);
    expect([...source.loads].sort()).toEqual(['pages:0', 'verses:uthmani']);
  });

  it('reading page 604 loads the last page file only (file 30)', async () => {
    const source = recordingSource();
    const repository = repositoryOn(source);
    await repository.getPage(604);
    expect(source.loads.filter((load) => load.startsWith('pages:'))).toEqual(['pages:30']);
  });

  it('pages are split into 31 files of 20 pages, as the configuration says', () => {
    expect(QURAN_DATA_CONFIG.pagesPerFile).toBe(20);
    expect(PAGE_FILE_NAMES).toHaveLength(PAGE_FILE_COUNT);
    expect(Math.ceil(604 / QURAN_DATA_CONFIG.pagesPerFile)).toBe(PAGE_FILE_COUNT);
  });

  it('a verses file is loaded once, however many verses are read', async () => {
    const source = recordingSource();
    const repository = repositoryOn(source);
    for (const key of ['1:1', '2:255', '36:1', '114:6'] as const) {
      await repository.getVerse(key);
    }
    await repository.getSurahVerses(18);
    await repository.getPage(293);
    expect(countOf(source.loads, 'verses:uthmani')).toBe(1);
  });

  it('reading the 604 pages in order loads each of the 31 page files exactly once', async () => {
    const source = recordingSource();
    const repository = repositoryOn(source);
    for (let page = 1; page <= 604; page += 1) {
      expect((await repository.getPage(page)).page).toBe(page);
    }
    const pageLoads = source.loads.filter((load) => load.startsWith('pages:'));
    expect(pageLoads).toEqual(
      Array.from({ length: PAGE_FILE_COUNT }, (_, index) => `pages:${index}`),
    );
  });

  it('concurrent reads of the same page file do not load it more than once', async () => {
    const source = recordingSource();
    const repository = repositoryOn(source);
    await Promise.all([1, 2, 3, 4, 5, 20].map((page) => repository.getPage(page)));
    expect(countOf(source.loads, 'pages:0')).toBe(1);
    expect(countOf(source.loads, 'verses:uthmani')).toBe(1);
  });
});

describe('Cache mémoire borné', () => {
  it('keeps at most 3 page files by default (the configuration)', async () => {
    expect(QURAN_DATA_CONFIG.maxCachedPageFiles).toBe(3);
    const source = recordingSource();
    const repository = repositoryOn(source);
    for (const page of [1, 21, 41]) {
      await repository.getPage(page);
    }
    for (const page of [1, 21, 41]) {
      await repository.getPage(page);
    }
    expect(source.loads.filter((load) => load.startsWith('pages:'))).toHaveLength(3);
    // A fourth file pushes the least recently used one (file 0) out: reading it loads it again.
    await repository.getPage(61);
    await repository.getPage(1);
    expect(countOf(source.loads, 'pages:0')).toBe(2);
  });

  it('with room for one file, going back and forth between two files reloads each time', async () => {
    const source = recordingSource();
    const repository = repositoryOn(source, 1);
    for (const page of [1, 21, 1, 21]) {
      expect((await repository.getPage(page)).page).toBe(page);
    }
    expect(source.loads.filter((load) => load.startsWith('pages:'))).toEqual([
      'pages:0',
      'pages:1',
      'pages:0',
      'pages:1',
    ]);
  });

  it('with room for two files, the two most recently read stay loaded', async () => {
    const source = recordingSource();
    const repository = repositoryOn(source, 2);
    for (const page of [1, 21, 1, 21, 20, 40]) {
      await repository.getPage(page);
    }
    expect(source.loads.filter((load) => load.startsWith('pages:'))).toEqual([
      'pages:0',
      'pages:1',
    ]);
    await repository.getPage(41);
    await repository.getPage(21);
    await repository.getPage(1);
    expect(source.loads.filter((load) => load.startsWith('pages:'))).toEqual([
      'pages:0',
      'pages:1',
      'pages:2',
      'pages:0',
    ]);
  });

  it('a page read after its file was dropped and reloaded is the same page', async () => {
    const repository = repositoryOn(recordingSource(), 1);
    const first = JSON.stringify(await repository.getPage(7));
    await repository.getPage(600);
    expect(JSON.stringify(await repository.getPage(7))).toBe(first);
    expect(first).toBe(JSON.stringify(await quranRepository.getPage(7)));
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuses a cache size of %p when the repository is created',
    (size) => {
      let error: unknown;
      try {
        repositoryOn(recordingSource(), size);
      } catch (caught) {
        error = caught;
      }
      expect(error instanceof RangeError || error instanceof TypeError).toBe(true);
    },
  );
});

describe('Source défaillante ou fichiers corrompus : erreur explicite, jamais de texte faux', () => {
  type RawVersesFile = Record<string, unknown[]>;
  type RawPageFile = {
    firstPage: number;
    lastPage: number;
    pages: { page: number; lines: Record<string, unknown>[] }[];
  };

  /** A deep copy that the test may change. as: the generated files have this shape. */
  function copyOfVerses(raw: unknown): RawVersesFile {
    return JSON.parse(JSON.stringify(raw)) as RawVersesFile;
  }

  function copyOfPageFile(raw: unknown): RawPageFile {
    return JSON.parse(JSON.stringify(raw)) as RawPageFile;
  }

  function withVerses(change: (verses: RawVersesFile) => unknown): QuranRepository {
    return repositoryOn(
      recordingSource({
        verses: (_script, raw) => {
          const copy = copyOfVerses(raw);
          const replaced = change(copy);
          return replaced === undefined ? copy : replaced;
        },
      }),
    );
  }

  function withFirstPageFile(change: (file: RawPageFile) => unknown): QuranRepository {
    return repositoryOn(
      recordingSource({
        pageFile: (_index, raw) => {
          const copy = copyOfPageFile(raw);
          const replaced = change(copy);
          return replaced === undefined ? copy : replaced;
        },
      }),
    );
  }

  function firstTextLine(file: RawPageFile): Record<string, unknown> {
    return itemAt(itemAt(file.pages, 0).lines, 1);
  }

  it('control: an unchanged source gives the same answers as the bundled repository', async () => {
    const repository = repositoryOn(recordingSource());
    expect(await repository.getPage(1)).toEqual(await quranRepository.getPage(1));
    expect(await repository.getVerse('2:255')).toEqual(await quranRepository.getVerse('2:255'));
    expect(await repository.getSurahVerses(114, 'uthmani-minimal')).toEqual(
      await quranRepository.getSurahVerses(114, 'uthmani-minimal'),
    );
  });

  it('a storage failure rejects the call, and the next call tries again', async () => {
    const failures = { count: 1 };
    const repository = repositoryOn(recordingSource({ failures }));
    await expectRejection(() => repository.getVerse('1:1'));
    expect((await repository.getVerse('1:1')).key).toBe('1:1');

    failures.count = 1;
    await expectRejection(() => repository.getPage(30));
    expect((await repository.getPage(30)).page).toBe(30);
  });

  it.each<[string, (verses: RawVersesFile) => unknown]>([
    ['a verse missing in surah 2', (verses) => void verses['2']?.splice(100, 1)],
    ['a verse too many in surah 2', (verses) => void verses['2']?.push('extra')],
    ['a surah missing', (verses) => void delete verses['57']],
    ['a surah too many', (verses) => void (verses['115'] = ['extra'])],
    ['a verse that is a number', (verses) => void ((verses['2'] ?? [])[100] = 42)],
    ['a verse that is null', (verses) => void ((verses['2'] ?? [])[100] = null)],
    ['an empty verse', (verses) => void ((verses['2'] ?? [])[100] = '')],
    ['a list instead of an object', () => []],
    ['a text instead of an object', () => 'verses'],
    ['nothing', () => null],
  ])('verses file with %s: reading a verse of surah 2 rejects', async (_name, change) => {
    const repository = withVerses(change);
    await expectRejection(() => repository.getVerse('2:200'));
    await expectRejection(() => repository.getSurahVerses(2));
  });

  it('verses file with a verse missing: no other surah is served either (the file is refused whole)', async () => {
    const repository = withVerses((verses) => void verses['2']?.splice(100, 1));
    await expectRejection(() => repository.getVerse('1:1'));
    await expectRejection(() => repository.getPage(1));
  });

  it.each<[string, (file: RawPageFile) => unknown]>([
    ['the pages of another file', (file) => void file.pages.forEach((page) => (page.page += 20))],
    ['a page missing', (file) => void file.pages.splice(0, 1)],
    ['two pages swapped', (file) => void file.pages.reverse()],
    [
      'a word beyond the end of its verse',
      (file) => void (firstTextLine(file).words = [[1, 1, 5]]),
    ],
    ['a word numbered 0', (file) => void (firstTextLine(file).words = [[1, 0, 4]])],
    [
      'a word position that is not an integer',
      (file) => void (firstTextLine(file).words = [[1, 1.5, 4]]),
    ],
    ['a first word after the last word', (file) => void (firstTextLine(file).words = [[1, 4, 1]])],
    ['a verse that does not exist', (file) => void (firstTextLine(file).words = [[8, 1, 4]])],
    ['a surah that does not exist', (file) => void (firstTextLine(file).surah = 115)],
    ['a line of unknown shape', (file) => void (itemAt(file.pages, 0).lines[1] = { footnote: 1 })],
    ['a line with no word', (file) => void (firstTextLine(file).words = [])],
    [
      'lines that are not a list',
      (file) => void Object.assign(itemAt(file.pages, 0), { lines: 'x' }),
    ],
    ['a list instead of an object', () => []],
    ['nothing', () => null],
  ])('page file with %s: reading page 1 rejects', async (_name, change) => {
    const repository = withFirstPageFile(change);
    await expectRejection(() => repository.getPage(1));
  });

  it('a page never comes back with a word that has no text', async () => {
    const repository = withFirstPageFile((file) => void (firstTextLine(file).words = [[1, 1, 5]]));
    const outcome = await outcomeOf(() => repository.getPage(1));
    if ('resolved' in outcome) {
      // as: a resolved outcome of getPage is a page.
      const page = outcome.resolved as MushafPage;
      const words = page.lines.flatMap((line) => (line.kind === 'text' ? line.words : []));
      expect(words.filter((word) => typeof word.text !== 'string' || word.text === '')).toEqual([]);
    }
    expect(Object.keys(outcome)).toEqual(['rejected']);
  });

  it('a corrupted verses file is never half used: a later call still rejects', async () => {
    const repository = withVerses((verses) => void verses['2']?.splice(100, 1));
    await expectRejection(() => repository.getVerse('2:1'));
    await expectRejection(() => repository.getVerse('2:1'));
    const outcomes: Outcome[] = [];
    for (const key of ['2:100', '2:101', '2:286'] as const) {
      outcomes.push(await outcomeOf(() => repository.getVerse(key)));
    }
    const served = outcomes.filter(
      (outcome): outcome is { resolved: Verse } => 'resolved' in outcome,
    );
    expect(served).toEqual([]);
  });
});
