import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  followRecitation,
  startFollowing,
  type FollowState,
  type SpeechEngine,
} from '@/domain/listening';
import type { MushafPage, MushafWord, VerseRef } from '@/domain/quran';

export type FollowStatus = 'loading' | 'starting' | 'following' | 'ended' | 'denied' | 'failed';

/** A word of the followed page, with its place in the page's reading order. */
export interface FollowWord {
  readonly index: number;
  readonly word: MushafWord;
}

/** A line of the followed page: its words, and the verses that end after which of them. */
export interface FollowLine {
  readonly words: readonly FollowWord[];
  readonly verseEnds: readonly { readonly afterWordIndex: number; readonly verse: number }[];
}

export interface VoiceFollow {
  readonly status: FollowStatus;
  readonly page: MushafPage | null;
  /** The text lines of the page, in order (headers and basmalas are not followed). */
  readonly lines: readonly FollowLine[];
  readonly follow: FollowState;
  /** The first word followed: the words before it are read as they are. */
  readonly startIndex: number;
  /** The word to read again, exactly as the data writes it, or null. */
  readonly rereadWord: string | null;
  /** The person pressed "Stop": the engine is closed. */
  readonly stop: () => void;
}

export interface VoiceFollowDependencies {
  readonly engine: SpeechEngine;
  readonly pageNumber: number;
  /** Where the recitation starts on the page; the first word of the page when absent. */
  readonly from?: VerseRef;
  readonly loadPage: (page: number) => Promise<MushafPage>;
  /** Called once the engine is stopped by the person. */
  readonly onStopped: () => void;
}

function linesOf(page: MushafPage | null): FollowLine[] {
  if (page === null) return [];
  let index = 0;
  return page.lines.flatMap((line) =>
    line.kind === 'text'
      ? [{ words: line.words.map((word) => ({ index: index++, word })), verseEnds: line.verseEnds }]
      : [],
  );
}

function startIndex(lines: readonly FollowLine[], from: VerseRef | undefined): number {
  if (from === undefined) return 0;
  const key = `${from.surah}:${from.verse}`;
  for (const line of lines) {
    const found = line.words.find(({ word }) => word.verseKey === key);
    if (found !== undefined) return found.index;
  }
  return 0;
}

/**
 * Follows a recitation on one page of the mushaf (docs/design/voix.png): reads the page from the
 * data layer, opens the microphone, and tells the domain each word heard (`followRecitation`).
 * The words are only compared, never changed; the level of the voice goes straight to the bar.
 */
export function useVoiceFollow({
  engine,
  pageNumber,
  from,
  loadPage,
  onStopped,
}: VoiceFollowDependencies): VoiceFollow {
  const [page, setPage] = useState<MushafPage | null>(null);
  const [status, setStatus] = useState<FollowStatus>('loading');
  const lines = useMemo(() => linesOf(page), [page]);
  const pageWords = useMemo(
    () => lines.flatMap((line) => line.words.map(({ word }) => word.text)),
    [lines],
  );
  const fromKey = from === undefined ? null : `${from.surah}:${from.verse}`;
  // `fromKey` names the verse: a new object for the same verse must not move the start.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const start = useMemo(() => startIndex(lines, from), [lines, fromKey]);
  // The state of the recitation from the start it was made for: a new start begins afresh.
  const [followed, setFollowed] = useState<{ start: number; state: FollowState } | null>(null);
  const isOpen = useRef(true);

  useEffect(() => {
    let isCurrent = true;
    loadPage(pageNumber).then(
      (loaded) => {
        if (isCurrent) setPage(loaded);
      },
      (error: unknown) => {
        console.error('The followed page could not be read.', error);
        if (isCurrent) setStatus('failed');
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [loadPage, pageNumber]);

  useEffect(() => {
    if (page === null) return undefined;
    isOpen.current = true;
    const unsubscribeWords = engine.onWords((words) => {
      if (!isOpen.current) return;
      setFollowed((previous) => {
        const state = previous?.start === start ? previous.state : startFollowing(start);
        return { start, state: followRecitation(state, pageWords, words) };
      });
    });
    const unsubscribeEnd = engine.onEnd((reason) => {
      if (isOpen.current) setStatus(reason === 'failed' ? 'failed' : 'ended');
    });
    void (async () => {
      try {
        let permission = await engine.getMicrophonePermission();
        if (permission === 'undetermined') permission = await engine.requestMicrophonePermission();
        if (!isOpen.current) return;
        if (permission !== 'granted') {
          setStatus('denied');
          return;
        }
        await engine.start();
        if (isOpen.current) setStatus('following');
      } catch {
        if (isOpen.current) setStatus('failed');
      }
    })();
    return () => {
      isOpen.current = false;
      unsubscribeWords();
      unsubscribeEnd();
      void engine.stop();
    };
  }, [engine, page, pageWords, start]);

  const stop = useCallback(() => {
    isOpen.current = false;
    void engine.stop().finally(onStopped);
  }, [engine, onStopped]);

  const follow =
    followed !== null && followed.start === start ? followed.state : startFollowing(start);
  // Once the page is read, the screen is starting until the engine says otherwise.
  const shownStatus: FollowStatus = status === 'loading' && page !== null ? 'starting' : status;
  const rereadWord = follow.reread === null ? null : (pageWords[follow.reread] ?? null);
  return { status: shownStatus, page, lines, follow, startIndex: start, rereadWord, stop };
}
