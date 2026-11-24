import { SURAH_COUNT, type VerseKey, type VerseRef } from './types';
import { assertSurahNumber } from './validation';

const VERSE_KEY_PATTERN = /^(0|[1-9]\d*):(0|[1-9]\d*)$/;

function assertVerseNumber(verse: number): void {
  if (!Number.isSafeInteger(verse) || verse < 1) {
    throw new RangeError(`Invalid verse: ${verse} (expected a whole number, at least 1)`);
  }
}

/**
 * Reads a verse key such as "18:10".
 *
 * Checks the shape of the key and what is known without any data: the surah exists
 * (1..114) and the verse number is at least 1. Whether the surah really has that verse
 * depends on the structure data: use `QuranStructure.verseRef` for a full check.
 */
export function parseVerseKey(key: string): VerseRef {
  const match = typeof key === 'string' ? VERSE_KEY_PATTERN.exec(key) : null;
  if (!match) {
    throw new TypeError(
      `Invalid verse key: ${JSON.stringify(key)} (expected "<surah>:<verse>" such as "18:10", ` +
        `surah from 1 to ${SURAH_COUNT})`,
    );
  }
  const ref: VerseRef = { surah: Number(match[1]), verse: Number(match[2]) };
  assertSurahNumber(ref.surah);
  assertVerseNumber(ref.verse);
  return ref;
}

/** Writes a verse reference as its key, e.g. { surah: 18, verse: 10 } -> "18:10". */
export function formatVerseKey(ref: VerseRef): VerseKey {
  assertSurahNumber(ref.surah);
  assertVerseNumber(ref.verse);
  return `${ref.surah}:${ref.verse}`;
}
