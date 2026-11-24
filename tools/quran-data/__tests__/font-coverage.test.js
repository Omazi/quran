/**
 * The Quran font shipped with the app must be the verified file, unmodified, and must have a
 * glyph for every code point of the shipped Uthmani text. The font's character map (cmap)
 * is read here directly from the file: no font library is needed.
 */
/* global __dirname -- Jest runs this file as CommonJS */
import { describe, expect, it } from '@jest/globals';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../..');
const FONT_PATH = resolve(ROOT, 'assets/fonts/KFGQPC-HAFS-Uthmanic-Script-v0.18.ttf');
const UTHMANI_PATH = resolve(ROOT, 'assets/data/verses/uthmani.json');

/** SHA-256 of hafs/font/hafs.18.ttf in github.com/ibnhazm/kfgqpc (see assets/fonts/NOTICE.txt). */
const VERIFIED_FONT_SHA256 = 'a0636e68e375af9552470d67773936f54d536e6586ce2608311b2fe7f9cbec3a';

const WINDOWS_PLATFORM = 3;
const UNICODE_BMP_ENCODING = 1;
const SEGMENT_MAPPING_FORMAT = 4;
const LAST_SEGMENT_END = 0xffff;

function tableOffset(font, tag) {
  const tableCount = font.readUInt16BE(4);
  for (let index = 0; index < tableCount; index += 1) {
    const record = 12 + index * 16;
    if (font.toString('latin1', record, record + 4) === tag) return font.readUInt32BE(record + 8);
  }
  throw new Error(`The font has no ${tag} table`);
}

/** Code points (U+0000..U+FFFF) that the font maps to a real glyph: cmap, format 4. */
function mappedCodePoints(font) {
  const cmap = tableOffset(font, 'cmap');
  const subtableCount = font.readUInt16BE(cmap + 2);
  let subtable = null;
  for (let index = 0; index < subtableCount; index += 1) {
    const record = cmap + 4 + index * 8;
    const isUnicodeBmp =
      font.readUInt16BE(record) === WINDOWS_PLATFORM &&
      font.readUInt16BE(record + 2) === UNICODE_BMP_ENCODING;
    if (isUnicodeBmp) subtable = cmap + font.readUInt32BE(record + 4);
  }
  if (subtable === null || font.readUInt16BE(subtable) !== SEGMENT_MAPPING_FORMAT) {
    throw new Error('The font has no Unicode character map in format 4');
  }

  const segmentCount = font.readUInt16BE(subtable + 6) / 2;
  const endCodes = subtable + 14;
  const startCodes = endCodes + segmentCount * 2 + 2;
  const idDeltas = startCodes + segmentCount * 2;
  const idRangeOffsets = idDeltas + segmentCount * 2;

  const mapped = new Set();
  for (let segment = 0; segment < segmentCount; segment += 1) {
    const end = font.readUInt16BE(endCodes + segment * 2);
    const start = font.readUInt16BE(startCodes + segment * 2);
    const delta = font.readUInt16BE(idDeltas + segment * 2);
    const rangeOffsetAt = idRangeOffsets + segment * 2;
    const rangeOffset = font.readUInt16BE(rangeOffsetAt);
    for (let code = start; code <= end && code < LAST_SEGMENT_END; code += 1) {
      const glyph =
        rangeOffset === 0
          ? (code + delta) & 0xffff
          : font.readUInt16BE(rangeOffsetAt + rangeOffset + (code - start) * 2);
      if (glyph !== 0) mapped.add(code);
    }
  }
  return mapped;
}

const hex = (codePoint) => `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;

describe('Quran font — the shipped file is the verified one, unmodified', () => {
  const font = readFileSync(FONT_PATH);

  it('has the checksum of the file published with version 0.18 of the Hafs data', () => {
    expect(createHash('sha256').update(font).digest('hex')).toBe(VERIFIED_FONT_SHA256);
  });

  it('allows embedding without restriction (OS/2 fsType is 0), as the notice says', () => {
    expect(font.readUInt16BE(tableOffset(font, 'OS/2') + 8)).toBe(0);
  });
});

describe('Quran font — every code point of the shipped Uthmani text has a glyph', () => {
  const mapped = mappedCodePoints(readFileSync(FONT_PATH));
  const verses = Object.values(JSON.parse(readFileSync(UTHMANI_PATH, 'utf8'))).flat();
  const usedCodePoints = new Set(verses.flatMap((text) => [...text].map((c) => c.codePointAt(0))));

  it('the character map is really read: a letter is there, a thin space is not', () => {
    expect(mapped.size).toBe(608);
    expect(mapped.has(0x0627)).toBe(true); // alif
    expect(mapped.has(0x2009)).toBe(false); // thin space: in no version of this font
  });

  it('no code point of the 6236 verses is missing from the font', () => {
    expect(verses).toHaveLength(6236);
    expect(usedCodePoints.size).toBe(72);
    const missing = [...usedCodePoints].filter((codePoint) => !mapped.has(codePoint)).map(hex);
    expect(missing).toEqual([]);
  });

  it('the signs whose shape depends on the font version are the ones of version 0.18', () => {
    // 11:41 is written with U+06EA from version 0.18 on, with U+065C before (other glyph).
    expect(usedCodePoints.has(0x06ea)).toBe(true);
    expect(usedCodePoints.has(0x065c)).toBe(false);
    for (const codePoint of [0x0656, 0x0657, 0x065e, 0x06e4, 0x06e9, 0x06ea, 0x06ec, 0x06de]) {
      expect(mapped.has(codePoint)).toBe(true);
    }
  });
});
