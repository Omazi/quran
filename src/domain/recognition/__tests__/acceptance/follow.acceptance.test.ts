/**
 * Acceptance tests of the word-by-word follow-along, written from
 * docs/specs/recognition.md section 3 ("Suivi mot à mot") and the public API.
 * Expected words are the raw words of the corpus (what the screen shows); heard words are
 * the same words in a transcript style of the acceptance kit, damaged or not.
 */
import { createFollowSession } from '@/domain/recognition';
import type { FollowSession, FollowSnapshot, WordStatus } from '@/domain/recognition';

import {
  confuseEmphatics,
  confuseGutturals,
  confuseOutsideSpecList,
  disturbLongVowel,
  doubleOneWord,
  dropShortParticle,
  mergeTwoWords,
  pick,
  randomInt,
  rawWords,
  report,
  requireCorpus,
  seededRandom,
  splitOneWord,
  splitWords,
  toBare,
  toPlene,
  transcriptOf,
  uthmaniCorpus,
  verseText,
  type Damage,
  type FlatCorpus,
  type Passage,
  type Random,
} from './acceptance-kit';

const describeWithCorpus = uthmaniCorpus() === null ? describe.skip : describe;

/** One letter per status, to read a whole reading at a glance in a failure message. */
function picture(snapshot: FollowSnapshot): string {
  const letter: Record<WordStatus, string> = {
    read: 'R',
    current: '>',
    upcoming: '.',
    skipped: 'S',
    mistake: 'M',
  };
  return snapshot.statuses.map((status) => letter[status]).join('');
}

function countOf(snapshot: FollowSnapshot, status: WordStatus): number {
  return snapshot.statuses.filter((one) => one === status).length;
}

/** What must hold after every feed, whatever was heard. Returns the broken rules. */
function brokenInvariants(before: FollowSnapshot, after: FollowSnapshot): string[] {
  const broken: string[] = [];
  if (after.statuses.length !== before.statuses.length) broken.push('number of statuses changed');
  const current = countOf(after, 'current');
  if (after.currentIndex === null) {
    if (current !== 0) broken.push('currentIndex is null but a word is current');
  } else {
    if (current !== 1) broken.push(`${current} current words`);
    if (after.statuses[after.currentIndex] !== 'current')
      broken.push('currentIndex is not the current word');
  }
  before.statuses.forEach((status, position) => {
    if (status === 'read' && after.statuses[position] !== 'read') {
      broken.push(`word ${position} was read and became ${after.statuses[position]}`);
    }
  });
  if (!Number.isInteger(after.unmatchedStreak) || after.unmatchedStreak < 0) {
    broken.push(`unmatchedStreak ${after.unmatchedStreak}`);
  }
  return broken;
}

interface Reading {
  readonly final: FollowSnapshot;
  /** Every snapshot, one per feed call. */
  readonly steps: readonly FollowSnapshot[];
  readonly broken: readonly string[];
}

/** Feeds `heard` in chunks of `chunk` words and checks the invariants at every step. */
function read(expected: readonly string[], heard: readonly string[], chunk = 1): Reading {
  const session = createFollowSession(expected);
  let previous = session.snapshot();
  const steps: FollowSnapshot[] = [];
  const broken: string[] = [];
  for (let from = 0; from < heard.length; from += chunk) {
    const next = session.feed(heard.slice(from, from + chunk));
    broken.push(...brokenInvariants(previous, next));
    steps.push(next);
    previous = next;
  }
  return { final: previous, steps, broken };
}

/** An unrelated word said in the middle (a cough written as a word, an aside). */
function insertUnrelatedWord(corpus: FlatCorpus): Damage {
  return (words, random) => {
    const at = randomInt(random, 1, Math.max(1, words.length - 1));
    const stranger = corpus.words[randomInt(random, 0, corpus.words.length - 1)] ?? '';
    return [...words.slice(0, at), stranger, ...words.slice(at)];
  };
}

function drawPassages(corpus: FlatCorpus, random: Random, wanted: number): Passage[] {
  const passages: Passage[] = [];
  while (passages.length < wanted) {
    const length = randomInt(random, 8, 30);
    const start = randomInt(random, 0, corpus.words.length - length);
    const first = corpus.refs[start];
    const last = corpus.refs[start + length - 1];
    if (first !== undefined && last !== undefined && first.surah === last.surah) {
      passages.push({ start, length });
    }
  }
  return passages;
}

describeWithCorpus('Spec 3 — suivi mot à mot', () => {
  let corpus: FlatCorpus;
  /** 2:255, fifty words: the text of most scenarios. */
  let expected: string[];
  let heard: string[];

  beforeAll(() => {
    corpus = requireCorpus();
    expected = rawWords(corpus, '2:255');
    heard = splitWords(toPlene(verseText(corpus, '2:255')));
  });

  function surahWords(surah: number, style: (text: string) => string): string[] {
    return corpus.verses
      .filter((verse) => verse.surah === surah)
      .flatMap((verse) => splitWords(style(verse.text)));
  }

  describe('statuses', () => {
    it('before anything is heard: the first word is current, the others upcoming', () => {
      const session = createFollowSession(expected);
      const snapshot = session.snapshot();
      expect(snapshot.statuses).toEqual(['current', ...expected.slice(1).map(() => 'upcoming')]);
      expect(snapshot).toMatchObject({ currentIndex: 0, unmatchedStreak: 0 });
      expect(session.feed([])).toEqual(snapshot);
    });

    it('a clean reading marks nothing: every word read, word by word, in three writings, refrains included (surahs 1, 55, 94, 102, 109 and 2:255)', () => {
      const problems: string[] = [];
      const texts: (readonly [string, string[], (style: (text: string) => string) => string[]])[] =
        [
          ['2:255', expected, (style) => splitWords(style(verseText(corpus, '2:255')))],
          ...[1, 55, 94, 102, 109].map(
            (surah) =>
              [
                `surah ${surah}`,
                surahWords(surah, (text) => text),
                (style: (text: string) => string) => surahWords(surah, style),
              ] as const,
          ),
        ];
      for (const [name, expectedWords, heardIn] of texts) {
        for (const [styleName, style] of [
          ['Uthmani', (text: string) => text],
          ['bare', toBare],
          ['plene', toPlene],
        ] as const) {
          const reading = read(expectedWords, heardIn(style));
          const notRead = reading.final.statuses.length - countOf(reading.final, 'read');
          const flagged = reading.steps.some(
            (step) => countOf(step, 'mistake') + countOf(step, 'skipped') > 0,
          );
          if (
            notRead > 0 ||
            flagged ||
            reading.final.currentIndex !== null ||
            reading.broken.length > 0
          ) {
            problems.push(
              `${name} in ${styleName}: ${notRead} not read, flagged on the way: ${flagged}, ${reading.broken.join('; ')}`,
            );
          }
        }
      }
      expect(problems).toEqual([]);
    });

    it('the last word: until it is heard it is current; once heard, nothing is current any more', () => {
      const allButLast = read(expected, heard.slice(0, -1));
      expect(allButLast.final.currentIndex).toBe(expected.length - 1);
      expect(countOf(allButLast.final, 'read')).toBe(expected.length - 1);
      const whole = read(expected, heard);
      expect(whole.final.currentIndex).toBeNull();
      expect(countOf(whole.final, 'read')).toBe(expected.length);
    });

    it('a wrong last word is never red: no following word can confirm it', () => {
      const reading = read(expected, [...heard.slice(0, -1), heard[3] ?? '']);
      expect(countOf(reading.final, 'mistake')).toBe(0);
      expect(reading.final.statuses[expected.length - 1]).toBe('current');
    });

    it('words said after the end change no status', () => {
      const session = createFollowSession(expected);
      const done = session.feed(heard);
      const after = session.feed(splitWords(toPlene(verseText(corpus, '2:256'))).slice(0, 6));
      expect(after.statuses).toEqual(done.statuses);
      expect(after.currentIndex).toBeNull();
    });
  });

  describe('règle : un mot non entendu, alors que la suite correspond, est skipped', () => {
    it('one skipped word: skipped once the two following words are heard, not after one only, and never a mistake', () => {
      const withoutTenth = heard.filter((_, position) => position !== 9);
      const reading = read(expected, withoutTenth);
      expect(reading.broken).toEqual([]);
      // Step 9 (0-based) is the feed of the eleventh word: one following word heard so far.
      expect(reading.steps[9]?.statuses[9]).not.toBe('skipped');
      expect(reading.steps[9]?.statuses[9]).not.toBe('mistake');
      expect(picture(reading.final)).toBe(`${'R'.repeat(9)}S${'R'.repeat(40)}`);
    });

    it('one skipped line (eight words in a row): the eight are skipped, the others read', () => {
      const reading = read(
        expected,
        heard.filter((_, position) => position < 9 || position > 16),
      );
      expect(reading.broken).toEqual([]);
      expect(picture(reading.final)).toBe(`${'R'.repeat(9)}${'S'.repeat(8)}${'R'.repeat(33)}`);
    });

    it('the first word skipped is skipped', () => {
      expect(picture(read(expected, heard.slice(1)).final)).toBe(`S${'R'.repeat(49)}`);
    });
  });

  describe('règle : mistake seulement si le lecteur a dépassé le mot et que le mot entendu ne correspond pas', () => {
    it('a clearly different word in the place of the tenth word: mistake, once two following words are heard and not before', () => {
      // The 31st word of the verse said in the place of the 10th.
      const misread = heard.map((word, position) => (position === 9 ? (heard[30] ?? '') : word));
      const reading = read(expected, misread);
      expect(reading.broken).toEqual([]);
      expect(reading.steps[10]?.statuses[9]).not.toBe('mistake');
      expect(reading.steps[11]?.statuses[9]).toBe('mistake');
      expect(picture(reading.final)).toBe(`${'R'.repeat(9)}M${'R'.repeat(40)}`);
    });

    it('a clearly different word in the place of the first word is a mistake too (types.ts: "a clearly different word was heard in its place")', () => {
      const reading = read(expected, [heard[20] ?? '', ...heard.slice(1)]);
      expect(picture(reading.final)).toBe(`M${'R'.repeat(49)}`);
    });

    it('noise in one letter of a word, among the letters the accent key merges, is never a mistake (every word of 2:255 in turn)', () => {
      const random = seededRandom(8);
      const red: string[] = [];
      let tried = 0;
      heard.forEach((word, position) => {
        for (const damage of [confuseEmphatics, confuseGutturals]) {
          const noisy = damage([word], random);
          if (noisy === null) continue;
          tried += 1;
          const reading = read(
            expected,
            heard.map((clean, at) => (at === position ? (noisy[0] ?? '') : clean)),
          );
          if (
            reading.steps.some((step) => countOf(step, 'mistake') > 0) ||
            countOf(reading.final, 'read') !== 50
          ) {
            red.push(`word ${position + 1} heard as ${noisy[0]}: ${picture(reading.final)}`);
          }
        }
      });
      expect(tried).toBeGreaterThan(20);
      expect(red).toEqual([]);
    });
  });

  describe('règle : le lecteur peut se répéter ou revenir en arrière de quelques mots sans créer d’erreur', () => {
    it('one repeated word, at every position in turn: nothing skipped, nothing mistaken, all read', () => {
      const problems: string[] = [];
      for (let position = 0; position < heard.length; position += 1) {
        const reading = read(expected, [...heard.slice(0, position + 1), ...heard.slice(position)]);
        const flagged = reading.steps.some(
          (step) => countOf(step, 'mistake') + countOf(step, 'skipped') > 0,
        );
        if (flagged || countOf(reading.final, 'read') !== 50 || reading.broken.length > 0) {
          problems.push(
            `word ${position + 1} repeated: ${picture(reading.final)} ${reading.broken.join('; ')}`,
          );
        }
      }
      expect(problems).toEqual([]);
    });

    it('going back two, three or five words, at every position in turn: nothing skipped, nothing mistaken, all read', () => {
      const problems: string[] = [];
      for (const back of [2, 3, 5]) {
        for (let position = back; position <= heard.length; position += 1) {
          const reading = read(expected, [
            ...heard.slice(0, position),
            ...heard.slice(position - back),
          ]);
          const flagged = reading.steps.some(
            (step) => countOf(step, 'mistake') + countOf(step, 'skipped') > 0,
          );
          if (flagged || countOf(reading.final, 'read') !== 50 || reading.broken.length > 0) {
            problems.push(
              `back ${back} words after word ${position}: ${picture(reading.final)} ${reading.broken.join('; ')}`,
            );
          }
        }
      }
      expect(problems).toEqual([]);
    });
  });

  describe('règle : les statuts ne régressent pas tout seuls', () => {
    it('a read word stays read whatever is heard next (unrelated words, jumps back and forth, junk), and the snapshot stays coherent', () => {
      const random = seededRandom(2024);
      const broken: string[] = [];
      for (let round = 0; round < 60; round += 1) {
        const session = createFollowSession(expected);
        let previous = session.snapshot();
        for (let step = 0; step < 40; step += 1) {
          const kind = randomInt(random, 0, 4);
          let words: string[];
          if (kind === 0) {
            const from = randomInt(random, 0, heard.length - 1);
            words = heard.slice(from, from + randomInt(random, 1, 6));
          } else if (kind === 1) {
            words = [corpus.words[randomInt(random, 0, corpus.words.length - 1)] ?? ''];
          } else if (kind === 2) {
            words = ['hello', '42', ''];
          } else {
            const from = previous.currentIndex ?? 0;
            words = heard.slice(from, from + randomInt(random, 1, 4));
          }
          const next = session.feed(words);
          broken.push(
            ...brokenInvariants(previous, next).map(
              (rule) => `round ${round}, step ${step}: ${rule}`,
            ),
          );
          previous = next;
        }
      }
      expect(broken.slice(0, 10)).toEqual([]);
    });
  });

  describe('feeding', () => {
    it('word by word or in chunks of 2, 3, 7 words or all at once: the same result, damaged or not', () => {
      const random = seededRandom(99);
      const damages: readonly (Damage | null)[] = [
        null,
        mergeTwoWords,
        splitOneWord,
        dropShortParticle,
        doubleOneWord,
        confuseOutsideSpecList,
        insertUnrelatedWord(corpus),
      ];
      const different: string[] = [];
      let compared = 0;
      for (const passage of drawPassages(corpus, random, 150)) {
        const expectedWords = transcriptOf(corpus, passage, (text) => text);
        const clean = transcriptOf(corpus, passage, toPlene);
        const damage = pick(random, damages);
        const heardWords = damage === null ? clean : (damage(clean, random) ?? clean);
        const wordByWord = read(expectedWords, heardWords).final;
        for (const chunk of [2, 3, 7, heardWords.length]) {
          compared += 1;
          const chunked = read(expectedWords, heardWords, chunk).final;
          if (JSON.stringify(chunked) !== JSON.stringify(wordByWord)) {
            different.push(
              `chunks of ${chunk}: ${picture(chunked)} against ${picture(wordByWord)}`,
            );
          }
        }
      }
      expect(compared).toBe(600);
      expect(different).toEqual([]);
    });

    it('an entry may hold several words; entries without any Arabic word change nothing', () => {
      const session = createFollowSession(expected);
      const atOnce = session.feed([heard.join(' ')]);
      expect(countOf(atOnce, 'read')).toBe(50);
      const other = createFollowSession(expected);
      const before = other.snapshot();
      expect(other.feed(['hello', '42', '\u{1F642}', '', '   '])).toEqual(before);
    });

    it('unmatchedStreak grows while the reader says something else and falls back to 0 on the next expected word', () => {
      const session = createFollowSession(expected);
      session.feed(heard.slice(0, 5));
      // Six words of 105:1-2, another passage. A short word may look like a word around the
      // reading position, so the streak is only required to grow, not to count all six.
      const elsewhere = [...rawWords(corpus, '105:1'), ...rawWords(corpus, '105:2')].slice(0, 6);
      const streaks = elsewhere.map((word) => session.feed([word]).unmatchedStreak);
      streaks.forEach((streak, step) => {
        expect(streak).toBeLessThanOrEqual((streaks[step - 1] ?? 0) + 1);
      });
      expect(streaks[5]).toBeGreaterThanOrEqual(4);
      expect(session.feed(heard.slice(5, 6)).unmatchedStreak).toBe(0);
    });

    it('snapshot() changes nothing, and changing what it returned does not change the session', () => {
      const session: FollowSession = createFollowSession(expected);
      session.feed(heard.slice(0, 7));
      const first = session.snapshot();
      const copy = JSON.stringify(first);
      try {
        // The type is read-only; a caller in plain JavaScript could still write to it.
        (first.statuses as WordStatus[])[0] = 'mistake';
      } catch {
        // A frozen snapshot refuses the write: just as good.
      }
      expect(JSON.stringify(session.snapshot())).toBe(copy);
      expect(JSON.stringify(session.snapshot())).toBe(copy);
    });

    it('two sessions on the same words do not share their state', () => {
      const one = createFollowSession(expected);
      const other = createFollowSession(expected);
      one.feed(heard.slice(0, 20));
      expect(other.snapshot().currentIndex).toBe(0);
    });
  });

  describe('règle : un mot marqué en rouge à tort est pire qu’une erreur ratée', () => {
    it('measure: marks left by each kind of damage on 200 readings; hard: no red mark where the reader said every word and the spec excludes it', () => {
      const random = seededRandom(404);
      const passages = drawPassages(corpus, random, 200);
      const kinds: readonly (readonly [string, Damage | null, boolean])[] = [
        ['no damage', null, true],
        ['emphatic / plain confused', confuseEmphatics, true],
        ['h sounds, hamza / ayn confused', confuseGutturals, true],
        ['one word doubled', doubleOneWord, true],
        ['confusions outside spec list', confuseOutsideSpecList, false],
        ['long vowel lost', disturbLongVowel, false],
        ['two words merged', mergeTwoWords, false],
        ['one word split', splitOneWord, false],
        ['unrelated word inserted', insertUnrelatedWord(corpus), false],
        ['short particle dropped', dropShortParticle, false],
      ];
      const lines: string[] = [];
      const forbiddenRed: string[] = [];
      for (const [name, damage, redForbidden] of kinds) {
        let words = 0;
        let mistakes = 0;
        let skipped = 0;
        let unread = 0;
        let readings = 0;
        for (const passage of passages) {
          const expectedWords = transcriptOf(corpus, passage, (text) => text);
          const clean = transcriptOf(corpus, passage, toPlene);
          const heardWords = damage === null ? clean : damage(clean, random);
          if (heardWords === null) continue;
          readings += 1;
          const reading = read(expectedWords, heardWords);
          words += expectedWords.length;
          mistakes += countOf(reading.final, 'mistake');
          skipped += countOf(reading.final, 'skipped');
          unread += expectedWords.length - countOf(reading.final, 'read');
          if (redForbidden && reading.steps.some((step) => countOf(step, 'mistake') > 0)) {
            forbiddenRed.push(`${name}: [${heardWords.join(' ')}] ${picture(reading.final)}`);
          }
        }
        lines.push(
          `${name.padEnd(32)} readings=${readings} words=${words} mistake=${mistakes} skipped=${skipped} not read at the end=${unread}`,
        );
      }
      report(
        'follow-along: marks on words under damage (one damage per reading of 8-30 words)',
        lines,
      );
      expect(forbiddenRed).toEqual([]);
    });
  });
});
