/**
 * The states of the listening screen and the rule that moves it from one to the next.
 *
 * A pure function: it knows neither the engine nor the clock. Whoever drives it (the feature)
 * tells it what happened, as events, and reads the state to show.
 *
 * Two rules come from the passage search (docs/specs/recognition.md, "jamais sûr à tort"):
 * a passage is announced only when the search says `found`, and an `ambiguous` result is never
 * settled here: the screen goes on listening, because more words may tell the places apart, and
 * shows every tied place once the listening is over.
 */
import type { PassageCandidate, SearchResult } from '../recognition';

import type { SpeechEndReason } from './types';

/**
 * Why no passage is shown.
 * - `nothing-heard`: the engine gave no word.
 * - `too-few-words`: the words heard cannot identify a passage.
 * - `no-match`: no passage explains the words well enough.
 */
export type NothingFoundReason = 'nothing-heard' | 'too-few-words' | 'no-match';

/** The places that explain the heard words equally well. */
export interface TiedPassages {
  /** In mushaf order. Every tied place, unless `isComplete` says otherwise. */
  readonly candidates: readonly PassageCandidate[];
  /** How many tied places the search counted: more than are listed when the list was cut. */
  readonly totalCount: number;
  /** False when the search left places out (`SearchLimits.truncated`): the screen must say so. */
  readonly isComplete: boolean;
}

export type ListeningState =
  /** Nothing was asked yet. */
  | { readonly status: 'idle' }
  /** The microphone is being asked for and opened. Nothing is heard yet. */
  | { readonly status: 'starting' }
  | {
      readonly status: 'listening';
      /** Words the engine gave since this listening started. */
      readonly heardWordCount: number;
      /** What the search answered for those words; null while no word came. */
      readonly latestResult: SearchResult | null;
    }
  | { readonly status: 'found'; readonly passage: PassageCandidate }
  | { readonly status: 'ambiguous'; readonly passages: TiedPassages }
  | { readonly status: 'not-found'; readonly reason: NothingFoundReason }
  | { readonly status: 'microphone-denied' }
  /** The engine or the text of the Quran could not be used. */
  | { readonly status: 'failed' }
  /** The person stopped with nothing to show: the screen has nothing left to say. */
  | { readonly status: 'closed' };

export type ListeningEvent =
  /** The screen asks to listen: when it opens, and when the person asks to listen again. */
  | { readonly type: 'opened' }
  | { readonly type: 'microphone-denied' }
  | { readonly type: 'listening-started' }
  | {
      readonly type: 'words-heard';
      /** Every word heard since the listening started, the new ones included. */
      readonly heardWordCount: number;
      /** The answer of the passage search for all those words. */
      readonly result: SearchResult;
    }
  | { readonly type: 'engine-ended'; readonly reason: SpeechEndReason }
  /** The person pressed "Stop". */
  | { readonly type: 'stop-requested' }
  | { readonly type: 'start-failed' };

export const INITIAL_LISTENING_STATE: ListeningState = { status: 'idle' };

const STARTING: ListeningState = { status: 'starting' };
const CLOSED: ListeningState = { status: 'closed' };
const FAILED: ListeningState = { status: 'failed' };
const MICROPHONE_DENIED: ListeningState = { status: 'microphone-denied' };

type Listening = Extract<ListeningState, { status: 'listening' }>;
type WordsHeard = Extract<ListeningEvent, { type: 'words-heard' }>;

/**
 * The state that follows an event. An event that makes no sense in the current state (words
 * that arrive after the result, a second "Stop") leaves the state as it is, the same object:
 * engines answer late, and a late answer is not an error. An event with an impossible value is
 * one: it throws.
 */
export function transition(state: ListeningState, event: ListeningEvent): ListeningState {
  switch (state.status) {
    case 'starting':
      return fromStarting(state, event);
    case 'listening':
      return fromListening(state, event);
    default:
      // Idle, a result or a refusal: the only way on is to listen (again).
      return event.type === 'opened' ? STARTING : state;
  }
}

function fromStarting(state: ListeningState, event: ListeningEvent): ListeningState {
  switch (event.type) {
    case 'listening-started':
      return { status: 'listening', heardWordCount: 0, latestResult: null };
    case 'microphone-denied':
      return MICROPHONE_DENIED;
    case 'start-failed':
      return FAILED;
    case 'engine-ended':
      return event.reason === 'failed' ? FAILED : state;
    case 'stop-requested':
      return CLOSED;
    default:
      return state;
  }
}

function fromListening(state: Listening, event: ListeningEvent): ListeningState {
  switch (event.type) {
    case 'words-heard':
      return afterWords(state, event);
    case 'engine-ended':
      return event.reason === 'failed' ? FAILED : conclude(state);
    case 'stop-requested':
      // Stopping before a single word was heard is leaving: there is nothing to tell.
      return state.heardWordCount === 0 ? CLOSED : conclude(state);
    default:
      return state;
  }
}

function afterWords(state: Listening, { heardWordCount, result }: WordsHeard): ListeningState {
  if (!Number.isInteger(heardWordCount) || heardWordCount < state.heardWordCount) {
    throw new RangeError(
      `heardWordCount must be a whole number, ${state.heardWordCount} or more, got ${heardWordCount}`,
    );
  }
  if (result.status !== 'found') {
    return { status: 'listening', heardWordCount, latestResult: result };
  }
  const [passage] = result.candidates;
  if (passage === undefined) throw new TypeError('A "found" result must name its passage');
  return { status: 'found', passage };
}

/** What to show when the listening is over without a passage found. */
function conclude({ heardWordCount, latestResult }: Listening): ListeningState {
  if (latestResult === null || heardWordCount === 0) {
    return { status: 'not-found', reason: 'nothing-heard' };
  }
  if (latestResult.status === 'not-found') {
    return { status: 'not-found', reason: latestResult.reason };
  }
  // The tied places come first in the candidates; the lower-ranked ones after them are not
  // places the words were found at, and are left out.
  return {
    status: 'ambiguous',
    passages: {
      candidates: latestResult.candidates.slice(0, latestResult.tiedCount),
      totalCount: latestResult.tiedCount,
      isComplete: latestResult.truncated !== true,
    },
  };
}
