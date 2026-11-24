/**
 * Reads the vendored source files and refuses any file whose SHA-256 differs from
 * sources/SHA256SUMS. Nothing here interprets the content: it only returns parsed JSON.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { fail } from './fail.mjs';

export const SOURCES_DIR = fileURLToPath(new URL('../sources', import.meta.url));
export const CHECKSUM_FILE = 'SHA256SUMS';
export const COMPRESSED_SUFFIX = '.gz';
/** The Hafs data published by the King Fahd Complex with version 0.18 of its font. */
export const UTHMANI_FILE = 'hafsData_v18.json';
/** The publisher's own notes on that version. Archived with its checksum; not read. */
export const UTHMANI_NOTES_FILE = 'hafsData_v18.README.md';
export const TANZIL_FILE = 'tanzil_simple.json';
export const PAGE_LAYOUT_FOLDER = 'qpages';

const PAGE_COUNT = 604;
const PAGE_FILE_DIGITS = 3;

export function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

export function pageLayoutFile(page) {
  return `${PAGE_LAYOUT_FOLDER}/${String(page).padStart(PAGE_FILE_DIGITS, '0')}.json`;
}

/** Parses "<sha256>  <name>" lines into a Map(name -> sha256). */
function readExpectedChecksums(sourcesDir) {
  const path = join(sourcesDir, CHECKSUM_FILE);
  if (!existsSync(path)) fail(`Missing checksum list: ${path}`);

  const expected = new Map();
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (line === '') continue;
    const match = /^([0-9a-f]{64}) {2}(\S+)$/.exec(line);
    if (!match) fail(`Unreadable line in ${CHECKSUM_FILE}: "${line}"`);
    expected.set(match[2], match[1]);
  }
  return expected;
}

function listCompressedFiles(sourcesDir, folder = '') {
  const names = [];
  for (const entry of readdirSync(join(sourcesDir, folder), { withFileTypes: true })) {
    const relative = folder === '' ? entry.name : `${folder}/${entry.name}`;
    if (entry.isDirectory()) names.push(...listCompressedFiles(sourcesDir, relative));
    else if (entry.name.endsWith(COMPRESSED_SUFFIX)) {
      names.push(relative.slice(0, -COMPRESSED_SUFFIX.length));
    }
  }
  return names;
}

/**
 * @returns {{ uthmani: unknown, tanzil: unknown, pages: unknown[], checksums: Record<string, string> }}
 *   `pages[0]` is page 1. `checksums` maps each original file name to its SHA-256.
 */
export function readSources(sourcesDir = SOURCES_DIR) {
  const expected = readExpectedChecksums(sourcesDir);
  const required = [UTHMANI_FILE, UTHMANI_NOTES_FILE, TANZIL_FILE];
  for (let page = 1; page <= PAGE_COUNT; page += 1) required.push(pageLayoutFile(page));

  for (const name of required) {
    if (!expected.has(name)) fail(`${CHECKSUM_FILE} has no checksum for required source ${name}`);
  }
  for (const name of [...expected.keys(), ...listCompressedFiles(sourcesDir)]) {
    if (!required.includes(name)) fail(`Unexpected source file: ${name}`);
  }

  const readOriginal = (name) => {
    const path = join(sourcesDir, name + COMPRESSED_SUFFIX);
    if (!existsSync(path)) fail(`Missing source file: ${path}`);
    let original;
    try {
      original = gunzipSync(readFileSync(path));
    } catch (error) {
      fail(`Source ${name}${COMPRESSED_SUFFIX} is not a readable gzip archive (${error.message})`);
    }
    const actual = sha256(original);
    if (actual !== expected.get(name)) {
      fail(
        `Source ${name} does not match its checksum.\n` +
          `  expected ${expected.get(name)}\n  actual   ${actual}\n` +
          'A source is never edited: restore the original file.',
      );
    }
    return original.toString('utf8');
  };
  const readJson = (name) => {
    try {
      return JSON.parse(readOriginal(name));
    } catch (error) {
      if (error instanceof SyntaxError) fail(`Source ${name} is not valid JSON (${error.message})`);
      throw error;
    }
  };
  readOriginal(UTHMANI_NOTES_FILE);

  const pages = [];
  for (let page = 1; page <= PAGE_COUNT; page += 1) pages.push(readJson(pageLayoutFile(page)));

  return {
    uthmani: readJson(UTHMANI_FILE),
    tanzil: readJson(TANZIL_FILE),
    pages,
    checksums: Object.fromEntries([...expected.entries()].sort(([a], [b]) => (a < b ? -1 : 1))),
  };
}
