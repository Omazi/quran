/**
 * Acceptance tests — integrity of the generated data and of the generation tool.
 * Spec (docs/specs/quran.md):
 *  - "integrity.json : empreinte SHA-256 du texte canonique et compteurs";
 *  - "L'empreinte recalculée est égale à celle de integrity.json";
 *  - "npm run data:verify revérifie les invariants et les empreintes sans régénérer";
 *  - "npm run data:build régénère tout assets/data de façon déterministe".
 *
 * Nothing under assets/ or tools/ is ever changed: tampering and regeneration are tried on
 * a copy made in the system's temporary directory, outside the repository.
 */
import { QURAN_DATA_CONFIG, quranRepository } from '@/data/quran';
import { canonicalQuranText, splitVerseWords } from '@/domain/quran';

import {
  dataFilePath,
  listDataFiles,
  nodeFileSystem,
  nodeOperatingSystem,
  nodePath,
  readJsonFile,
  readRawIntegrity,
  readRawVerses,
  repositoryRoot,
  runNodeScript,
  sha256Hex,
  type RawVerses,
} from './acceptance-kit';

const SURAH_NUMBERS = Array.from({ length: 114 }, (_, index) => index + 1);
const VERIFY_SCRIPT = nodePath.join('tools', 'quran-data', 'verify.mjs');
const BUILD_SCRIPT = nodePath.join('tools', 'quran-data', 'build.mjs');
const SLOW_TEST_TIMEOUT_MS = 60_000;

interface NodeZlib {
  gunzipSync(data: Uint8Array): { toString(encoding: 'utf8'): string };
  gzipSync(data: string): Uint8Array;
}
const nodeZlib = jest.requireActual<NodeZlib>('node:zlib');

/** The canonical text, rebuilt by the tester from the format written in integrity.json. */
function canonicalTextByHand(verses: RawVerses): string {
  let text = '';
  for (const surah of SURAH_NUMBERS) {
    (verses[String(surah)] ?? []).forEach((verse, index) => {
      text += `${surah}|${index + 1}|${verse}\n`;
    });
  }
  return text;
}

function wordCount(verses: RawVerses): number {
  return Object.values(verses)
    .flat()
    .reduce((sum, text) => sum + splitVerseWords(text).length, 0);
}

describe('Invariant — L’empreinte recalculée est égale à celle de integrity.json', () => {
  const integrity = readRawIntegrity();
  const uthmani = readRawVerses('uthmani');
  const minimal = readRawVerses('uthmani-minimal');

  it('canonicalQuranText is the format written in integrity.json, for both texts', () => {
    expect(canonicalQuranText(uthmani)).toBe(canonicalTextByHand(uthmani));
    expect(canonicalQuranText(minimal)).toBe(canonicalTextByHand(minimal));
  });

  it('SHA-256 of the canonical Uthmani text is the recorded fingerprint', () => {
    expect(sha256Hex(canonicalTextByHand(uthmani))).toBe(integrity.canonicalText.uthmaniSha256);
  });

  it('SHA-256 of the canonical Uthmani-minimal text is the recorded fingerprint', () => {
    expect(sha256Hex(canonicalTextByHand(minimal))).toBe(
      integrity.canonicalText.uthmaniMinimalSha256,
    );
  });

  it('the two fingerprints are those published in docs/DATA_SOURCES.md', () => {
    const documentation = nodeFileSystem.readFileSync(
      nodePath.join(repositoryRoot(), 'docs', 'DATA_SOURCES.md'),
      'utf8',
    );
    expect(documentation).toContain(integrity.canonicalText.uthmaniSha256 ?? 'missing');
    expect(documentation).toContain(integrity.canonicalText.uthmaniMinimalSha256 ?? 'missing');
  });

  it('every generated file has the SHA-256 recorded for it, and no file is unrecorded', () => {
    const filesOnDisk = listDataFiles().filter((file) => file !== 'integrity.json');
    expect(Object.keys(integrity.files).sort()).toEqual(filesOnDisk);
    const wrong = filesOnDisk.filter(
      (file) =>
        sha256Hex(nodeFileSystem.readFileSync(dataFilePath(file))) !== integrity.files[file],
    );
    expect(wrong).toEqual([]);
  });

  it('the recorded counts are the real counts', async () => {
    let lineCount = 0;
    for (let page = 1; page <= 604; page += 1) {
      lineCount += (await quranRepository.getPage(page)).lines.length;
    }
    expect(integrity.counts).toEqual({
      surahs: Object.keys(uthmani).length,
      verses: Object.values(uthmani).flat().length,
      pages: 604,
      juz: 30,
      hizb: 60,
      lines: lineCount,
      uthmaniWords: wordCount(uthmani),
      uthmaniMinimalWords: wordCount(minimal),
    });
    expect(integrity.counts.surahs).toBe(114);
    expect(integrity.counts.verses).toBe(6236);
    expect(integrity.counts.lines).toBe(602 * 15 + 2 * 8);
  });

  it('pages are cut as the data layer expects (pagesPerFile)', () => {
    expect(integrity.pagesPerFile).toBe(QURAN_DATA_CONFIG.pagesPerFile);
  });
});

describe('Sources — obligations d’attribution livrées avec les données', () => {
  const notice = nodeFileSystem.readFileSync(dataFilePath('NOTICE.txt'), 'utf8');

  it('names Tanzil as the source of its text, with a link and its copyright notice', () => {
    // Terms reported in docs/DATA_SOURCES.md: source clearly indicated, link to tanzil.net,
    // copyright notice kept with verbatim copies.
    expect(notice).toContain('Tanzil Project');
    expect(notice).toContain('tanzil.net');
    expect(notice).toMatch(/Copyright \(C\) 2007-20\d\d Tanzil Project/);
  });

  it('carries the MIT notices of the layout and structure packages', () => {
    expect(notice).toContain('Mohamad Hajj Rabee');
    expect(notice).toContain('Quran-Center');
    expect(notice).toContain('Permission is hereby granted, free of charge');
  });

  it('credits the publisher of the Uthmani text', () => {
    expect(notice).toContain('hafsData_v18.json');
    expect(notice).toContain('King Fahd Glorious Quran Printing Complex');
  });
});

describe('npm run data:verify et data:build (sur une copie hors du dépôt)', () => {
  let copyRoot = '';

  function pathInCopy(...parts: string[]): string {
    return nodePath.join(copyRoot, ...parts);
  }

  /** Puts the copy back to the state of the repository. */
  function resetCopy(): void {
    const options = { recursive: true, force: true };
    nodeFileSystem.rmSync(pathInCopy('assets'), options);
    nodeFileSystem.rmSync(pathInCopy('tools'), options);
    nodeFileSystem.mkdirSync(pathInCopy('assets'), { recursive: true });
    nodeFileSystem.mkdirSync(pathInCopy('tools'), { recursive: true });
    nodeFileSystem.cpSync(
      nodePath.join(repositoryRoot(), 'assets', 'data'),
      pathInCopy('assets', 'data'),
      { recursive: true },
    );
    nodeFileSystem.cpSync(
      nodePath.join(repositoryRoot(), 'tools', 'quran-data'),
      pathInCopy('tools', 'quran-data'),
      { recursive: true },
    );
  }

  function readInCopy(relativePath: string): string {
    return nodeFileSystem.readFileSync(pathInCopy('assets', 'data', relativePath), 'utf8');
  }

  function writeInCopy(relativePath: string, content: string): void {
    nodeFileSystem.writeFileSync(pathInCopy('assets', 'data', relativePath), content);
  }

  /** Replaces the first occurrence of a text in a file of the copy; fails if it is absent. */
  function replaceInCopy(relativePath: string, search: string, replacement: string): void {
    const content = readInCopy(relativePath);
    if (!content.includes(search)) {
      throw new Error(`Tampering impossible: ${relativePath} does not contain ${search}`);
    }
    writeInCopy(relativePath, content.replace(search, replacement));
  }

  /** What a careful forger would do next: make integrity.json agree with the forged files. */
  function recomputeFingerprintsInCopy(): void {
    // as: integrity.json is an object; only the fields rewritten here are touched.
    const integrity = JSON.parse(readInCopy('integrity.json')) as {
      files: Record<string, string>;
      canonicalText: Record<string, string>;
    };
    for (const file of Object.keys(integrity.files)) {
      const path = pathInCopy('assets', 'data', file);
      if (nodeFileSystem.existsSync(path)) {
        integrity.files[file] = sha256Hex(nodeFileSystem.readFileSync(path));
      }
    }
    // as: the verses files are objects of lists of strings.
    const uthmani = JSON.parse(readInCopy('verses/uthmani.json')) as RawVerses;
    const minimal = JSON.parse(readInCopy('verses/uthmani-minimal.json')) as RawVerses;
    integrity.canonicalText.uthmaniSha256 = sha256Hex(canonicalTextByHand(uthmani));
    integrity.canonicalText.uthmaniMinimalSha256 = sha256Hex(canonicalTextByHand(minimal));
    writeInCopy('integrity.json', `${JSON.stringify(integrity, null, 2)}\n`);
  }

  function verifyCopy(): { passed: boolean; output: string } {
    const result = runNodeScript(VERIFY_SCRIPT, copyRoot);
    return { passed: result.status === 0, output: `${result.stdout}${result.stderr}` };
  }

  function expectTamperingDetected(): void {
    const verification = verifyCopy();
    expect(verification.passed).toBe(false);
    expect(verification.output).toMatch(/failed/i);
  }

  function dataFilesOfCopy(): Map<string, string> {
    const fingerprints = new Map<string, string>();
    const visit = (relativeDirectory: string): void => {
      for (const name of nodeFileSystem.readdirSync(
        pathInCopy('assets', 'data', relativeDirectory),
      )) {
        const relativePath = relativeDirectory === '' ? name : `${relativeDirectory}/${name}`;
        const absolutePath = pathInCopy('assets', 'data', relativePath);
        if (nodeFileSystem.statSync(absolutePath).isDirectory()) {
          visit(relativePath);
        } else {
          fingerprints.set(relativePath, sha256Hex(nodeFileSystem.readFileSync(absolutePath)));
        }
      }
    };
    visit('');
    return fingerprints;
  }

  function dataFilesOfRepository(): Map<string, string> {
    return new Map(
      listDataFiles().map((file) => [
        file,
        sha256Hex(nodeFileSystem.readFileSync(dataFilePath(file))),
      ]),
    );
  }

  beforeAll(() => {
    copyRoot = nodeFileSystem.mkdtempSync(
      nodePath.join(nodeOperatingSystem.tmpdir(), 'quran-data-acceptance-'),
    );
    if (copyRoot.startsWith(repositoryRoot())) {
      throw new Error('The temporary copy must be outside the repository.');
    }
    nodeFileSystem.cpSync(
      nodePath.join(repositoryRoot(), 'package.json'),
      pathInCopy('package.json'),
      { recursive: false },
    );
    // The tool needs its one development dependency; the copy points at the installed one.
    nodeFileSystem.symlinkSync(
      nodePath.join(repositoryRoot(), 'node_modules'),
      pathInCopy('node_modules'),
      'dir',
    );
  });

  beforeEach(() => {
    resetCopy();
  });

  afterAll(() => {
    if (copyRoot !== '') {
      nodeFileSystem.rmSync(copyRoot, { recursive: true, force: true });
    }
  });

  it('"npm run data:verify" is the verification script, and it passes on the repository', () => {
    const packageJson = readJsonFile(nodePath.join(repositoryRoot(), 'package.json'));
    expect(packageJson).toMatchObject({
      scripts: {
        'data:verify': 'node tools/quran-data/verify.mjs',
        'data:build': 'node tools/quran-data/build.mjs',
      },
    });
    const result = runNodeScript(VERIFY_SCRIPT, repositoryRoot());
    expect(`${result.stdout}${result.stderr}`).toMatch(/data:verify passed/);
    expect(result.status).toBe(0);
  });

  it('data:verify changes no file (it verifies "sans régénérer")', () => {
    const before = dataFilesOfCopy();
    expect(verifyCopy().passed).toBe(true);
    expect(dataFilesOfCopy()).toEqual(before);
  });

  it(
    'data:build is deterministic: two runs give identical files, identical to those of the repository',
    () => {
      const first = runNodeScript(BUILD_SCRIPT, copyRoot);
      expect(first.status).toBe(0);
      const afterFirstRun = dataFilesOfCopy();
      const second = runNodeScript(BUILD_SCRIPT, copyRoot);
      expect(second.status).toBe(0);
      expect(dataFilesOfCopy()).toEqual(afterFirstRun);
      expect(afterFirstRun).toEqual(dataFilesOfRepository());
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    'data:build regenerates everything from the sources alone (assets/data emptied first)',
    () => {
      nodeFileSystem.rmSync(pathInCopy('assets', 'data'), { recursive: true, force: true });
      expect(runNodeScript(BUILD_SCRIPT, copyRoot).status).toBe(0);
      expect(dataFilesOfCopy()).toEqual(dataFilesOfRepository());
      expect(verifyCopy().passed).toBe(true);
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  describe('data:verify détecte une altération', () => {
    const BA_KASRA = 'بِ'; // first letter and vowel of the basmala
    const TA_KASRA = 'تِ';

    it('control: the untouched copy passes', () => {
      const verification = verifyCopy();
      expect(verification.output).toMatch(/data:verify passed/);
      expect(verification.passed).toBe(true);
    });

    it('one letter changed in the Uthmani text', () => {
      replaceInCopy('verses/uthmani.json', BA_KASRA, TA_KASRA);
      expectTamperingDetected();
    });

    it('one vowel sign removed from the Uthmani text', () => {
      replaceInCopy('verses/uthmani.json', BA_KASRA, 'ب');
      expectTamperingDetected();
    });

    it('one letter changed in the Uthmani-minimal text', () => {
      replaceInCopy('verses/uthmani-minimal.json', BA_KASRA, TA_KASRA);
      expectTamperingDetected();
    });

    it('two verses swapped in the Uthmani text', () => {
      // as: the verses file is an object of lists of strings.
      const verses = JSON.parse(readInCopy('verses/uthmani.json')) as Record<string, string[]>;
      const surah = verses['112'] ?? [];
      [surah[0], surah[1]] = [surah[1] ?? '', surah[0] ?? ''];
      writeInCopy('verses/uthmani.json', JSON.stringify(verses));
      expectTamperingDetected();
    });

    it('a space added at the end of a verse', () => {
      // as: the verses file is an object of lists of strings.
      const verses = JSON.parse(readInCopy('verses/uthmani.json')) as Record<string, string[]>;
      (verses['114'] ?? [])[5] += ' ';
      writeInCopy('verses/uthmani.json', JSON.stringify(verses));
      expectTamperingDetected();
    });

    it('a page that starts at another verse in structure.json', () => {
      replaceInCopy('structure.json', '"2:6"', '"2:7"');
      expectTamperingDetected();
    });

    it('a hizb that starts at another verse in structure.json', () => {
      replaceInCopy('structure.json', '"2:75"', '"2:76"');
      expectTamperingDetected();
    });

    it('a surah with another verse count in structure.json', () => {
      replaceInCopy('structure.json', '"verseCount": 286', '"verseCount": 285');
      expectTamperingDetected();
    });

    it('a word moved to the next line in a page file', () => {
      replaceInCopy('pages/pages-001-020.json', '[[6,1,9]]', '[[6,1,8]]');
      replaceInCopy('pages/pages-001-020.json', '[[6,10,11],', '[[6,9,11],');
      expectTamperingDetected();
    });

    it('a page file removed', () => {
      nodeFileSystem.unlinkSync(pathInCopy('assets', 'data', 'pages', 'pages-601-604.json'));
      expectTamperingDetected();
    });

    it('a file added that the generation does not produce', () => {
      writeInCopy('verses/simple.json', '{}');
      expectTamperingDetected();
    });

    it('a count changed in integrity.json', () => {
      replaceInCopy('integrity.json', '"verses": 6236', '"verses": 6235');
      expectTamperingDetected();
    });

    it('a fingerprint changed in integrity.json', () => {
      const integrity = readRawIntegrity();
      const recorded = integrity.canonicalText.uthmaniSha256 ?? '';
      replaceInCopy(
        'integrity.json',
        recorded,
        recorded.replace(/^./, recorded.startsWith('0') ? '1' : '0'),
      );
      expectTamperingDetected();
    });

    it('the notice of the licences changed', () => {
      replaceInCopy('NOTICE.txt', 'Tanzil', 'Somebody');
      expectTamperingDetected();
    });

    it('a line feed added at the end of structure.json', () => {
      writeInCopy('structure.json', `${readInCopy('structure.json')}\n`);
      expectTamperingDetected();
    });

    it('one letter changed in the text AND every fingerprint recomputed to match', () => {
      replaceInCopy('verses/uthmani.json', BA_KASRA, TA_KASRA);
      recomputeFingerprintsInCopy();
      expectTamperingDetected();
    });

    it('a word moved to the next line AND every fingerprint recomputed to match', () => {
      replaceInCopy('pages/pages-001-020.json', '[[6,1,9]]', '[[6,1,8]]');
      replaceInCopy('pages/pages-001-020.json', '[[6,10,11],', '[[6,9,11],');
      recomputeFingerprintsInCopy();
      expectTamperingDetected();
    });

    it('a 115th surah added to the text AND every fingerprint recomputed to match', () => {
      // as: the verses file is an object of lists of strings.
      const verses = JSON.parse(readInCopy('verses/uthmani.json')) as Record<string, string[]>;
      verses['115'] = ['بِ'];
      writeInCopy('verses/uthmani.json', JSON.stringify(verses));
      recomputeFingerprintsInCopy();
      expectTamperingDetected();
    });

    it('a source archive of the tool replaced by other text: the verification does not pass', () => {
      const archivePath = pathInCopy('tools', 'quran-data', 'sources', 'hafsData_v18.json.gz');
      // as: the source is one JSON document; the test only changes a letter inside it.
      const altered = nodeZlib
        .gunzipSync(nodeFileSystem.readFileSync(archivePath))
        .toString('utf8')
        .replace(BA_KASRA, TA_KASRA);
      nodeFileSystem.writeFileSync(archivePath, nodeZlib.gzipSync(altered));
      expectTamperingDetected();
    });

    it('a source archive that is no longer an archive: an explicit failure, not a crash', () => {
      const archivePath = pathInCopy('tools', 'quran-data', 'sources', 'hafsData_v18.json.gz');
      nodeFileSystem.writeFileSync(archivePath, 'not a gzip archive');
      const verification = verifyCopy();
      expect(verification.passed).toBe(false);
      expect(verification.output).toMatch(/data:verify failed/);
    });
  });
});
