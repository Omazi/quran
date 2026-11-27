import { useCallback, useEffect, useReducer, useRef } from 'react';

import {
  AUDIO_CHECK,
  INITIAL_LISTENING_STATE,
  failureOf,
  searchHeardWords,
  searchWithPartialWords,
  transition,
  type ListeningEvent,
  type ListeningState,
  type SpeechEngine,
} from '@/domain/listening';
import type { VerseIndex } from '@/domain/recognition';

import { checkHeardWords, type HeldTexts } from './held-check';

export interface ListeningDependencies {
  readonly engine: SpeechEngine;
  /** The passage search over the whole Quran (`loadQuranVerseIndex` in the app). */
  readonly loadVerseIndex: () => Promise<VerseIndex>;
  /**
   * Whether the microphone opens as the screen appears. False when the screen was opened by a
   * link: it then waits for the person to press the button (`listenAgain` starts it).
   */
  readonly autoStart: boolean;
  /**
   * Imla'i verse texts for the audio check (D47, `held-check.ts`): when the words do not name a
   * passage, the ranked passages are read again from the audio. Without it, or with an engine
   * that cannot (`checkHeard`), the screen goes by the words alone.
   */
  readonly loadHeldTexts?: () => Promise<HeldTexts>;
}

export interface Listening {
  readonly state: ListeningState;
  /**
   * The words heard so far in this listening, the final ones then those not final yet, as the
   * engine wrote them: shown faintly while it listens, so the person sees the voice arrive.
   */
  readonly heardWords: readonly string[];
  /** Listens again from nothing: after a result, a refusal or a failure. */
  readonly listenAgain: () => void;
  /** The person pressed "Stop". */
  readonly stop: () => void;
}

const EMPTY_WORDS: readonly string[] = [];

/** The domain's state, and the words heard in this listening, to show them. */
interface ScreenState {
  readonly listening: ListeningState;
  readonly words: readonly string[];
}

/** A domain event; words heard carry the words themselves, for the screen. */
type ScreenEvent = ListeningEvent & { readonly words?: readonly string[] };

const INITIAL_SCREEN: ScreenState = { listening: INITIAL_LISTENING_STATE, words: EMPTY_WORDS };

/** The domain's rule (`transition`), and the words kept alongside: emptied by a new listening. */
function reduce(state: ScreenState, event: ScreenEvent): ScreenState {
  const listening = transition(state.listening, event);
  let { words } = state;
  if (event.type === 'opened' && listening !== state.listening) words = EMPTY_WORDS;
  if (event.type === 'words-heard' && state.listening.status === 'listening') {
    words = event.words ?? words;
  }
  return listening === state.listening && words === state.words ? state : { listening, words };
}

/** The states in which the engine may be listening. */
function isActive(state: ListeningState): boolean {
  return state.status === 'starting' || state.status === 'listening';
}

/**
 * Drives one listening screen: asks for the microphone when needed, starts the engine, searches
 * the passage for every word heard (with the domain's search, never redone here: all the words,
 * then the latest ones alone, `searchHeardWords`; and with the words not final yet,
 * `searchWithPartialWords`), and stops the engine as soon as the screen has its answer. The rules of the states are the domain's (`transition`); this hook only tells it
 * what happened, in the order it happened.
 *
 * The level of the voice does not pass through here: the rosette subscribes to it directly.
 */
export function useListening({
  engine,
  loadVerseIndex,
  autoStart,
  loadHeldTexts,
}: ListeningDependencies): Listening {
  const [screen, dispatch] = useReducer(reduce, INITIAL_SCREEN);
  const state = screen.listening;
  /** Each listening has its number: what a previous one says late is ignored. */
  const session = useRef(0);

  const start = useCallback(() => {
    session.current += 1;
    const current = session.current;
    const isCurrent = () => session.current === current;
    const heardWords: string[] = [];
    // Words and the end are handled in the order the engine gave them, each after the search of
    // the words before it, which may still wait for the index.
    let queue: Promise<void> = Promise.resolve();
    const index = loadVerseIndex();
    // An index that cannot be built is reported once the engine listens (see below).
    index.catch(() => undefined);

    const enqueue = (step: () => Promise<void> | void) => {
      queue = queue.then(step).catch(() => {
        if (isCurrent()) dispatch({ type: 'engine-ended', reason: 'failed' });
      });
    };

    // The audio check (D47): one at a time, beside the words (the engine keeps listening), and
    // again only once more words came. Whatever it finds is announced as words found are.
    let found = false;
    let checkedAt = 0;
    let checking: Promise<void> | null = null;
    const canCheck = engine.checkHeard !== undefined && loadHeldTexts !== undefined;
    const check = (words: readonly string[], last = false): Promise<void> => {
      checkedAt = words.length;
      const run = (async () => {
        try {
          const result = await checkHeardWords(engine, await index, await loadHeldTexts!(), words, {
            secondChance: last,
          });
          if (result !== null && isCurrent() && !found) {
            found = true;
            // More words may have come during the check: the answer stands for all of them.
            const all = [...heardWords];
            dispatch({ type: 'words-heard', heardWordCount: all.length, result, words: all });
          }
        } catch {
          // A check that fails leaves the answer to the words.
        }
      })();
      checking = run;
      void run.then(() => {
        if (checking === run) checking = null;
      });
      return run;
    };
    const maybeCheck = (words: readonly string[]) => {
      if (!canCheck || found || checking !== null) return;
      if (
        words.length < AUDIO_CHECK.minWords ||
        words.length < checkedAt + AUDIO_CHECK.recheckAfterWords
      ) {
        return;
      }
      void check(words);
    };

    const unsubscribeWords = engine.onWords((words) => {
      if (!isCurrent() || words.length === 0) return;
      heardWords.push(...words);
      const snapshot = [...heardWords];
      enqueue(async () => {
        const result = searchHeardWords(await index, snapshot);
        if (result.status === 'found') found = true;
        else maybeCheck(snapshot);
        if (isCurrent()) {
          dispatch({
            type: 'words-heard',
            heardWordCount: snapshot.length,
            result,
            words: snapshot,
          });
        }
      });
    });
    const unsubscribeEnd = engine.onEnd((reason, failure) => {
      enqueue(async () => {
        // Before "nothing found": the check under way, then one with every word heard.
        if (canCheck && !found && reason === 'finished') {
          if (checking !== null) await checking;
          if (
            !found &&
            heardWords.length >= AUDIO_CHECK.minWords &&
            heardWords.length > checkedAt
          ) {
            await check([...heardWords]);
          }
        }
        if (isCurrent()) dispatch({ type: 'engine-ended', reason, failure });
      });
    });
    // What the engine does, at once: it is what tells the person the phone hears them. The
    // words of the latest reading that are not final yet are searched too, after the final ones
    // (D45): only a passage found counts, and it closes the listening as any answer does.
    const unsubscribeActivity =
      engine.onActivity?.((activity) => {
        if (!isCurrent()) return;
        dispatch({ type: 'activity', activity });
        if (activity.partial.length === 0) return;
        const final = [...heardWords];
        const partial = [...activity.partial];
        enqueue(async () => {
          const result = searchWithPartialWords(await index, final, partial);
          if (result !== null) found = true;
          if (result !== null && isCurrent()) {
            const words = [...final, ...partial];
            dispatch({ type: 'words-heard', heardWordCount: words.length, result, words });
          }
        });
      }) ?? (() => undefined);

    dispatch({ type: 'opened' });
    void (async () => {
      try {
        let permission = await engine.getMicrophonePermission();
        if (permission === 'undetermined') permission = await engine.requestMicrophonePermission();
        if (!isCurrent()) return;
        if (permission !== 'granted') {
          dispatch({ type: 'microphone-denied' });
          return;
        }
        await engine.start();
        if (!isCurrent()) return;
        dispatch({ type: 'listening-started' });
        // A search that cannot be built ends the listening as a failure, whatever was heard.
        enqueue(async () => {
          await index;
        });
      } catch (error) {
        if (isCurrent()) dispatch({ type: 'start-failed', failure: failureOf(error) });
      }
    })();

    return () => {
      unsubscribeWords();
      unsubscribeEnd();
      unsubscribeActivity();
    };
  }, [engine, loadVerseIndex, loadHeldTexts]);

  // One listening when the screen opens (if it was opened from inside the app); the engine is
  // closed when the screen goes away.
  const unsubscribe = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (autoStart) unsubscribe.current = start();
    return () => {
      session.current += 1;
      unsubscribe.current?.();
      void engine.stop();
    };
  }, [engine, start, autoStart]);

  // As soon as the screen has its answer, the microphone is closed.
  const isOver = state.status !== 'idle' && !isActive(state);
  useEffect(() => {
    if (isOver) void engine.stop();
  }, [isOver, engine]);

  const listenAgain = useCallback(() => {
    unsubscribe.current?.();
    unsubscribe.current = start();
  }, [start]);

  const stop = useCallback(() => {
    dispatch({ type: 'stop-requested' });
  }, []);

  const partial = state.status === 'listening' ? state.partial : EMPTY_WORDS;
  const heardWords = partial.length === 0 ? screen.words : [...screen.words, ...partial];
  return { state, heardWords, listenAgain, stop };
}
