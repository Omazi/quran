import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  failureOf,
  followRecitation,
  startFollowing,
  type FollowState,
  type SpeechEngine,
  type SpeechFailure,
  type Unsubscribe,
} from '@/domain/listening';
import type { VerseRef } from '@/domain/quran';

import { READER_CONFIG } from './config';
import { buildFollowTrack, nextVerse, pagesFollowedByVoice, type TrackWord } from './follow-model';

export type RecitationStatus = 'idle' | 'starting' | 'following' | 'denied' | 'failed';

export interface RecitationFollow {
  readonly status: RecitationStatus;
  /** The words followed, from the verse the recitation started at. */
  readonly track: readonly TrackWord[];
  readonly state: FollowState;
  /** The word to keep at the reading line: the word just recited, else the next one. */
  readonly target: TrackWord | null;
  /** The word to read again, exactly as the Uthmani text writes it, or null. */
  readonly rereadWord: string | null;
  /** The level of the voice, for the meter, while following. */
  readonly subscribeToLevel: ((listener: (level: number) => void) => Unsubscribe) | null;
  /** A voice is heard right now (the bar says "Je t'entends"). */
  readonly isHearing: boolean;
  /** The latest words heard, final then not final yet, shown faintly in the bar. */
  readonly heardWords: readonly string[];
  /** What broke, when `status` is `failed`. */
  readonly failure: SpeechFailure | null;
  /** Asks for the microphone if needed, then follows from `from`. */
  readonly start: (from: VerseRef) => void;
  readonly stop: () => void;
}

export interface RecitationFollowDependencies {
  /** A new engine for each recitation; null where the phone has none. */
  readonly createEngine: () => SpeechEngine | null;
  /** The Uthmani text, the words the voice is matched on; null while it loads. */
  readonly uthmaniTextOf: ((ref: VerseRef) => string) | null;
  /** Pages the voice has just followed from their first word to their last. */
  readonly onPagesFollowed: (pages: readonly number[]) => void;
  /**
   * Starts once, from this verse, as soon as the text is there: the reader opened in follow mode
   * (`/reader/294?follow=1&from=18:10`, where `/voice-follow` leads).
   */
  readonly autoStartFrom?: VerseRef | null;
}

const SECOND_MS = 1000;
const NOTHING_YET: FollowState = startFollowing(0);
/** How many of the latest words heard the bar keeps. */
const HEARD_WORDS_KEPT = 6;
const NO_WORDS: readonly string[] = [];

/**
 * Follows a recitation in the vertical reader (spec 3b): opens the microphone when the person
 * taps it (the permission is asked then, in context), matches each word heard on the Uthmani
 * words from the verse at the reading line (`followRecitation`), adds pages ahead as it goes, and
 * stops when the person taps stop, when the app leaves the foreground (a call included), when the
 * engine ends, or after a silence. The pages followed whole are handed over to be counted.
 */
export function useRecitationFollow({
  createEngine,
  uthmaniTextOf,
  onPagesFollowed,
  autoStartFrom = null,
}: RecitationFollowDependencies): RecitationFollow {
  const [status, setStatus] = useState<RecitationStatus>('idle');
  const [failure, setFailure] = useState<SpeechFailure | null>(null);
  const [isHearing, setIsHearing] = useState(false);
  const [finalWords, setFinalWords] = useState<readonly string[]>(NO_WORDS);
  const [partialWords, setPartialWords] = useState<readonly string[]>(NO_WORDS);
  // The engine listening, for the meter; the ref is the same engine for the callbacks.
  const [listening, setListening] = useState<SpeechEngine | null>(null);
  const [followed, setFollowed] = useState<{
    track: readonly TrackWord[];
    state: FollowState;
  }>({ track: [], state: NOTHING_YET });
  const engine = useRef<SpeechEngine | null>(null);
  const unsubscribe = useRef<Unsubscribe[]>([]);
  const silence = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counted = useRef(new Set<number>());
  const latest = useRef({ uthmaniTextOf, onPagesFollowed });
  useEffect(() => {
    latest.current = { uthmaniTextOf, onPagesFollowed };
  });

  const close = useCallback((next: RecitationStatus, why: SpeechFailure | null = null) => {
    if (silence.current !== null) clearTimeout(silence.current);
    silence.current = null;
    for (const stopListening of unsubscribe.current) stopListening();
    unsubscribe.current = [];
    const open = engine.current;
    engine.current = null;
    if (open !== null) void open.stop();
    setListening(null);
    setIsHearing(false);
    setPartialWords(NO_WORDS);
    setFailure(next === 'failed' ? (why ?? 'unknown') : null);
    setStatus(next);
  }, []);

  const stop = useCallback(() => close('idle'), [close]);

  const listenForSilence = useCallback(() => {
    if (silence.current !== null) clearTimeout(silence.current);
    silence.current = setTimeout(
      () => close('idle'),
      READER_CONFIG.follow.silenceSeconds * SECOND_MS,
    );
  }, [close]);

  const hear = useCallback(
    (words: readonly string[]) => {
      const textOf = latest.current.uthmaniTextOf;
      if (textOf === null) return;
      listenForSilence();
      setFinalWords((kept) => [...kept, ...words].slice(-HEARD_WORDS_KEPT));
      setFollowed(({ track, state }) => {
        let longer = track;
        const last = track.at(-1);
        const after = last === undefined ? null : nextVerse(last);
        if (after !== null && state.next >= track.length - READER_CONFIG.follow.extendWithinWords) {
          longer = [...track, ...buildFollowTrack(after, textOf, READER_CONFIG.follow.pagesAhead)];
        }
        const next = followRecitation(
          state,
          longer.map((word) => word.text),
          words,
        );
        const pages = pagesFollowedByVoice(longer, next).filter(
          (page) => !counted.current.has(page),
        );
        if (pages.length > 0) {
          for (const page of pages) counted.current.add(page);
          // After the update, outside the state's own function.
          setTimeout(() => latest.current.onPagesFollowed(pages), 0);
        }
        return { track: longer, state: next };
      });
    },
    [listenForSilence],
  );

  const start = useCallback(
    (from: VerseRef) => {
      const textOf = latest.current.uthmaniTextOf;
      if (engine.current !== null || textOf === null) return;
      const created = createEngine();
      if (created === null) {
        setStatus('failed');
        return;
      }
      engine.current = created;
      counted.current = new Set();
      setFollowed({
        track: buildFollowTrack(from, textOf, READER_CONFIG.follow.pagesAhead),
        state: NOTHING_YET,
      });
      setStatus('starting');
      setFailure(null);
      setFinalWords(NO_WORDS);
      setPartialWords(NO_WORDS);
      unsubscribe.current = [
        created.onWords(hear),
        created.onEnd((reason, why) => close(reason === 'failed' ? 'failed' : 'idle', why ?? null)),
        created.onActivity?.((activity) => {
          if (engine.current !== created) return;
          setIsHearing(activity.voice);
          setPartialWords(activity.partial);
        }) ?? (() => undefined),
      ];
      void (async () => {
        try {
          let permission = await created.getMicrophonePermission();
          if (permission === 'undetermined') {
            permission = await created.requestMicrophonePermission();
          }
          if (engine.current !== created) return;
          if (permission !== 'granted') {
            close('denied');
            return;
          }
          await created.start();
          if (engine.current !== created) return;
          setListening(created);
          setStatus('following');
          listenForSilence();
        } catch (error) {
          if (engine.current === created) close('failed', failureOf(error));
        }
      })();
    },
    [close, createEngine, hear, listenForSilence],
  );

  // Leaving for the background ends the listening: the home screen, the phone locked. Only the
  // background: the system's own microphone question makes the app `inactive` while it shows,
  // and ending there closed the very first follow the moment the person said yes. A call is
  // told by the engine itself (an interruption ends it).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background' && engine.current !== null) close('idle');
    });
    return () => subscription.remove();
  }, [close]);

  const hasAutoStarted = useRef(false);
  useEffect(() => {
    if (autoStartFrom === null || uthmaniTextOf === null || hasAutoStarted.current) return;
    hasAutoStarted.current = true;
    start(autoStartFrom);
  }, [autoStartFrom, start, uthmaniTextOf]);

  // Leaving the reader closes the microphone.
  useEffect(() => () => close('idle'), [close]);

  const { track, state } = followed;
  const isActive = status === 'starting' || status === 'following';
  const targetIndex = state.current ?? state.next;
  return {
    status,
    track: isActive ? track : [],
    state,
    target: isActive ? (track[Math.min(targetIndex, track.length - 1)] ?? null) : null,
    rereadWord: isActive && state.reread !== null ? (track[state.reread]?.text ?? null) : null,
    subscribeToLevel: status === 'following' ? (listening?.onLevel ?? null) : null,
    isHearing: isActive && isHearing,
    heardWords: isActive ? [...finalWords, ...partialWords].slice(-HEARD_WORDS_KEPT) : NO_WORDS,
    failure,
    start,
    stop,
  };
}
