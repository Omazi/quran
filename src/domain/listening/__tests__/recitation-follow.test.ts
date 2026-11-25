import { followRecitation, startFollowing, type FollowState } from '../recitation-follow';

/** 18:10 as the data writes it (Uthmani), cut into its words. */
const VERSE = 'إِذۡ أَوَى ٱلۡفِتۡيَةُ إِلَى ٱلۡكَهۡفِ فَقَالُواْ رَبَّنَآ ءَاتِنَا مِن لَّدُنكَ رَحۡمَةٗ'.split(' ');

function hear(state: FollowState, ...words: string[]): FollowState {
  return followRecitation(state, VERSE, words);
}

describe('following a recitation word by word', () => {
  it('starts before the first word, with nothing recited and nothing to read again', () => {
    expect(startFollowing(0)).toEqual({ next: 0, current: null, reread: null });
    expect(startFollowing(3)).toEqual({ next: 3, current: null, reread: null });
  });

  it('moves on with every word recited as written, whatever the spelling of the engine', () => {
    let state = hear(startFollowing(0), 'إذ');
    expect(state).toEqual({ next: 1, current: 0, reread: null });
    state = hear(state, 'أوى', 'الفتية');
    expect(state).toEqual({ next: 3, current: 2, reread: null });
  });

  it('a word left out is to be read again, and the place moves to the word recited', () => {
    // The mockup (voix.png): أَوَى skipped, ٱلۡفِتۡيَةُ recited.
    const state = hear(startFollowing(0), 'إذ', 'الفتية');
    expect(state).toEqual({ next: 3, current: 2, reread: 1 });
  });

  it('a word misread is to be read again, and the place does not move', () => {
    const state = hear(startFollowing(0), 'إذ', 'قال');
    expect(state).toEqual({ next: 1, current: 0, reread: 1 });
  });

  it('the word read again correctly clears the reminder', () => {
    const misread = hear(startFollowing(0), 'إذ', 'قال');
    expect(hear(misread, 'أوى')).toEqual({ next: 2, current: 1, reread: null });
  });

  it('the reminder of a word left out goes once the next word is recited too', () => {
    const skipped = hear(startFollowing(0), 'إذ', 'الفتية');
    expect(hear(skipped, 'إلى')).toEqual({ next: 4, current: 3, reread: null });
  });

  it('stays at the end once the last word is recited, and ignores what comes after', () => {
    let state = startFollowing(VERSE.length - 1);
    state = hear(state, 'رحمة');
    expect(state).toEqual({ next: VERSE.length, current: VERSE.length - 1, reread: null });
    expect(hear(state, 'إذ')).toBe(state);
  });

  it('ignores words with no letter, and refuses a place outside the words', () => {
    const state = startFollowing(0);
    expect(hear(state, '۝')).toBe(state);
    expect(() => startFollowing(-1)).toThrow(RangeError);
    expect(() => followRecitation({ next: 99, current: null, reread: null }, VERSE, [])).toThrow(
      RangeError,
    );
  });
});
