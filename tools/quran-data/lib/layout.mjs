/**
 * Reads one page of the layout source (qpages) into a small, checked shape:
 *
 *   { page, lines: [ { kind: 'surah-header', surah }
 *                  | { kind: 'basmala', surah }
 *                  | { kind: 'text', items: [{ kind, verseKey, position, text }] } ] }
 *
 * Item kinds: 'word', 'quarter-sign' (۞), 'sajda-sign' (۩) and 'verse-end'.
 * The glyph codes and font names of the source are not read: the app does not use them.
 */
import { LAYOUT_SAJDA_PLACEHOLDER } from './declared.mjs';
import { fail } from './fail.mjs';

export const LINES_PER_PAGE = 15;
/** The two opening pages are framed and shorter in the printed mushaf. */
export const LINES_ON_OPENING_PAGES = 8;
export const OPENING_PAGES = Object.freeze([1, 2]);

const ITEM_KIND_BY_SOURCE_TYPE = Object.freeze({
  word: 'word',
  quarter: 'quarter-sign',
  end: 'verse-end',
});

function readTextItem(item, where) {
  const kind = ITEM_KIND_BY_SOURCE_TYPE[item.type];
  if (kind === undefined) fail(`${where}: unknown item type "${item.type}" in a text line`);
  if (typeof item.verse_key !== 'string') fail(`${where}: item without a verse key`);

  const isSajdaSign = kind === 'word' && item.text === LAYOUT_SAJDA_PLACEHOLDER;
  return {
    kind: isSajdaSign ? 'sajda-sign' : kind,
    verseKey: item.verse_key,
    position: item.position,
    text: item.text,
  };
}

function readLine(line, where) {
  const items = line.words;
  if (!Array.isArray(items) || items.length === 0) fail(`${where}: empty line`);

  const firstType = items[0].type;
  if (firstType === 'surah_header' || firstType === 'bismillah') {
    if (items.length !== 1) fail(`${where}: a ${firstType} line must hold a single item`);
    if (!Number.isInteger(items[0].sura)) fail(`${where}: ${firstType} without a surah number`);
    const kind = firstType === 'surah_header' ? 'surah-header' : 'basmala';
    return { kind, surah: items[0].sura };
  }
  return { kind: 'text', items: items.map((item) => readTextItem(item, where)) };
}

export function readPageLayout(raw, expectedPage) {
  if (raw.page !== expectedPage) {
    fail(`Layout file of page ${expectedPage} describes page ${raw.page}`);
  }
  if (!Array.isArray(raw.lines)) fail(`Page ${expectedPage}: no lines`);

  const expectedLines = OPENING_PAGES.includes(expectedPage)
    ? LINES_ON_OPENING_PAGES
    : LINES_PER_PAGE;
  if (raw.lines.length !== expectedLines) {
    fail(`Page ${expectedPage}: expected ${expectedLines} lines, found ${raw.lines.length}`);
  }

  const lines = raw.lines.map((line, index) => {
    const where = `Page ${expectedPage}, line ${index + 1}`;
    if (line.line !== index + 1) fail(`${where}: the source numbers this line ${line.line}`);
    return readLine(line, where);
  });
  return { page: expectedPage, lines };
}
