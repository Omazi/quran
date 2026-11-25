import type { PassageCandidate, SearchResult } from '../../recognition';
import {
  INITIAL_LISTENING_STATE,
  transition,
  type ListeningEvent,
  type ListeningState,
} from '../index';

/** A passage of one verse, from its first word to the given one. */
function passage(surah: number, verse: number, lastWord = 4): PassageCandidate {
  return {
    start: { surah, verse, word: 1 },
    end: { surah, verse, word: lastWord },
    score: 1,
    confidence: 1,
  };
}

const IKHLAS_1 = passage(112, 1);
const FOUND: SearchResult = { status: 'found', candidates: [IKHLAS_1], tiedCount: 1 };

/** "Praise be to God, Lord of the worlds": the same words in six surahs. */
const TIED = [1, 6, 10, 37, 39, 40].map((surah) => passage(surah, 2));
const AMBIGUOUS: SearchResult = { status: 'ambiguous', candidates: TIED, tiedCount: TIED.length };

const TOO_FEW: SearchResult = {
  status: 'not-found',
  reason: 'too-few-words',
  candidates: [],
  tiedCount: 0,
};
const NO_MATCH: SearchResult = {
  status: 'not-found',
  reason: 'no-match',
  candidates: [],
  tiedCount: 0,
};

/** Plays events one after the other, from the initial state. */
function after(...events: ListeningEvent[]): ListeningState {
  return events.reduce(transition, INITIAL_LISTENING_STATE);
}

const OPENED: ListeningEvent = { type: 'opened' };
const STARTED: ListeningEvent = { type: 'listening-started' };
const STOP: ListeningEvent = { type: 'stop-requested' };
const ENDED: ListeningEvent = { type: 'engine-ended', reason: 'finished' };

function heard(heardWordCount: number, result: SearchResult): ListeningEvent {
  return { type: 'words-heard', heardWordCount, result };
}

const LISTENING = [OPENED, STARTED] as const;

describe('before listening', () => {
  it('starts idle: nothing is heard and nothing is asked', () => {
    expect(INITIAL_LISTENING_STATE).toEqual({ status: 'idle' });
  });

  it('idle → starting when the screen opens', () => {
    expect(after(OPENED)).toEqual({ status: 'starting' });
  });

  it('starting → microphone-denied when the person refused the microphone', () => {
    expect(after(OPENED, { type: 'microphone-denied' })).toEqual({ status: 'microphone-denied' });
  });

  it('starting → listening once the engine listens, with nothing heard yet', () => {
    expect(after(...LISTENING)).toEqual({
      status: 'listening',
      heardWordCount: 0,
      latestResult: null,
    });
  });

  it('starting → failed when the engine or the text could not be started', () => {
    expect(after(OPENED, { type: 'start-failed' })).toEqual({ status: 'failed' });
  });

  it('starting → failed when the engine gives up before it listens', () => {
    expect(after(OPENED, { type: 'engine-ended', reason: 'failed' })).toEqual({
      status: 'failed',
    });
  });

  it('starting → closed when the person stops before the microphone is open', () => {
    expect(after(OPENED, STOP)).toEqual({ status: 'closed' });
  });
});

describe('while listening', () => {
  it('listening → found as soon as one passage explains the words better than any other', () => {
    expect(after(...LISTENING, heard(4, FOUND))).toEqual({ status: 'found', passage: IKHLAS_1 });
  });

  it('stays listening on an ambiguous result: more words may tell the places apart', () => {
    expect(after(...LISTENING, heard(4, AMBIGUOUS))).toEqual({
      status: 'listening',
      heardWordCount: 4,
      latestResult: AMBIGUOUS,
    });
  });

  it('listening → found when more words settle an ambiguous start', () => {
    expect(after(...LISTENING, heard(4, AMBIGUOUS), heard(9, FOUND))).toEqual({
      status: 'found',
      passage: IKHLAS_1,
    });
  });

  it('stays listening while too few words were heard or no passage fits', () => {
    expect(after(...LISTENING, heard(2, TOO_FEW))).toEqual({
      status: 'listening',
      heardWordCount: 2,
      latestResult: TOO_FEW,
    });
    expect(after(...LISTENING, heard(2, TOO_FEW), heard(7, NO_MATCH))).toEqual({
      status: 'listening',
      heardWordCount: 7,
      latestResult: NO_MATCH,
    });
  });

  it('forgets the tied places when later words no longer fit them', () => {
    const state = after(...LISTENING, heard(4, AMBIGUOUS), heard(8, NO_MATCH), ENDED);
    expect(state).toEqual({ status: 'not-found', reason: 'no-match' });
  });
});

describe('when the engine stops by itself', () => {
  it('listening → ambiguous with every tied place, never one chosen at random', () => {
    expect(after(...LISTENING, heard(4, AMBIGUOUS), ENDED)).toEqual({
      status: 'ambiguous',
      passages: { candidates: TIED, totalCount: 6, isComplete: true },
    });
  });

  it('lists the tied places only, not the lower-ranked ones that follow them', () => {
    const withAlternative: SearchResult = {
      status: 'ambiguous',
      candidates: [...TIED, passage(2, 255)],
      tiedCount: TIED.length,
    };
    const state = after(...LISTENING, heard(4, withAlternative), ENDED);
    expect(state).toMatchObject({ status: 'ambiguous', passages: { candidates: TIED } });
  });

  it('says when the list of tied places is cut, and how many there are in all', () => {
    const cut: SearchResult = {
      status: 'ambiguous',
      candidates: TIED,
      tiedCount: 2155,
      truncated: true,
    };
    expect(after(...LISTENING, heard(3, cut), ENDED)).toEqual({
      status: 'ambiguous',
      passages: { candidates: TIED, totalCount: 2155, isComplete: false },
    });
  });

  it('listening → not-found (nothing heard) when no word came', () => {
    expect(after(...LISTENING, ENDED)).toEqual({ status: 'not-found', reason: 'nothing-heard' });
  });

  it('listening → not-found (too few words) when the words could not identify a passage', () => {
    expect(after(...LISTENING, heard(2, TOO_FEW), ENDED)).toEqual({
      status: 'not-found',
      reason: 'too-few-words',
    });
  });

  it('listening → not-found (no match) when no passage fits the words', () => {
    expect(after(...LISTENING, heard(9, NO_MATCH), ENDED)).toEqual({
      status: 'not-found',
      reason: 'no-match',
    });
  });

  it('an interruption by the system concludes with what was heard, like an end', () => {
    const interrupted: ListeningEvent = { type: 'engine-ended', reason: 'interrupted' };
    expect(after(...LISTENING, heard(4, AMBIGUOUS), interrupted).status).toBe('ambiguous');
    expect(after(...LISTENING, interrupted)).toEqual({
      status: 'not-found',
      reason: 'nothing-heard',
    });
  });

  it('listening → failed when the engine breaks down', () => {
    const failed: ListeningEvent = { type: 'engine-ended', reason: 'failed' };
    expect(after(...LISTENING, heard(4, AMBIGUOUS), failed)).toEqual({ status: 'failed' });
  });
});

describe('when the person stops', () => {
  it('listening → closed when nothing was heard: there is nothing to tell', () => {
    expect(after(...LISTENING, STOP)).toEqual({ status: 'closed' });
  });

  it('listening → ambiguous when the words heard fit several places', () => {
    expect(after(...LISTENING, heard(4, AMBIGUOUS), STOP)).toEqual({
      status: 'ambiguous',
      passages: { candidates: TIED, totalCount: 6, isComplete: true },
    });
  });

  it('listening → not-found when words were heard and fit nothing', () => {
    expect(after(...LISTENING, heard(2, TOO_FEW), STOP)).toEqual({
      status: 'not-found',
      reason: 'too-few-words',
    });
  });
});

describe('listening again', () => {
  const RESULTS: readonly (readonly [string, ListeningState])[] = [
    ['found', after(...LISTENING, heard(4, FOUND))],
    ['ambiguous', after(...LISTENING, heard(4, AMBIGUOUS), ENDED)],
    ['not-found', after(...LISTENING, ENDED)],
    ['microphone-denied', after(OPENED, { type: 'microphone-denied' })],
    ['failed', after(OPENED, { type: 'start-failed' })],
    ['closed', after(...LISTENING, STOP)],
  ];

  it.each(RESULTS)('%s → starting when the screen listens again', (status, state) => {
    expect(state.status).toBe(status);
    expect(transition(state, OPENED)).toEqual({ status: 'starting' });
  });

  it('a new listening starts from nothing: no word of the previous one is kept', () => {
    const again = [heard(4, AMBIGUOUS), ENDED, OPENED, STARTED, ENDED] as const;
    expect(after(...LISTENING, ...again)).toEqual({
      status: 'not-found',
      reason: 'nothing-heard',
    });
  });
});

describe('events that arrive late or out of turn', () => {
  it('words that arrive once a result is shown change nothing', () => {
    const found = after(...LISTENING, heard(4, FOUND));
    expect(transition(found, heard(9, AMBIGUOUS))).toBe(found);
    const closed = after(...LISTENING, STOP);
    expect(transition(closed, heard(4, FOUND))).toBe(closed);
  });

  it('opening while already starting or listening changes nothing', () => {
    const starting = after(OPENED);
    expect(transition(starting, OPENED)).toBe(starting);
    const listening = after(...LISTENING, heard(4, AMBIGUOUS));
    expect(transition(listening, OPENED)).toBe(listening);
  });

  it('an end or a stop outside a listening changes nothing', () => {
    for (const state of [INITIAL_LISTENING_STATE, after(...LISTENING, heard(4, FOUND))]) {
      expect(transition(state, ENDED)).toBe(state);
      expect(transition(state, STOP)).toBe(state);
      expect(transition(state, STARTED)).toBe(state);
      expect(transition(state, { type: 'microphone-denied' })).toBe(state);
      expect(transition(state, { type: 'start-failed' })).toBe(state);
    }
  });
});

describe('invalid events', () => {
  it.each([[-1], [1.5], [Number.NaN]])('refuses %p heard words', (count) => {
    expect(() => after(...LISTENING, heard(count, NO_MATCH))).toThrow(RangeError);
  });

  it('refuses a count of heard words that goes down', () => {
    expect(() => after(...LISTENING, heard(5, NO_MATCH), heard(3, NO_MATCH))).toThrow(RangeError);
  });

  it('refuses a "found" result that names no passage', () => {
    // A result the search cannot produce, built on purpose.
    const empty = { status: 'found', candidates: [], tiedCount: 1 } as SearchResult;
    expect(() => after(...LISTENING, heard(4, empty))).toThrow(TypeError);
  });
});
