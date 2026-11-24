/**
 * Acceptance tests — the canonical text whose fingerprint is kept in integrity.json.
 * Spec (docs/specs/quran.md): "integrity.json : empreinte SHA-256 du texte canonique".
 * Format recorded in integrity.json: one line "<surah>|<verse>|<text>\n" per verse, the
 * 6236 verses in reading order. The fingerprint of the real text is checked in
 * src/data/quran; here the format is checked on a small, hand-made text.
 */
import { canonicalQuranText, type VersesBySurah } from '@/domain/quran';

const SURAH_NUMBERS = Array.from({ length: 114 }, (_, index) => index + 1);

/** 114 surahs of two short verses each: "s<surah>v1" and "s<surah>v2". */
function handMadeVerses(): Record<string, string[]> {
  const verses: Record<string, string[]> = {};
  for (const surah of SURAH_NUMBERS) {
    verses[String(surah)] = [`s${surah}v1`, `s${surah}v2`];
  }
  return verses;
}

function expectExplicitError(action: () => unknown): void {
  let error: unknown;
  try {
    action();
  } catch (caught) {
    error = caught;
  }
  expect(error instanceof RangeError || error instanceof TypeError).toBe(true);
}

describe('Texte canonique — une ligne "<sourate>|<verset>|<texte>" par verset', () => {
  it('writes one line per verse, each ended by a line feed', () => {
    const text = canonicalQuranText(handMadeVerses());
    const expected = SURAH_NUMBERS.map(
      (surah) => `${surah}|1|s${surah}v1\n${surah}|2|s${surah}v2\n`,
    ).join('');
    expect(text).toBe(expected);
  });

  it('orders the surahs by number (2 before 10 before 100), whatever the order of the keys', () => {
    const shuffled: Record<string, string[]> = {};
    for (const surah of [...SURAH_NUMBERS].reverse()) {
      shuffled[`${surah}`] = [`s${surah}v1`, `s${surah}v2`];
    }
    expect(canonicalQuranText(shuffled)).toBe(canonicalQuranText(handMadeVerses()));
    const lines = canonicalQuranText(shuffled).split('\n');
    expect(lines[0]).toBe('1|1|s1v1');
    expect(lines[2]).toBe('2|1|s2v1');
    expect(lines[18]).toBe('10|1|s10v1');
    expect(lines).toHaveLength(114 * 2 + 1);
    expect(lines[114 * 2]).toBe('');
  });

  it('copies the text of a verse character for character', () => {
    const verses = handMadeVerses();
    // Combining marks in mushaf order, a thin space inside a word, the signs of pause.
    const exact = 'فَٱدَّٰرَ ٰٔ ۞|a|';
    verses['2'] = [exact, 's2v2'];
    expect(canonicalQuranText(verses)).toContain(`2|1|${exact}\n2|2|s2v2\n`);
  });

  it('gives the same text for the same verses at each call and does not change them', () => {
    const verses = handMadeVerses();
    const before = JSON.stringify(verses);
    expect(canonicalQuranText(verses)).toBe(canonicalQuranText(verses));
    expect(JSON.stringify(verses)).toBe(before);
  });

  it('two different texts never give the same canonical text', () => {
    const changed = handMadeVerses();
    changed['57'] = ['s57v1', 's57v2 '];
    expect(canonicalQuranText(changed)).not.toBe(canonicalQuranText(handMadeVerses()));
    const moved = handMadeVerses();
    moved['57'] = ['s57v2', 's57v1'];
    expect(canonicalQuranText(moved)).not.toBe(canonicalQuranText(handMadeVerses()));
  });
});

describe('Texte canonique — entrées invalides : erreur explicite', () => {
  it('refuses verses with a surah missing, instead of fingerprinting an incomplete text', () => {
    const verses = handMadeVerses();
    delete verses['57'];
    expectExplicitError(() => canonicalQuranText(verses));
  });

  it('refuses verses with a surah that does not exist', () => {
    const verses = handMadeVerses();
    verses['115'] = ['extra'];
    expectExplicitError(() => canonicalQuranText(verses));
  });

  it.each<unknown>([undefined, null, 'text', 42, []])(
    'refuses %p, which is not a set of verses',
    (value) => {
      // as: simulates a file that is not what the type promises.
      expectExplicitError(() => canonicalQuranText(value as VersesBySurah));
    },
  );
});
