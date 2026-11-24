/**
 * Acceptance tests of the normalisation, written from docs/specs/recognition.md section 1
 * and the public API. Arabic words come from the corpus; single letters and signs are
 * given by code point.
 */
import { normalizeArabic, toAccentKey } from '@/domain/recognition';

import {
  confuseEmphatics,
  confuseGutturals,
  minimalSpellingVerses,
  percent,
  randomInt,
  report,
  requireCorpus,
  seededRandom,
  splitWords,
  toBare,
  toPlene,
  uthmaniCorpus,
  type FlatCorpus,
} from './acceptance-kit';

const describeWithCorpus = uthmaniCorpus() === null ? describe.skip : describe;

/** What a comparable word may hold: Arabic letters, without the tatweel. */
const COMPARABLE_WORD = /^[\u0621-\u063A\u0641-\u064A]+$/;
/** A written token that holds at least one Arabic letter (so: a word, not a lone sign). */
const HOLDS_ARABIC_LETTER = /[\u0621-\u063A\u0641-\u064A\u0671]/;

const TATWEEL = '\u0640';

const SPACES: readonly (readonly [string, string])[] = [
  ['TAB U+0009', '\u0009'],
  ['LINE FEED U+000A', '\u000A'],
  ['CARRIAGE RETURN U+000D', '\u000D'],
  ['NEXT LINE U+0085', '\u0085'],
  ['NO-BREAK SPACE U+00A0', '\u00A0'],
  ['OGHAM SPACE U+1680', '\u1680'],
  ['EN QUAD U+2000', '\u2000'],
  ['EM QUAD U+2001', '\u2001'],
  ['EN SPACE U+2002', '\u2002'],
  ['EM SPACE U+2003', '\u2003'],
  ['THREE-PER-EM SPACE U+2004', '\u2004'],
  ['FOUR-PER-EM SPACE U+2005', '\u2005'],
  ['SIX-PER-EM SPACE U+2006', '\u2006'],
  ['FIGURE SPACE U+2007', '\u2007'],
  ['PUNCTUATION SPACE U+2008', '\u2008'],
  ['LINE SEPARATOR U+2028', '\u2028'],
  ['PARAGRAPH SEPARATOR U+2029', '\u2029'],
  ['MEDIUM MATHEMATICAL SPACE U+205F', '\u205F'],
  ['IDEOGRAPHIC SPACE U+3000', '\u3000'],
];

const NARROW_SPACES: readonly (readonly [string, string])[] = [
  ['THIN SPACE U+2009', '\u2009'],
  ['HAIR SPACE U+200A', '\u200A'],
  ['NARROW NO-BREAK SPACE U+202F', '\u202F'],
];

const INVISIBLE: readonly (readonly [string, string])[] = [
  ['SOFT HYPHEN U+00AD', '\u00AD'],
  ['ARABIC LETTER MARK U+061C', '\u061C'],
  ['ZERO WIDTH NON-JOINER U+200C', '\u200C'],
  ['ZERO WIDTH JOINER U+200D', '\u200D'],
  ['LEFT-TO-RIGHT MARK U+200E', '\u200E'],
  ['RIGHT-TO-LEFT MARK U+200F', '\u200F'],
  ['RIGHT-TO-LEFT EMBEDDING U+202B', '\u202B'],
  ['POP DIRECTIONAL FORMATTING U+202C', '\u202C'],
  ['WORD JOINER U+2060', '\u2060'],
  ['RIGHT-TO-LEFT ISOLATE U+2067', '\u2067'],
  ['POP DIRECTIONAL ISOLATE U+2069', '\u2069'],
  ['BYTE ORDER MARK U+FEFF', '\uFEFF'],
];

const LONE_SIGNS: readonly (readonly [string, string])[] = [
  ['FATHA U+064E', '\u064E'],
  ['SHADDA U+0651', '\u0651'],
  ['SUKUN U+0652', '\u0652'],
  ['SUPERSCRIPT ALEF U+0670', '\u0670'],
  ['SMALL HIGH SAD-LAM-ALEF MAKSURA U+06D6', '\u06D6'],
  ['SMALL HIGH QAF-LAM-ALEF MAKSURA U+06D7', '\u06D7'],
  ['SMALL HIGH MEEM INITIAL U+06D8', '\u06D8'],
  ['SMALL HIGH LAM ALEF U+06D9', '\u06D9'],
  ['SMALL HIGH JEEM U+06DA', '\u06DA'],
  ['SMALL HIGH THREE DOTS U+06DB', '\u06DB'],
  ['SMALL HIGH SEEN U+06DC', '\u06DC'],
  ['END OF AYAH U+06DD', '\u06DD'],
  ['RUB EL HIZB U+06DE', '\u06DE'],
  ['SMALL WAW U+06E5', '\u06E5'],
  ['SMALL YEH U+06E6', '\u06E6'],
  ['PLACE OF SAJDAH U+06E9', '\u06E9'],
  ['SMALL LOW MEEM U+06ED', '\u06ED'],
  ['TATWEEL U+0640', TATWEEL],
];

/** The letter families of the spec's accent-tolerant key, by code point. */
const ACCENT_FAMILIES: readonly (readonly string[])[] = [
  ['\u062D', '\u0647'], // ha' / ha
  ['\u0639', '\u0621'], // ayn / hamza
  ['\u0642', '\u0643'], // qaf / kaf
  ['\u0635', '\u0633', '\u062B'], // sad / sin, tha' / sin
  ['\u0636', '\u062F'], // dad / dal
  ['\u0637', '\u062A'], // ta' emphatic / ta'
  ['\u0630', '\u0632', '\u0638'], // dhal / zay / za' emphatic
];
/** Letters the spec leaves alone: ba', jim, kha', ra', shin, ghayn, fa', lam, mim, nun, waw, ya'. */
const LETTERS_LEFT_ALONE = [
  '\u0628',
  '\u062C',
  '\u062E',
  '\u0631',
  '\u0634',
  '\u063A',
  '\u0641',
  '\u0644',
  '\u0645',
  '\u0646',
  '\u0648',
  '\u064A',
];

function distinctBareWords(corpus: FlatCorpus): string[] {
  const words = new Set<string>();
  for (const verse of corpus.verses) {
    for (const word of splitWords(toBare(verse.text))) words.add(word);
  }
  return [...words];
}

/** Share of the words that hold `pattern` and keep their comparable form once rewritten. */
function unifiedShare(
  words: readonly string[],
  pattern: RegExp,
  rewrite: (word: string) => string,
): { total: number; different: string[] } {
  const different: string[] = [];
  let total = 0;
  for (const word of words) {
    if (!pattern.test(word)) continue;
    total += 1;
    const rewritten = rewrite(word);
    if (normalizeArabic(word).join(' ') !== normalizeArabic(rewritten).join(' ')) {
      different.push(`${word} / ${rewritten}`);
    }
  }
  return { total, different };
}

/** One letter more, one letter less, one letter changed, or something else. */
function kindOfDifference(first: string, second: string): string {
  const one = [...first];
  const other = [...second];
  const name = (letter: string | undefined): string =>
    letter === undefined
      ? '?'
      : `U+${letter.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0')}`;
  if (one.length === other.length) {
    const changed = one.flatMap((letter, position) =>
      letter === other[position] ? [] : [position],
    );
    const at = changed[0];
    if (changed.length === 1 && at !== undefined)
      return `one letter differs: ${name(one[at])} / ${name(other[at])}`;
    return 'several letters differ';
  }
  const [longer, shorter, side] =
    one.length > other.length ? [one, other, 'second spelling'] : [other, one, 'Uthmani'];
  if (longer.length - shorter.length !== 1) return 'more than one letter missing';
  let position = 0;
  while (position < shorter.length && longer[position] === shorter[position]) position += 1;
  const rest = [...longer.slice(0, position), ...longer.slice(position + 1)].join('');
  if (rest !== shorter.join('')) return 'one letter missing and another differs';
  const place = position === 0 ? 'first letter' : 'inner letter';
  return `${side} lacks ${name(longer[position])} (${place})`;
}

describeWithCorpus('Spec 1 — normalisation', () => {
  let corpus: FlatCorpus;
  let first: string;
  let second: string;

  beforeAll(() => {
    corpus = requireCorpus();
    // Two bare words of 1:1, used wherever a test needs "any two words".
    [first = '', second = ''] = splitWords(toBare(corpus.textByKey.get('1:1') ?? ''));
  });

  describe('règle : suite de mots comparables', () => {
    it('empty input, spaces, Latin text, digits, punctuation and emoji give no word', () => {
      const inputs = [
        '',
        ' ',
        ' \t\n ',
        'hello world',
        'Bismillah ar-Rahman',
        '0123456789',
        '\u0661\u0662\u0663 \u06F4\u06F5',
        '.,;:!?()[]"\'-',
        '\u060C \u061B \u061F \u066A \u06D4',
        '\u{1F642}',
        '\u{1F468}\u200D\u{1F469}\u200D\u{1F467} \u{1F1F2}\u{1F1E6} \u2764\uFE0F',
      ];
      for (const input of inputs) expect(normalizeArabic(input)).toEqual([]);
    });

    it('Latin words, digits and emoji around Arabic words leave the Arabic words as they are', () => {
      const expected = normalizeArabic(`${first} ${second}`);
      expect(expected).toHaveLength(2);
      expect(normalizeArabic(`hello ${first} 42 ${second} \u{1F642} world`)).toEqual(expected);
      expect(normalizeArabic(`${first}\u060C ${second}\u061F`)).toEqual(expected);
      expect(normalizeArabic(`(${first}) "${second}".`)).toEqual(expected);
      // Glued to a word: no rule says what the words become, but nothing foreign may remain.
      for (const glued of [
        `abc${first}def`,
        `${first}\u{1F642}${second}`,
        `${first}123${second}`,
      ]) {
        for (const word of normalizeArabic(glued)) expect(word).toMatch(COMPARABLE_WORD);
      }
    });

    it('idempotent: normalising comparable words again changes nothing, in every verse', () => {
      const changed: string[] = [];
      for (const verse of corpus.verses) {
        const words = normalizeArabic(verse.text);
        const again = normalizeArabic(words.join(' '));
        if (again.join(' ') !== words.join(' ')) changed.push(`${verse.surah}:${verse.verse}`);
      }
      expect(changed).toEqual([]);
    });
  });

  describe('règle : retire les signes de vocalisation, les marques d’annotation coraniques, le tatweel', () => {
    it('comparable words hold Arabic letters only, in every verse of both spellings', () => {
      const offenders: string[] = [];
      for (const verse of [...corpus.verses, ...(minimalSpellingVerses() ?? [])]) {
        for (const word of normalizeArabic(verse.text)) {
          if (!COMPARABLE_WORD.test(word)) offenders.push(`${verse.surah}:${verse.verse} ${word}`);
        }
      }
      expect(offenders.slice(0, 10)).toEqual([]);
    });

    it('stripping every mark beforehand (the tester’s own stripping) changes no comparable word (measure), and a tatweel anywhere changes nothing (hard)', () => {
      let sameAsBare = 0;
      let sameAsPlene = 0;
      const tatweelChanged: string[] = [];
      const random = seededRandom(12);
      for (const verse of corpus.verses) {
        const comparable = normalizeArabic(verse.text).join(' ');
        const bare = toBare(verse.text);
        if (normalizeArabic(bare).join(' ') === comparable) sameAsBare += 1;
        if (normalizeArabic(toPlene(verse.text)).join(' ') === comparable) sameAsPlene += 1;
        // A tatweel after one random letter of each word of the bare text.
        const stretched = splitWords(bare)
          .map((word) => {
            const letters = [...word];
            const at = randomInt(random, 1, letters.length);
            return [...letters.slice(0, at), TATWEEL, ...letters.slice(at)].join('');
          })
          .join(' ');
        if (normalizeArabic(stretched).join(' ') !== normalizeArabic(bare).join(' ')) {
          tatweelChanged.push(`${verse.surah}:${verse.verse}`);
        }
      }
      const total = corpus.verses.length;
      report(
        'transcript styles against the Uthmani text (verses with identical comparable words)',
        [
          `bare (all marks stripped by the tester): ${sameAsBare} of ${total} (${percent(sameAsBare, total)})`,
          `plene (superscript alef written as alef): ${sameAsPlene} of ${total} (${percent(sameAsPlene, total)})`,
        ],
      );
      expect(tatweelChanged).toEqual([]);
    });

    it('Quranic small marks and vowel signs standing alone between two words are not words', () => {
      const expected = normalizeArabic(`${first} ${second}`);
      const made = LONE_SIGNS.filter(
        ([, sign]) =>
          normalizeArabic(`${first} ${sign} ${second}`).join(' ') !== expected.join(' '),
      ).map(
        ([name, sign]) =>
          `${name} -> ${JSON.stringify(normalizeArabic(`${first} ${sign} ${second}`))}`,
      );
      expect(made).toEqual([]);
    });
  });

  describe('règle : ne fusionne ni ne coupe jamais de mots', () => {
    it('as many comparable words as written words, in every verse of both spellings', () => {
      const offenders: string[] = [];
      for (const [name, verses] of [
        ['Uthmani', corpus.verses],
        ['second spelling', minimalSpellingVerses() ?? []],
      ] as const) {
        for (const verse of verses) {
          const written = verse.text.split(' ').filter((token) => HOLDS_ARABIC_LETTER.test(token));
          const comparable = normalizeArabic(verse.text);
          if (written.length !== comparable.length) {
            offenders.push(
              `${name} ${verse.surah}:${verse.verse}: ${written.length} written, ${comparable.length} comparable`,
            );
          }
        }
      }
      expect(offenders).toEqual([]);
    });

    it('every Unicode space separates two words, like a plain space (narrow spaces apart, see the next test)', () => {
      const expected = normalizeArabic(`${first} ${second}`);
      const merged = SPACES.filter(
        ([, space]) =>
          normalizeArabic(`${first}${space}${second}`).join(' ') !== expected.join(' '),
      ).map(
        ([name, space]) =>
          `${name} -> ${JSON.stringify(normalizeArabic(`${first}${space}${second}`))}`,
      );
      expect(merged).toEqual([]);
    });

    it('the narrow spaces (thin, hair, narrow no-break) separate two words too', () => {
      // An earlier build of the corpus wrote a thin space inside one word of 2:72, which may be
      // why these three are not separators; the current file holds none. Between two words
      // they are spaces all the same, and the rule says "ne fusionne ... jamais de mots".
      const expected = normalizeArabic(`${first} ${second}`);
      const merged = NARROW_SPACES.filter(
        ([, space]) =>
          normalizeArabic(`${first}${space}${second}`).join(' ') !== expected.join(' '),
      ).map(
        ([name, space]) =>
          `${name} -> ${JSON.stringify(normalizeArabic(`${first}${space}${second}`))}`,
      );
      expect(merged).toEqual([]);
    });

    it('an invisible character inside a word neither cuts it nor changes it', () => {
      const letters = [...second];
      const expected = normalizeArabic(second);
      const cut = INVISIBLE.flatMap(([name, mark]) => {
        const marked = [...letters.slice(0, 2), mark, ...letters.slice(2)].join('');
        const words = normalizeArabic(marked);
        return words.join(' ') === expected.join(' ')
          ? []
          : [`${name} -> ${JSON.stringify(words)}`];
      });
      expect(cut).toEqual([]);
    });
  });

  describe('règle : unifie les formes de alif et de hamza, yâ’/alif maqsûra, tâ’ marbûta', () => {
    it('alef with hamza above, below or madda at the start of a word is the same as a plain alef', () => {
      const result = unifiedShare(distinctBareWords(corpus), /^[\u0623\u0625\u0622]/, (word) =>
        word.replace(/^[\u0623\u0625\u0622]/, '\u0627'),
      );
      expect(result.total).toBeGreaterThan(500);
      expect(result.different.slice(0, 10)).toEqual([]);
    });

    it('hamza on waw or on ya’ is the same as a hamza on the line', () => {
      // Left out: the Uthmani endings "hamza on waw + alef", where the alef belongs to the seat
      // and nobody would write a hamza on the line before it.
      const words = distinctBareWords(corpus).filter((word) => !/[\u0624\u0626]\u0627/.test(word));
      const result = unifiedShare(words, /[\u0624\u0626]/, (word) =>
        word.replace(/[\u0624\u0626]/g, '\u0621'),
      );
      expect(result.total).toBeGreaterThan(100);
      expect(result.different.slice(0, 10)).toEqual([]);
    });

    it('final alef maksura is the same as final ya’; final ta’ marbuta is the same as final ha’', () => {
      const words = distinctBareWords(corpus);
      const maksura = unifiedShare(words, /\u0649$/, (word) => word.replace(/\u0649$/, '\u064A'));
      const marbuta = unifiedShare(words, /\u0629$/, (word) => word.replace(/\u0629$/, '\u0647'));
      expect(maksura.total).toBeGreaterThan(100);
      expect(marbuta.total).toBeGreaterThan(100);
      expect([...maksura.different, ...marbuta.different].slice(0, 10)).toEqual([]);
    });

    it('measure: a hamza on alef inside a word written carelessly as a plain alef', () => {
      const inner = unifiedShare(
        distinctBareWords(corpus),
        /.[\u0623\u0625]/,
        (word) => `${word[0]}${word.slice(1).replace(/[\u0623\u0625]/g, '\u0627')}`,
      );
      report('hamza written carelessly inside a word (distinct words of the text)', [
        `inner alef with hamza written as plain alef: ${inner.different.length} of ${inner.total} words get another comparable form`,
      ]);
      expect(inner.total).toBeGreaterThan(0);
    });
  });

  describe('règle : les deux écritures d’un même mot donnent la même forme dans la grande majorité des cas', () => {
    const itWithSecondSpelling = minimalSpellingVerses() === null ? it.skip : it;

    itWithSecondSpelling(
      'the same verse in the two spellings of the repository (measure over 6236 verses)',
      () => {
        const minimal = minimalSpellingVerses() ?? [];
        expect(minimal).toHaveLength(corpus.verses.length);
        let identical = 0;
        let wordsCompared = 0;
        let wordsDifferent = 0;
        let versesCompared = 0;
        const lengthDiffers: string[] = [];
        const kinds = new Map<string, { count: number; example: string }>();
        corpus.verses.forEach((verse, position) => {
          const other = minimal[position];
          if (other === undefined) return;
          const uthmani = normalizeArabic(verse.text);
          const second = normalizeArabic(other.text);
          if (uthmani.join(' ') === second.join(' ')) {
            identical += 1;
            return;
          }
          if (uthmani.length !== second.length) {
            const writtenFirst = splitWords(verse.text).length;
            const writtenSecond = splitWords(other.text).length;
            lengthDiffers.push(
              `${verse.surah}:${verse.verse} (${uthmani.length} / ${second.length} comparable words; ${writtenFirst} / ${writtenSecond} written)`,
            );
            return;
          }
          versesCompared += 1;
          uthmani.forEach((word, wordPosition) => {
            wordsCompared += 1;
            const otherWord = second[wordPosition] ?? '';
            if (word === otherWord) return;
            wordsDifferent += 1;
            const kind = kindOfDifference(word, otherWord);
            const entry = kinds.get(kind);
            if (entry === undefined) {
              kinds.set(kind, {
                count: 1,
                example: `${verse.surah}:${verse.verse}#${wordPosition + 1} ${word} / ${otherWord}`,
              });
            } else entry.count += 1;
          });
        });
        const total = corpus.verses.length;
        const ranked = [...kinds.entries()].sort((one, other) => other[1].count - one[1].count);
        report('the two spellings of the repository, normalised', [
          `verses with identical comparable words: ${identical} of ${total} (${percent(identical, total)})`,
          `verses with another number of words: ${lengthDiffers.length}: ${lengthDiffers.join(', ')}`,
          `other differing verses: ${versesCompared}, with ${(wordsDifferent / Math.max(1, versesCompared)).toFixed(2)} differing words on average (${wordsDifferent} of their ${wordsCompared} words)`,
          'kinds of differing words (count, first example as "Uthmani / second spelling"):',
          ...ranked
            .slice(0, 12)
            .map(
              ([kind, entry]) =>
                `  ${String(entry.count).padStart(5)}  ${kind}  e.g. ${entry.example}`,
            ),
        ]);
        // "Grande majorité", read as weakly as possible: more than half. The rate is in the report.
        expect(identical / total).toBeGreaterThan(0.5);
      },
    );

    it('measure: different written words that become the same comparable word', () => {
      // The tester's own light unification, to tell "another word" from "another spelling".
      const light = (word: string): string =>
        word
          .replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627')
          .replace(/[\u0624\u0626]/g, '\u0621')
          .replace(/\u0649/g, '\u064A')
          .replace(/\u0629/g, '\u0647');
      const forms = new Map<string, Map<string, { count: number; where: string }>>();
      let tokens = 0;
      for (const verse of corpus.verses) {
        const written = splitWords(toPlene(verse.text));
        normalizeArabic(verse.text).forEach((comparable, position) => {
          tokens += 1;
          const form = light(written[position] ?? '');
          const byForm =
            forms.get(comparable) ?? new Map<string, { count: number; where: string }>();
          forms.set(comparable, byForm);
          const entry = byForm.get(form);
          if (entry === undefined)
            byForm.set(form, { count: 1, where: `${verse.surah}:${verse.verse}#${position + 1}` });
          else entry.count += 1;
        });
      }
      const collisions = [...forms.entries()]
        .filter(([, byForm]) => byForm.size >= 2)
        .map(([comparable, byForm]) => {
          const ranked = [...byForm.entries()].sort((one, other) => other[1].count - one[1].count);
          const minority = ranked.slice(1).reduce((sum, [, entry]) => sum + entry.count, 0);
          return { comparable, ranked, minority };
        })
        .sort((one, other) => other.minority - one.minority);
      const affected = collisions.reduce((sum, collision) => sum + collision.minority, 0);
      report('written words (plene style) that share one comparable word', [
        `${collisions.length} comparable words stand for 2 or more written words; ${affected} of ${tokens} word places (${percent(affected, tokens)}) are not the most common of them`,
        ...collisions.slice(0, 10).map(
          (collision) =>
            `  ${collision.comparable}: ${collision.ranked
              .slice(0, 3)
              .map(([form, entry]) => `${form} x${entry.count} (${entry.where})`)
              .join(', ')}`,
        ),
      ]);
      expect(tokens).toBe(corpus.words.length);
    });
  });

  describe('règle : une seconde clé, tolérante à l’accent', () => {
    it('gives one key to the letters of each family of the spec', () => {
      for (const family of ACCENT_FAMILIES) {
        const keys = new Set(family.map((letter) => toAccentKey(letter)));
        expect([...keys]).toHaveLength(1);
      }
    });

    it('keeps apart the families, and the letters the spec does not list', () => {
      const keys = [
        ...ACCENT_FAMILIES.map((family) => toAccentKey(family[0] ?? '')),
        ...LETTERS_LEFT_ALONE.map((letter) => toAccentKey(letter)),
      ];
      expect(new Set(keys).size).toBe(ACCENT_FAMILIES.length + LETTERS_LEFT_ALONE.length);
    });

    it('a word with one or two confused letters keeps its key, for every word of the text; the key of a key is the key', () => {
      const random = seededRandom(77);
      const changed: string[] = [];
      let confused = 0;
      for (const word of distinctBareWords(corpus)) {
        const key = toAccentKey(word);
        if (toAccentKey(key) !== key) changed.push(`${word}: key of key differs`);
        for (const damage of [confuseEmphatics, confuseGutturals]) {
          const damaged = damage([word], random);
          if (damaged === null) continue;
          confused += 1;
          if (toAccentKey(damaged[0] ?? '') !== key) changed.push(`${word} / ${damaged[0]}`);
        }
      }
      expect(confused).toBeGreaterThan(5000);
      expect(changed.slice(0, 10)).toEqual([]);
    });

    it('takes exactly one word, raw or comparable: same key either way', () => {
      const raw = splitWords(corpus.textByKey.get('1:1') ?? '')[2] ?? '';
      const comparable = normalizeArabic(raw)[0] ?? '';
      expect(toAccentKey(raw)).toBe(toAccentKey(comparable));
      expect(() => toAccentKey(`${first} ${second}`)).toThrow(TypeError);
      expect(() => toAccentKey('')).toThrow(TypeError);
      expect(() => toAccentKey('hello')).toThrow(TypeError);
    });
  });
});
