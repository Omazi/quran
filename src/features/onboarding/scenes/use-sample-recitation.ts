import { useEffect, useState } from 'react';

import { quranRepository } from '@/data/quran';
import type { QuranRepository } from '@/domain/quran';
import type { FollowLine } from '@/features/listening/follow/follow-lines';
import { storyLayout } from '@/ui';

/** The page of the mockup of the voice following (voix.png) and the verse it is recited from. */
const SAMPLE_PAGE = 294;
const SAMPLE_VERSE_KEY = '18:10';

/**
 * The words recited in the demonstration, from the data layer: the first words of Al-Kahf 18:10,
 * set in lines as the reader sets them, each word with its place in the reading order. Null until
 * the page is loaded (or if it cannot be), when the scene shows only where the words will be.
 * Nothing is typed by hand and nothing is changed (docs/ARCHITECTURE.md).
 */
export function useSampleRecitation(
  shouldLoad: boolean,
  repository: QuranRepository = quranRepository,
): readonly FollowLine[] | null {
  const [lines, setLines] = useState<readonly FollowLine[] | null>(null);
  useEffect(() => {
    if (!shouldLoad || lines !== null) return;
    let isCurrent = true;
    repository.getPage(SAMPLE_PAGE).then(
      (page) => {
        if (!isCurrent) return;
        const words = page.lines
          .flatMap((line) => (line.kind === 'text' ? line.words : []))
          .filter((word) => word.verseKey === SAMPLE_VERSE_KEY)
          .slice(0, storyLayout.voiceLineCount * storyLayout.voiceWordsPerLine);
        setLines(
          Array.from({ length: storyLayout.voiceLineCount }, (_, line) => ({
            words: words
              .slice(
                line * storyLayout.voiceWordsPerLine,
                (line + 1) * storyLayout.voiceWordsPerLine,
              )
              .map((word, position) => ({
                index: line * storyLayout.voiceWordsPerLine + position,
                word,
              })),
            verseEnds: [],
          })),
        );
      },
      (error: unknown) => {
        console.error('The sample recitation of the introduction could not be loaded.', error);
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [shouldLoad, lines, repository]);
  return lines;
}
