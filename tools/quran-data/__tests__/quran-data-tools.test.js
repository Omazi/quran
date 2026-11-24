/**
 * Tests of the command-line tools, run as a developer runs them: `data:build` and
 * `data:verify` are started as separate Node processes, on copies of the sources or of
 * the generated data that each test damages in one precise way.
 */
/* global __dirname -- Jest runs this file as CommonJS */
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

const TOOLS_DIR = resolve(__dirname, '..');
const SOURCES_DIR = join(TOOLS_DIR, 'sources');
const DATA_DIR = resolve(TOOLS_DIR, '../../assets/data');
const CHECKSUM_FILE = 'SHA256SUMS';
const ONE_MINUTE = 60_000;

jest.setTimeout(ONE_MINUTE);

const temporaryFolders = [];

function temporaryFolder() {
  const folder = mkdtempSync(join(tmpdir(), 'quran-data-test-'));
  temporaryFolders.push(folder);
  return folder;
}

afterAll(() => {
  for (const folder of temporaryFolders) rmSync(folder, { recursive: true, force: true });
});

function run(tool, args) {
  const result = spawnSync(process.execPath, [join(TOOLS_DIR, tool), ...args], {
    encoding: 'utf8',
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

const build = (sources, out) => run('build.mjs', ['--sources', sources, '--out', out]);
const verify = (data, sources = SOURCES_DIR) =>
  run('verify.mjs', ['--sources', sources, '--data', data]);

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function listFiles(dir, folder = '') {
  return readdirSync(join(dir, folder), { withFileTypes: true })
    .flatMap((entry) => {
      const relative = folder === '' ? entry.name : `${folder}/${entry.name}`;
      return entry.isDirectory() ? listFiles(dir, relative) : [relative];
    })
    .sort();
}

function copyOfSources() {
  const folder = join(temporaryFolder(), 'sources');
  cpSync(SOURCES_DIR, folder, { recursive: true });
  return folder;
}

function copyOfData() {
  const folder = join(temporaryFolder(), 'data');
  cpSync(DATA_DIR, folder, { recursive: true });
  return folder;
}

/**
 * Changes one source file of a copy and, unless told otherwise, records its new checksum:
 * the damaged file then passes the checksum guard and reaches the checks under test.
 */
function editSource(sourcesDir, name, edit, { updateChecksum = true } = {}) {
  const path = join(sourcesDir, `${name}.gz`);
  const json = JSON.parse(gunzipSync(readFileSync(path)).toString('utf8'));
  edit(json);
  const content = Buffer.from(JSON.stringify(json), 'utf8');
  writeFileSync(path, gzipSync(content));

  if (updateChecksum) {
    const checksumPath = join(sourcesDir, CHECKSUM_FILE);
    const lines = readFileSync(checksumPath, 'utf8')
      .split('\n')
      .map((line) => (line.endsWith(`  ${name}`) ? `${sha256(content)}  ${name}` : line));
    writeFileSync(checksumPath, lines.join('\n'));
  }
}

/** The row of a verse in the publisher's file (hafsData_v18.json: one row per verse). */
function rowOf(rows, surah, verse) {
  return rows.find((row) => row.sora === surah && row.aya_no === verse);
}

/** Where the printed verse number starts in `aya_text`: at the no-break space before it. */
function numberStart(row) {
  return row.aya_text.lastIndexOf('\u00A0');
}

function expectBuildToFail(sourcesDir, ...expectedInMessage) {
  const out = join(temporaryFolder(), 'out');
  const result = build(sourcesDir, out);

  expect(result.status).toBe(1);
  expect(result.stderr).toContain('data:build failed');
  for (const expected of expectedInMessage) expect(result.stderr).toContain(expected);
  // Nothing is written when the build fails.
  expect(existsSync(out)).toBe(false);
  return result;
}

describe('data:build — regenerates assets/data deterministically', () => {
  let firstRun;
  let secondRun;

  beforeAll(() => {
    firstRun = join(temporaryFolder(), 'first');
    secondRun = join(temporaryFolder(), 'second');
    expect(build(SOURCES_DIR, firstRun).status).toBe(0);
    expect(build(SOURCES_DIR, secondRun).status).toBe(0);
  });

  it('two runs give identical files', () => {
    const files = listFiles(firstRun);
    expect(listFiles(secondRun)).toEqual(files);
    for (const name of files) {
      expect(readFileSync(join(secondRun, name)).equals(readFileSync(join(firstRun, name)))).toBe(
        true,
      );
    }
  });

  it('the files of assets/data are exactly the ones the build generates', () => {
    const files = listFiles(firstRun);
    expect(listFiles(DATA_DIR)).toEqual(files);
    for (const name of files) {
      expect(readFileSync(join(DATA_DIR, name)).equals(readFileSync(join(firstRun, name)))).toBe(
        true,
      );
    }
  });

  it('writes the verses, the structure, the pages in files of 20 and integrity.json', () => {
    const files = listFiles(firstRun);
    expect(files).toContain('verses/uthmani.json');
    expect(files).toContain('verses/uthmani-minimal.json');
    expect(files).toContain('NOTICE.txt');
    expect(files).toContain('structure.json');
    expect(files).toContain('integrity.json');
    expect(files.filter((name) => name.startsWith('pages/'))).toHaveLength(31);
  });

  it('keeps verses/uthmani.json in the shape { "<surah>": ["verse 1", ...] }', () => {
    const verses = JSON.parse(readFileSync(join(firstRun, 'verses/uthmani.json'), 'utf8'));
    expect(Object.keys(verses)).toEqual(
      Array.from({ length: 114 }, (_, index) => String(index + 1)),
    );
    expect(verses['1']).toHaveLength(7);
    expect(
      Object.values(verses).every((list) => list.every((text) => typeof text === 'string')),
    ).toBe(true);
  });

  it('replaces a previous output, stale files included', () => {
    const out = join(temporaryFolder(), 'out');
    expect(build(SOURCES_DIR, out).status).toBe(0);
    writeFileSync(join(out, 'pages', 'stale.json'), '{}');

    expect(build(SOURCES_DIR, out).status).toBe(0);
    expect(listFiles(out)).toEqual(listFiles(firstRun));
  });

  it('refuses to replace a folder that is not a previous output', () => {
    const out = temporaryFolder();
    writeFileSync(join(out, 'notes.txt'), 'something else');

    const result = build(SOURCES_DIR, out);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('refusing to replace it');
    expect(listFiles(out)).toEqual(['notes.txt']);
  });
});

describe('data:build — no silent fallback: a verse that cannot be aligned stops the build', () => {
  it('two text words written without a space (the known cause) are reported with their verse', () => {
    const sources = copyOfSources();
    editSource(sources, 'hafsData_v18.json', (rows) => {
      const row = rowOf(rows, 2, 6);
      row.aya_text = row.aya_text.replace(' ', '');
    });

    expectBuildToFail(sources, 'Page 3, line 1', 'verse 2:6 cannot be aligned', 'declared.mjs');
  });

  it('a word missing from the text is reported with its verse', () => {
    const sources = copyOfSources();
    editSource(sources, 'hafsData_v18.json', (rows) => {
      const row = rowOf(rows, 18, 10);
      const words = row.aya_text.slice(0, numberStart(row)).split(' ');
      row.aya_text = words.slice(0, -1).join(' ') + row.aya_text.slice(numberStart(row));
    });

    expectBuildToFail(sources, 'verse 18:10 cannot be aligned');
  });

  it('a word missing from the layout is reported with its page and line', () => {
    const sources = copyOfSources();
    editSource(sources, 'qpages/003.json', (page) => {
      page.lines[4].words.pop();
    });

    expectBuildToFail(sources, 'Page 3, line');
  });

  it('a layout word that is not the word of the text at this place is reported', () => {
    const sources = copyOfSources();
    editSource(sources, 'qpages/003.json', (page) => {
      const [first, second] = page.lines[0].words;
      [first.text, second.text] = [second.text, first.text];
    });

    expectBuildToFail(sources, 'Page 3, line 1', 'verse 2:6 cannot be aligned');
  });

  it('a sajda sign the build does not recognise is not silently taken for a word', () => {
    const sources = copyOfSources();
    editSource(sources, 'qpages/176.json', (page) => {
      const sign = page.lines.flatMap((line) => line.words).find((word) => word.text === '#1969');
      sign.text = '#0000';
    });

    expectBuildToFail(sources, 'verse 7:206 cannot be aligned', 'one more word');
  });

  it('a joined word that is declared but not real is refused', () => {
    const sources = copyOfSources();
    editSource(sources, 'hafsData_v18.json', (rows) => {
      const row = rowOf(rows, 36, 22); // declared as starting with a joined word
      const [first, second, ...others] = row.aya_text.split(' ');
      row.aya_text = [second, first, ...others].join(' ');
    });

    expectBuildToFail(sources, 'verse 36:22 cannot be aligned');
  });

  it('a page that would start in the middle of a verse is refused', () => {
    const sources = copyOfSources();
    let moved;
    editSource(sources, 'qpages/003.json', (page) => {
      moved = page.lines.at(-1).words.pop();
    });
    editSource(sources, 'qpages/004.json', (page) => {
      page.lines[0].words.unshift(moved);
    });

    expectBuildToFail(sources, 'Page 4, line 1', 'the page starts in the middle of 2:16');
  });
});

describe('data:build — the verse text is the printed verse minus two documented removals', () => {
  it('removes the verse number and the no-break space after the hizb sign, nothing else', () => {
    const out = join(temporaryFolder(), 'out');
    expect(build(SOURCES_DIR, out).status).toBe(0);
    const verses = JSON.parse(readFileSync(join(out, 'verses/uthmani.json'), 'utf8'));
    const rows = JSON.parse(
      gunzipSync(readFileSync(join(SOURCES_DIR, 'hafsData_v18.json.gz'))).toString('utf8'),
    );

    expect(rows).toHaveLength(6236);
    let withHizbSign = 0;
    for (const row of rows) {
      const text = verses[row.sora][row.aya_no - 1];
      const startsQuarter = row.aya_text.startsWith('\u06DE\u00A0');
      if (startsQuarter) withHizbSign += 1;
      // Putting back what was removed must give the printed verse, character for character.
      const rebuilt =
        (startsQuarter ? '\u06DE\u00A0' + text.slice(1) : text) +
        row.aya_text.slice(numberStart(row));
      expect(rebuilt).toBe(row.aya_text);
      expect(row.aya_text.slice(numberStart(row))).toMatch(/^\u00A0[\u0660-\u0669]+$/u);
    }
    expect(withHizbSign).toBe(199);
  });

  it('a verse that does not end with its own number is refused', () => {
    const sources = copyOfSources();
    editSource(sources, 'hafsData_v18.json', (rows) => {
      const row = rowOf(rows, 2, 6);
      row.aya_text = row.aya_text.slice(0, numberStart(row)) + rowOf(rows, 2, 7).aya_text.slice(-2);
    });

    expectBuildToFail(sources, 'Uthmani source 2:6: the text ends with verse number 7');
  });

  it('a verse without a number at its end is refused', () => {
    const sources = copyOfSources();
    editSource(sources, 'hafsData_v18.json', (rows) => {
      const row = rowOf(rows, 2, 6);
      row.aya_text = row.aya_text.slice(0, numberStart(row));
    });

    expectBuildToFail(sources, 'Uthmani source 2:6: no verse number at the end');
  });

  it('a no-break space anywhere else in a verse is refused, not removed', () => {
    const sources = copyOfSources();
    editSource(sources, 'hafsData_v18.json', (rows) => {
      const row = rowOf(rows, 2, 6);
      row.aya_text = row.aya_text.replace(' ', '\u00A0');
    });

    expectBuildToFail(sources, 'Uthmani source 2:6: unexpected no-break space or digit left');
  });
});

describe('data:build — sources are checked before anything is generated', () => {
  it('a source file that does not match its checksum is refused', () => {
    const sources = copyOfSources();
    editSource(sources, 'hafsData_v18.json', (rows) => rows, { updateChecksum: false });

    expectBuildToFail(sources, 'Source hafsData_v18.json does not match its checksum');
  });

  it('a source file that is not a gzip archive is refused with a clear message, by both tools', () => {
    const sources = copyOfSources();
    writeFileSync(join(sources, 'hafsData_v18.json.gz'), 'not a gzip archive');

    expectBuildToFail(sources, 'Source hafsData_v18.json.gz is not a readable gzip archive');
    const verification = verify(DATA_DIR, sources);
    expect(verification.status).toBe(1);
    expect(verification.stderr).toContain(
      'data:verify failed: Source hafsData_v18.json.gz is not a readable',
    );
    expect(verification.stderr).not.toContain('at ');
  });

  it('a source file that is not JSON is refused with a clear message', () => {
    const sources = copyOfSources();
    const content = Buffer.from('{ not json', 'utf8');
    writeFileSync(join(sources, 'hafsData_v18.json.gz'), gzipSync(content));
    const checksums = readFileSync(join(sources, CHECKSUM_FILE), 'utf8')
      .split('\n')
      .map((line) =>
        line.endsWith('  hafsData_v18.json') ? `${sha256(content)}  hafsData_v18.json` : line,
      );
    writeFileSync(join(sources, CHECKSUM_FILE), checksums.join('\n'));

    expectBuildToFail(sources, 'Source hafsData_v18.json is not valid JSON');
  });

  it("the publisher's notes on its data are archived and checked like the other sources", () => {
    const sources = copyOfSources();
    writeFileSync(join(sources, 'hafsData_v18.README.md.gz'), gzipSync('other notes'));

    expectBuildToFail(sources, 'Source hafsData_v18.README.md does not match its checksum');
  });

  it('a missing source file is refused', () => {
    const sources = copyOfSources();
    rmSync(join(sources, 'qpages', '300.json.gz'));

    expectBuildToFail(sources, 'Missing source file', '300.json.gz');
  });

  it('an unexpected source file is refused', () => {
    const sources = copyOfSources();
    writeFileSync(join(sources, 'qpages', '605.json.gz'), gzipSync('{}'));

    expectBuildToFail(sources, 'Unexpected source file: qpages/605.json');
  });

  it('the two texts must agree: a different word in one of them stops the build', () => {
    const sources = copyOfSources();
    editSource(sources, 'tanzil_simple.json', (file) => {
      const ayah = file.surahs[111].ayat[0]; // 112:1
      const words = ayah.text.split(' ');
      ayah.text = [words[1], words[0], ...words.slice(2)].join(' ');
    });

    expectBuildToFail(sources, 'Texts disagree at 112:1 word 1');
  });

  it('a page with a missing line is refused', () => {
    const sources = copyOfSources();
    editSource(sources, 'qpages/010.json', (page) => {
      page.lines.pop();
    });

    expectBuildToFail(sources, 'Page 10: expected 15 lines, found 14');
  });
});

describe('data:verify — checks the generated files without regenerating them', () => {
  it('passes on the files of assets/data and reports the counts', () => {
    const result = verify(DATA_DIR);

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('114 surahs, 6236 verses, 604 pages, 30 juz, 60 hizb');
  });

  it('does not write anything', () => {
    const data = copyOfData();
    const before = listFiles(data).map((name) => sha256(readFileSync(join(data, name))));

    expect(verify(data).status).toBe(0);

    expect(listFiles(data).map((name) => sha256(readFileSync(join(data, name))))).toEqual(before);
  });

  it('refuses a verse edited by hand', () => {
    const data = copyOfData();
    const path = join(data, 'verses/uthmani.json');
    const verses = JSON.parse(readFileSync(path, 'utf8'));
    writeFileSync(
      path,
      readFileSync(path, 'utf8').replace(verses['1'][0], verses['1'][0].slice(0, -1)),
    );

    const result = verify(data);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('data:verify failed');
    expect(result.stderr).toContain('verses/uthmani.json does not match its checksum');
  });

  it('refuses an edited verse even when integrity.json was recomputed to hide it', () => {
    const data = copyOfData();
    const versesPath = join(data, 'verses/uthmani.json');
    const verses = JSON.parse(readFileSync(versesPath, 'utf8'));
    const edited = readFileSync(versesPath, 'utf8').replace(
      verses['1'][0],
      verses['1'][0].slice(0, -1),
    );
    writeFileSync(versesPath, edited);

    const editedVerses = JSON.parse(edited);
    let canonical = '';
    for (let surah = 1; surah <= 114; surah += 1) {
      editedVerses[surah].forEach((text, index) => {
        canonical += `${surah}|${index + 1}|${text}\n`;
      });
    }
    const integrityPath = join(data, 'integrity.json');
    const integrity = JSON.parse(readFileSync(integrityPath, 'utf8'));
    integrity.files['verses/uthmani.json'] = sha256(edited);
    integrity.canonicalText.uthmaniSha256 = sha256(canonical);
    writeFileSync(integrityPath, JSON.stringify(integrity, null, 2) + '\n');

    const result = verify(data);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('1:1 differs');
  });

  it('refuses an edited page file', () => {
    const data = copyOfData();
    const path = join(data, 'pages/pages-001-020.json');
    writeFileSync(path, readFileSync(path, 'utf8').replace('[[1,1,4]]', '[[1,1,3]]'));

    const result = verify(data);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('pages/pages-001-020.json does not match its checksum');
  });

  /** Edits a page file of a copy and records its new checksum, as someone hiding the edit would. */
  function editPagesHidingIt(data, name, before, after) {
    const path = join(data, name);
    const original = readFileSync(path, 'utf8');
    expect(original).toContain(before);
    const edited = original.replace(before, after);
    writeFileSync(path, edited);

    const integrityPath = join(data, 'integrity.json');
    const integrity = JSON.parse(readFileSync(integrityPath, 'utf8'));
    integrity.files[name] = sha256(edited);
    writeFileSync(integrityPath, JSON.stringify(integrity, null, 2) + '\n');
  }

  it('refuses a word dropped from a page even when its checksum was recomputed', () => {
    const data = copyOfData();
    // Page 1, line 2: the four words of 1:1 become three.
    editPagesHidingIt(data, 'pages/pages-001-020.json', '[[1,1,4]]', '[[1,1,3]]');

    const result = verify(data);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Page 1, line 3: expected 1:1 word 4, found 1:2 word 1');
  });

  it('refuses a word moved to the next line even when its checksum was recomputed', () => {
    const data = copyOfData();
    // Page 1: the last word of line 5 (1:6 word 1) is moved to the start of line 6.
    editPagesHidingIt(
      data,
      'pages/pages-001-020.json',
      '{"surah":1,"words":[[5,1,4],[6,1,1]]},{"surah":1,"words":[[6,2,3],[7,1,3]]}',
      '{"surah":1,"words":[[5,1,4]]},{"surah":1,"words":[[6,1,3],[7,1,3]]}',
    );

    const result = verify(data);

    // Every word is still there once and in order: only the comparison with the build sees it.
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('pages/pages-001-020.json is not what data:build generates');
  });

  it('refuses a missing file and an extra file', () => {
    const missing = copyOfData();
    rmSync(join(missing, 'pages/pages-601-604.json'));
    expect(verify(missing).status).toBe(1);
    expect(verify(missing).stderr).toContain('missing: pages/pages-601-604.json');

    const extra = copyOfData();
    writeFileSync(join(extra, 'verses/other.json'), '{}');
    expect(verify(extra).status).toBe(1);
    expect(verify(extra).stderr).toContain('on disk: verses/other.json');
  });

  it('refuses data generated from other sources than the vendored ones', () => {
    const sources = copyOfSources();
    editSource(sources, 'hafsData_v18.json', (rows) => {
      rows[0].sora_name_en = 'Al-Fatiha';
    });

    const result = verify(DATA_DIR, sources);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('data:verify failed');
  });
});
