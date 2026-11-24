import { createFollowSession, type FollowSnapshot, type WordStatus } from '../index';
import { createRandom, pickOne, randomInteger } from '../test-support/noise';
import { imlaeiText, uthmaniWords, withoutMarks } from '../test-support/sample';

// Surah 112, word by word:
//  0 قل   1 هو   2 الله   3 أحد   4 الله   5 الصمد   6 لم   7 يلد   8 ولم   9 يولد
// 10 ولم  11 يكن  12 له   13 كفوا  14 أحد
const SURAH_112 = uthmaniWords(112, 1, 4);

// Surah 113, word by word:
//  0 قل   1 أعوذ   2 برب   3 الفلق   4 من   5 شر   6 ما   7 خلق   8 ومن   9 شر   10 غاسق
// 11 إذا  12 وقب   13 ومن  14 شر   15 النفاثات   16 في   17 العقد   18 ومن   19 شر
// 20 حاسد  21 إذا  22 حسد
const SURAH_113 = uthmaniWords(113, 1, 5);

/** Follows `expected` while the reader says `transcript`, one word at a time. */
function follow(expected: readonly string[], transcript: string): FollowSnapshot {
  const session = createFollowSession(expected);
  let snapshot = session.snapshot();
  for (const word of transcript.split(' ')) snapshot = session.feed([word]);
  return snapshot;
}

/** Statuses as one letter per word: R read, C current, U upcoming, S skipped, M mistake. */
function letters(snapshot: FollowSnapshot): string {
  const letterOf: Record<WordStatus, string> = {
    read: 'R',
    current: 'C',
    upcoming: 'U',
    skipped: 'S',
    mistake: 'M',
  };
  return snapshot.statuses.map((status) => letterOf[status]).join('');
}

describe('Rule 3 — createFollowSession and feed give the status of each expected word', () => {
  it('starts with the first word current and the others upcoming', () => {
    const snapshot = createFollowSession(SURAH_112).snapshot();

    expect(snapshot.statuses).toHaveLength(SURAH_112.length);
    expect(letters(snapshot)).toBe('CUUUUUUUUUUUUUU');
    expect(snapshot.currentIndex).toBe(0);
  });

  it('marks the words heard at their place as read and the next one as current', () => {
    const snapshot = follow(SURAH_112, 'قل هو الله أحد الله');

    expect(letters(snapshot)).toBe('RRRRRCUUUUUUUUU');
    expect(snapshot.currentIndex).toBe(5);
  });

  it('has no current word once the last word is read', () => {
    const snapshot = follow(
      SURAH_112,
      'قل هو الله أحد الله الصمد لم يلد ولم يولد ولم يكن له كفوا أحد',
    );

    expect(letters(snapshot)).toBe('RRRRRRRRRRRRRRR');
    expect(snapshot.currentIndex).toBeNull();
  });

  it('gives the same result whether words are fed one by one or several at a time', () => {
    const words = 'قل هو الله كتاب الله الصمد لم ولم يولد'.split(' ');
    const oneByOne = follow(SURAH_112, words.join(' '));
    const allAtOnce = createFollowSession(SURAH_112).feed(words);
    const asOneText = createFollowSession(SURAH_112).feed([words.join(' ')]);

    expect(allAtOnce).toEqual(oneByOne);
    expect(asOneText).toEqual(oneByOne);
  });

  it('snapshot() gives the state without changing it', () => {
    const session = createFollowSession(SURAH_112);
    const fed = session.feed(['قل', 'هو']);

    expect(session.snapshot()).toEqual(fed);
    expect(session.snapshot()).toEqual(fed);
  });

  it.each([
    ["imla'i with vowel marks", (text: string) => text],
    ['plain spelling without marks', withoutMarks],
  ])('follows whole surahs written in Uthmani from a transcript in %s', (_case, spell) => {
    for (const [surah, lastVerse] of [
      [1, 7],
      [94, 8],
      [95, 8],
      [102, 8],
      [103, 3],
      [109, 6],
      [112, 4],
      [113, 5],
      [114, 6],
    ] as const) {
      const expected = uthmaniWords(surah, 1, lastVerse);
      const snapshot = follow(expected, spell(imlaeiText(surah, 1, lastVerse)));

      expect(letters(snapshot)).toBe('R'.repeat(expected.length));
      expect(snapshot.currentIndex).toBeNull();
    }
  });
});

describe('Rule 3.1 — mistake: the reader clearly went past the word and what was heard there does not match', () => {
  it('marks a clearly different word as a mistake once two following words match', () => {
    const snapshot = follow(SURAH_112, 'قل هو الله كتاب الله الصمد');

    expect(letters(snapshot)).toBe('RRRMRRCUUUUUUUU');
  });

  it('does not decide while a single following word matches', () => {
    const snapshot = follow(SURAH_112, 'قل هو الله كتاب الله');

    expect(letters(snapshot)).toBe('RRRCUUUUUUUUUUU');
  });

  it('does not decide when nothing was heard after the wrong word', () => {
    const snapshot = follow(SURAH_112, 'قل هو الله كتاب');

    expect(letters(snapshot)).toBe('RRRCUUUUUUUUUUU');
  });

  it('never marks the last word as a mistake: nothing follows to confirm it', () => {
    const snapshot = follow(
      SURAH_112,
      'قل هو الله أحد الله الصمد لم يلد ولم يولد ولم يكن له كفوا كتاب',
    );

    expect(letters(snapshot)).toBe('RRRRRRRRRRRRRRC');
  });

  it('reads a word that only differs by letters a foreign accent confuses (ح/ه, ص/س)', () => {
    const snapshot = follow(SURAH_112, 'قل هو الله أهد الله السمد لم يلد');

    expect(letters(snapshot)).toBe('RRRRRRRRCUUUUUU');
  });

  it('reads a word heard with one noisy letter', () => {
    const snapshot = follow(SURAH_112, 'قل هو الله أحد الله الصمت لم يلد');

    expect(letters(snapshot)).toBe('RRRRRRRRCUUUUUU');
  });

  it('gives the benefit of the doubt to a word that is half alike (خلف for خلق)', () => {
    const snapshot = follow(SURAH_113, 'قل أعوذ برب الفلق من شر ما خلف ومن شر');

    expect(letters(snapshot).slice(0, 11)).toBe('RRRRRRRRRRC');
  });

  it('marks two wrong words in a row as two mistakes', () => {
    const snapshot = follow(SURAH_113, 'قل أعوذ برب الفلق كتاب جديد ما خلق');

    expect(letters(snapshot).slice(0, 9)).toBe('RRRRMMRRC');
  });

  it('does not blame the reader for an extra word between two right words', () => {
    const snapshot = follow(SURAH_112, 'قل هو كتاب الله أحد الله');

    expect(letters(snapshot)).toBe('RRRRRCUUUUUUUUU');
  });

  it('does not blame a reader who corrects the word straight away', () => {
    const snapshot = follow(SURAH_112, 'قل هو الله كتاب أحد الله الصمد');

    expect(letters(snapshot)).toBe('RRRRRRCUUUUUUUU');
  });

  it('marks as skipped, not as a mistake, a word of which only a part was heard', () => {
    // Uthmani writes يَـٰٓأَيُّهَا as one word; only "يا" was heard.
    const expected = uthmaniWords(109, 1, 2);
    const snapshot = follow(expected, 'قل يا الكافرون لا أعبد');

    expect(letters(snapshot)).toBe('RSRRRCU');
  });
});

describe('Rule 3.2 — skipped: the word was not heard and the following words match', () => {
  it('marks a word that was not heard as skipped once two following words match', () => {
    const snapshot = follow(SURAH_112, 'قل هو الله الله الصمد لم');

    expect(letters(snapshot)).toBe('RRRSRRRCUUUUUUU');
  });

  it('does not decide while a single following word matches', () => {
    // After "قل هو", "أحد" alone could be anything: "الله" is not declared skipped yet.
    const snapshot = follow(SURAH_112, 'قل هو أحد');

    expect(letters(snapshot)).toBe('RRCUUUUUUUUUUUU');
  });

  it('marks two words that were not heard as skipped', () => {
    const snapshot = follow(SURAH_113, 'قل أعوذ من شر ما');

    expect(letters(snapshot).slice(0, 8)).toBe('RRSSRRRC');
  });

  it('follows a reader who skips a whole verse, once four words of the next verse match', () => {
    const session = createFollowSession(SURAH_113);
    session.feed('قل أعوذ برب الفلق'.split(' '));

    // Verse 2 (من شر ما خلق) is skipped: the reader goes on with verse 3.
    const afterThreeWords = session.feed('ومن شر غاسق'.split(' '));
    expect(letters(afterThreeWords).slice(0, 13)).toBe('RRRRCUUUUUUUU');

    const afterFourWords = session.feed(['إذا']);
    expect(letters(afterFourWords).slice(0, 13)).toBe('RRRRSSSSRRRRC');
  });

  it('never turns a word that was simply not heard into a mistake', () => {
    const snapshot = follow(SURAH_113, 'قل أعوذ برب من شر خلق ومن غاسق إذا وقب ومن شر');

    expect(snapshot.statuses).not.toContain('mistake');
    expect(letters(snapshot).slice(0, 15)).toBe('RRRSRRSRRSRRRRR');
  });
});

describe('Rule 3.3 — the reader may repeat or go back a few words without creating an error', () => {
  it('ignores a word said twice', () => {
    const snapshot = follow(SURAH_112, 'قل هو هو الله أحد أحد الله');

    expect(letters(snapshot)).toBe('RRRRRCUUUUUUUUU');
  });

  it('follows a reader who goes back a few words and carries on', () => {
    const snapshot = follow(SURAH_112, 'قل هو الله أحد الله الصمد هو الله أحد الله الصمد لم يلد');

    expect(letters(snapshot)).toBe('RRRRRRRRCUUUUUU');
  });

  it('follows a reader who starts the passage again from its first word', () => {
    const snapshot = follow(SURAH_112, 'قل هو الله أحد قل هو الله أحد الله الصمد');

    expect(letters(snapshot)).toBe('RRRRRRCUUUUUUUU');
  });

  it('keeps the current word where it was while the reader repeats earlier words', () => {
    const session = createFollowSession(SURAH_112);
    session.feed('قل هو الله أحد الله الصمد'.split(' '));
    const whileRepeating = session.feed('قل هو الله'.split(' '));

    expect(letters(whileRepeating)).toBe('RRRRRRCUUUUUUUU');
    expect(whileRepeating.unmatchedStreak).toBe(0);
  });

  it('does not mistake a repeated phrase for a jump to the same phrase further on', () => {
    // "ومن شر" is at 8-9, 13-14 and 18-19. The reader has read up to 9 and repeats verse 2.
    const session = createFollowSession(SURAH_113);
    session.feed('قل أعوذ برب الفلق من شر ما خلق ومن شر'.split(' '));
    const afterRepeat = session.feed('من شر ما خلق ومن شر'.split(' '));

    expect(letters(afterRepeat).slice(0, 14)).toBe('RRRRRRRRRRCUUU');

    const afterNextWord = session.feed(['غاسق']);
    expect(letters(afterNextWord).slice(0, 14)).toBe('RRRRRRRRRRRCUU');
  });
});

describe('Rule 3.3 — repeated phrases of the text itself (refrains) are not confused with a jump', () => {
  // 55:13 to 55:18. The refrain "فبأي آلاء ربكما تكذبان" is at 0-3, 15-18 and 23-26.
  //  4 خلق  5 الإنسان  6 من  7 صلصال  8 كالفخار | 9 وخلق  10 الجان  11 من  12 مارج  13 من  14 نار
  // 19 رب  20 المشرقين  21 ورب  22 المغربين
  const REFRAINS = uthmaniWords(55, 13, 18);
  const REFRAIN = 'فبأي آلاء ربكما تكذبان';

  it('reads a refrain again when it comes again in the text', () => {
    const snapshot = follow(REFRAINS, withoutMarks(imlaeiText(55, 13, 18)));

    expect(letters(snapshot)).toBe('R'.repeat(REFRAINS.length));
  });

  it('does not jump to the next refrain when the reader repeats the one just read', () => {
    const session = createFollowSession(REFRAINS);
    session.feed(REFRAIN.split(' '));
    const afterRepeat = session.feed(REFRAIN.split(' '));

    expect(letters(afterRepeat)).toBe(`RRRRC${'U'.repeat(22)}`);

    const afterNextVerse = session.feed('خلق الإنسان من'.split(' '));
    expect(letters(afterNextVerse)).toBe(`RRRRRRRC${'U'.repeat(19)}`);
  });

  it('follows a reader who really jumps to the next refrain, once the words after it tell', () => {
    const session = createFollowSession(REFRAINS);
    session.feed(REFRAIN.split(' '));
    // Verses 14 and 15 are skipped: the reader says the refrain of verse 16, then verse 17.
    session.feed(REFRAIN.split(' '));
    const afterNextWord = session.feed(['رب']);

    expect(letters(afterNextWord)).toBe(`RRRR${'S'.repeat(11)}RRRRRC${'U'.repeat(6)}`);
  });

  it('does not take for the current word the same word found two words further', () => {
    // Surah 112: 8 ولم  9 يولد  10 ولم. The first ولم is heard badly (ولب).
    const snapshot = follow(SURAH_112, 'قل هو الله أحد الله الصمد لم يلد ولب يولد ولم يكن له');

    expect(letters(snapshot)).toBe('RRRRRRRRRRRRRCU');
  });
});

describe('Rule 3.4 — statuses do not regress on their own: a read word stays read', () => {
  it('keeps the read words when unrelated words are heard', () => {
    const session = createFollowSession(SURAH_112);
    const before = session.feed('قل هو الله أحد'.split(' '));
    const after = session.feed('ذهبت إلى السوق لشراء الخبز'.split(' '));

    expect(letters(after)).toBe(letters(before));
  });

  it('keeps a read word read when the reader goes back and says it wrong', () => {
    const snapshot = follow(
      SURAH_112,
      'قل هو الله أحد الله الصمد قل هو كتاب أحد الله الصمد لم يلد',
    );

    expect(letters(snapshot)).toBe('RRRRRRRRCUUUUUU');
  });

  it('turns a skipped word into read when the reader goes back and reads it', () => {
    const session = createFollowSession(SURAH_112);
    const skipped = session.feed('قل هو الله الله الصمد'.split(' '));
    expect(letters(skipped)).toBe('RRRSRRCUUUUUUUU');

    const repaired = session.feed('هو الله أحد الله الصمد'.split(' '));
    expect(letters(repaired)).toBe('RRRRRRCUUUUUUUU');
  });

  it('turns a mistake into read when the reader goes back and reads the word correctly', () => {
    const session = createFollowSession(SURAH_112);
    const mistaken = session.feed('قل هو الله كتاب الله الصمد'.split(' '));
    expect(letters(mistaken)).toBe('RRRMRRCUUUUUUUU');

    const repaired = session.feed('الله أحد الله الصمد'.split(' '));
    expect(letters(repaired)).toBe('RRRRRRCUUUUUUUU');
  });

  it('never loses a read word nor moves the position back, whatever is heard (random transcripts)', () => {
    const random = createRandom(2026);
    const vocabulary = [...SURAH_113, 'كتاب', 'قال', 'السوق'];
    for (let run = 0; run < 50; run += 1) {
      const session = createFollowSession(SURAH_113);
      let previous = session.snapshot();
      for (let step = 0; step < 40; step += 1) {
        // Mostly the expected next word, sometimes any word: repeats, jumps and noise.
        const next = SURAH_113[previous.currentIndex ?? 0] ?? 'قل';
        const heard = randomInteger(random, 0, 9) < 7 ? next : pickOne(random, vocabulary);
        const snapshot = session.feed([heard]);

        snapshot.statuses.forEach((status, index) => {
          if (previous.statuses[index] === 'read') expect(status).toBe('read');
        });
        expect(snapshot.currentIndex ?? SURAH_113.length).toBeGreaterThanOrEqual(
          previous.currentIndex ?? SURAH_113.length,
        );
        expect(
          snapshot.statuses.filter((status) => status === 'current').length,
        ).toBeLessThanOrEqual(1);
        previous = snapshot;
      }
    }
  });
});

describe('Rule 3 — a wrongly red word is worse than a missed mistake', () => {
  it('shows no mistake for the Fatiha read by a learner (no hamza, س for ص, د for ض, ه for ح)', () => {
    const learner =
      'بسم الله الرهمن الرهيم الهمد لله رب العالمين الرحمان الرحيم مالك يوم الدين اياك نعبد واياك نستعين ' +
      'اهدنا السراط المستقيم سراط الذين انعمت عليهم غير المغدوب عليهم ولا الدالين';
    const expected = uthmaniWords(1, 1, 7);
    const snapshot = follow(expected, learner);

    expect(letters(snapshot)).toBe('R'.repeat(expected.length));
  });

  it('shows no mistake when the engine cuts or glues words', () => {
    // Uthmani يَـٰٓأَيُّهَا heard as two words; "قل هو" heard as one.
    expect(letters(follow(uthmaniWords(109, 1, 2), 'قل يا أيها الكافرون لا أعبد ما تعبدون'))).toBe(
      'RRRRRRR',
    );
    expect(letters(follow(SURAH_112, 'قلهو الله أحد الله'))).toBe('RRRRRCUUUUUUUUU');
  });

  it('shows no mistake when words are missing from the transcript: they are skipped', () => {
    const snapshot = follow(
      uthmaniWords(1, 1, 7),
      withoutMarks(imlaeiText(1, 1, 7))
        .replace(' رب ', ' ')
        .replace(' يوم ', ' '),
    );

    expect(snapshot.statuses).not.toContain('mistake');
    expect(snapshot.statuses.filter((status) => status === 'skipped')).toHaveLength(2);
  });
});

describe('unmatchedStreak — how long the reader has been off the expected words', () => {
  it('counts the latest heard words that match nothing, and starts again from zero', () => {
    const session = createFollowSession(SURAH_112);

    expect(session.feed(['قل', 'هو']).unmatchedStreak).toBe(0);
    expect(session.feed(['ذهبت', 'إلى', 'السوق']).unmatchedStreak).toBe(3);
    expect(session.feed(['الله']).unmatchedStreak).toBe(0);
  });
});

describe('Rule 3 — invalid input', () => {
  it('throws when there is no expected word', () => {
    expect(() => createFollowSession([])).toThrow(RangeError);
    // @ts-expect-error invalid input on purpose
    expect(() => createFollowSession('قل هو الله أحد')).toThrow(TypeError);
  });

  it('throws when an expected entry is not exactly one Arabic word', () => {
    expect(() => createFollowSession(['قل', 'هو الله'])).toThrow(/expectedWords\[1\]/);
    expect(() => createFollowSession(['قل', '۞'])).toThrow(TypeError);
    expect(() => createFollowSession(['قل', 'hello'])).toThrow(TypeError);
    // @ts-expect-error invalid input on purpose
    expect(() => createFollowSession(['قل', 7])).toThrow(TypeError);
  });

  it('throws when the recognised words are not a list of strings', () => {
    const session = createFollowSession(SURAH_112);

    // @ts-expect-error invalid input on purpose
    expect(() => session.feed('قل')).toThrow(TypeError);
    // @ts-expect-error invalid input on purpose
    expect(() => session.feed([null])).toThrow(TypeError);
  });

  it('changes nothing when fed nothing, or text that is not Arabic', () => {
    const session = createFollowSession(SURAH_112);
    const start = session.snapshot();

    expect(session.feed([])).toEqual(start);
    expect(session.feed(['', 'hello world', '123'])).toEqual(start);
  });
});
