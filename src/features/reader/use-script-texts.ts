import { useEffect, useState } from 'react';

import { quranRepository, quranStructure } from '@/data/quran';
import type { QuranRepository, VerseRef } from '@/domain/quran';
import type { ReaderScript } from '@/store';

export type ScriptTexts =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | {
      readonly status: 'ready';
      readonly script: ReaderScript;
      /** The text of a verse, exactly as the repository gives it. */
      readonly textOf: (ref: VerseRef) => string;
    };

const LOADING: ScriptTexts = { status: 'loading' };

/**
 * The verses of the script shown, from the repository. Each script is one file of the data layer,
 * read once and kept (D3), so the whole text is at hand while the person scrolls: the list never
 * waits for a page. Data that cannot be trusted gives the error state, never part of the text.
 */
export function useScriptTexts(
  script: ReaderScript,
  repository: QuranRepository = quranRepository,
): ScriptTexts {
  const [state, setState] = useState<{ script: ReaderScript; value: ScriptTexts }>({
    script,
    value: LOADING,
  });
  useEffect(() => {
    let isCurrent = true;
    Promise.all(
      quranStructure.surahs.map(({ surah }) => repository.getSurahVerses(surah, script)),
    ).then(
      (surahs) => {
        const bySurah = new Map(
          surahs.map((verses, index) => [index + 1, verses.map((verse) => verse.text)] as const),
        );
        const textOf = ({ surah, verse }: VerseRef): string => {
          const text = bySurah.get(surah)?.[verse - 1];
          if (text === undefined) throw new RangeError(`No verse ${surah}:${verse}`);
          return text;
        };
        if (isCurrent) setState({ script, value: { status: 'ready', script, textOf } });
      },
      (error: unknown) => {
        console.error(`The ${script} text cannot be shown.`, error);
        if (isCurrent) setState({ script, value: { status: 'error' } });
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [repository, script]);
  // A new script shows its own loading state, never the text of the other one.
  return state.script === script ? state.value : LOADING;
}
