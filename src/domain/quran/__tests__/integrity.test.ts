import integrity from '../../../../assets/data/integrity.json';
import uthmaniMinimalVerses from '../../../../assets/data/verses/uthmani-minimal.json';
import uthmaniVerses from '../../../../assets/data/verses/uthmani.json';
import { canonicalQuranText, type VersesBySurah } from '../integrity';
import { sha256Hex } from '../test-support/quran-test-kit';
import { SURAH_COUNT } from '../types';

/**
 * Fingerprints of the two texts, written here on purpose. If the text of the Quran changes
 * by a single character, this test fails even if the data and integrity.json were
 * regenerated together: changing the text must be a visible, deliberate act.
 */
const PINNED_UTHMANI_SHA256 = '7b2b07124666739062f6992d914f2dc14fda010780aba524467cc56972d5bb0d';
const PINNED_UTHMANI_MINIMAL_SHA256 =
  '432e8775149564af0cf0420b0b427eb90cb25d5d9f2118dc396afd2192814b4b';

function oneVersePerSurah(): Record<string, string[]> {
  const verses: Record<string, string[]> = {};
  for (let surah = 1; surah <= SURAH_COUNT; surah += 1) verses[String(surah)] = [`text ${surah}`];
  return verses;
}

describe('canonicalQuranText — the text that is fingerprinted', () => {
  it('writes one "<surah>|<verse>|<text>" line per verse, surahs in order', () => {
    const verses = oneVersePerSurah();
    verses['2'] = ['first', 'second'];

    const lines = canonicalQuranText(verses).split('\n');

    expect(lines.slice(0, 4)).toEqual(['1|1|text 1', '2|1|first', '2|2|second', '3|1|text 3']);
    expect(lines).toHaveLength(115 + 1);
    expect(lines.at(-1)).toBe('');
  });

  it('does not depend on the order of the keys of the object', () => {
    const reversed: Record<string, string[]> = {};
    for (let surah = SURAH_COUNT; surah >= 1; surah -= 1)
      reversed[String(surah)] = [`text ${surah}`];

    expect(canonicalQuranText(reversed)).toBe(canonicalQuranText(oneVersePerSurah()));
  });

  it.each(['115', '0', '-1', '1.5', '01', 'fatiha'])(
    'a surah that does not exist is refused, never left out in silence: "%s"',
    (key) => {
      const verses = oneVersePerSurah();
      verses[key] = ['extra'];

      expect(() => canonicalQuranText(verses)).toThrow(RangeError);
      expect(() => canonicalQuranText(verses)).toThrow('does not exist');
    },
  );

  it.each<unknown>([undefined, null, 'text', 42, []])('%p is not a set of verses', (value) => {
    // Cast on purpose: simulates a file that is not what the type promises.
    expect(() => canonicalQuranText(value as VersesBySurah)).toThrow(TypeError);
  });

  it('a missing surah raises an explicit error', () => {
    const verses = oneVersePerSurah();
    delete verses['57'];

    expect(() => canonicalQuranText(verses)).toThrow(RangeError);
    expect(() => canonicalQuranText(verses)).toThrow('Surah 57 is missing');
  });
});

describe('Invariant — the recomputed fingerprint equals the one of integrity.json', () => {
  it.each<[string, VersesBySurah, string, string]>([
    ['Uthmani', uthmaniVerses, integrity.canonicalText.uthmaniSha256, PINNED_UTHMANI_SHA256],
    [
      'Uthmani-minimal',
      uthmaniMinimalVerses,
      integrity.canonicalText.uthmaniMinimalSha256,
      PINNED_UTHMANI_MINIMAL_SHA256,
    ],
  ])('%s text', async (_name, verses, recorded, pinned) => {
    const recomputed = await sha256Hex(canonicalQuranText(verses));

    expect(recomputed).toBe(recorded);
    expect(recomputed).toBe(pinned);
  });

  it('a single missing character changes the fingerprint', async () => {
    // The text is never typed by hand, even here: the altered verse is derived from the data.
    const [firstVerse = '', ...otherVerses] = uthmaniVerses['112'];
    const tampered: Record<string, readonly string[]> = {
      ...uthmaniVerses,
      '112': [firstVerse.slice(0, -1), ...otherVerses],
    };

    expect(await sha256Hex(canonicalQuranText(tampered))).not.toBe(PINNED_UTHMANI_SHA256);
  });

  it('integrity.json records the counts of the specification', () => {
    expect(integrity.counts).toMatchObject({
      surahs: 114,
      verses: 6236,
      pages: 604,
      juz: 30,
      hizb: 60,
    });
  });
});
