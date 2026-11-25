import { useCallback, useEffect, useReducer, useRef } from 'react';

import {
  INITIAL_LISTENING_STATE,
  searchHeardWords,
  transition,
  type ListeningState,
  type SpeechEngine,
} from '@/domain/listening';
import type { VerseIndex } from '@/domain/recognition';

export interface ListeningDependencies {
  readonly engine: SpeechEngine;
  /** The passage search over the whole Quran (`loadQuranVerseIndex` in the app). */
  readonly loadVerseIndex: () => Promise<VerseIndex>;
}

export interface Listening {
  readonly state: ListeningState;
  /** Listens again from nothing: after a result, a refusal or a failure. */
  readonly listenAgain: () => void;
  /** The person pressed "Stop". */
  readonly stop: () => void;
}

/** The states in which the engine may be listening. */
function isActive(state: ListeningState): boolean {
  return state.status === 'starting' || state.status === 'listening';
}

/**
 * Drives one listening screen: asks for the microphone when needed, starts the engine, searches
 * the passage for every word heard (with the domain's search, never redone here: all the words,
 * then the latest ones alone, `searchHeardWords`), and stops the engine as soon as the screen has
 * its answer. The rules of the states are the domain's (`transition`); this hook only tells it
 * what happened, in the order it happened.
 *
 * The level of the voice does not pass through here: the rosette subscribes to it directly.
 */
export function useListening({ engine, loadVerseIndex }: ListeningDependencies): Listening {
  const [state, dispatch] = useReducer(transition, INITIAL_LISTENING_STATE);
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

    const unsubscribeWords = engine.onWords((words) => {
      if (!isCurrent() || words.length === 0) return;
      heardWords.push(...words);
      const snapshot = [...heardWords];
      enqueue(async () => {
        const result = searchHeardWords(await index, snapshot);
        if (isCurrent()) {
          dispatch({ type: 'words-heard', heardWordCount: snapshot.length, result });
        }
      });
    });
    const unsubscribeEnd = engine.onEnd((reason) => {
      enqueue(() => {
        if (isCurrent()) dispatch({ type: 'engine-ended', reason });
      });
    });

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
      } catch {
        if (isCurrent()) dispatch({ type: 'start-failed' });
      }
    })();

    return () => {
      unsubscribeWords();
      unsubscribeEnd();
    };
  }, [engine, loadVerseIndex]);

  // One listening when the screen opens; the engine is closed when the screen goes away.
  const unsubscribe = useRef<(() => void) | null>(null);
  useEffect(() => {
    unsubscribe.current = start();
    return () => {
      session.current += 1;
      unsubscribe.current?.();
      void engine.stop();
    };
  }, [engine, start]);

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

  return { state, listenAgain, stop };
}
