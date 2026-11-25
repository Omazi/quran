import { useTranslation } from 'react-i18next';

import { useQuranFont } from '@/features/reader';
import type { QuranTextRun } from '@/ui';

import { verseMarkText, type PassageWords } from '../passage-words';
import { CardButton, CardText, CardVerse, ResultCard } from '../scene/result-card';
import { useVerseTexts, type LoadVerseText } from '../use-verse-texts';

export interface FoundCardProps {
  readonly passage: PassageWords;
  readonly loadVerseText: LoadVerseText;
  readonly onOpenPage: (page: number) => void;
}

/**
 * "Passage reconnu" (shazam.png): the card says where the passage is ("Al-Kahf, verset 10"),
 * the page in its pill, the verses themselves on the paper of the mushaf, and one button that
 * opens the reader at that page, the most likely next step (buttons.md › Style). Listening
 * again is the microphone above.
 */
export function FoundCard({ passage, loadVerseText, onOpenPage }: FoundCardProps) {
  const { t } = useTranslation('listening');
  const texts = useVerseTexts(passage.shownVerses, loadVerseText);
  const isFontReady = useQuranFont() === 'ready';
  const runs: QuranTextRun[] | null =
    texts === null || texts.length !== passage.shownVerses.length
      ? null
      : passage.shownVerses.flatMap((verse, index) => [
          { text: texts[index] ?? '' },
          { text: verseMarkText(verse.verse), isVerseMark: true },
        ]);

  return (
    <ResultCard
      label={t('found.label')}
      title={passage.place}
      pill={t('page', { page: passage.page })}
      testID="listening-found"
      actions={
        <CardButton
          label={t('found.open')}
          accessibilityHint={t('found.openHint', { page: passage.page })}
          onPress={() => onOpenPage(passage.page)}
          testID="listening-open-page"
        />
      }
    >
      {
        // The verses only in the Quran font, never in another one (D19).
        runs === null || !isFontReady ? null : <CardVerse runs={runs} testID="listening-verses" />
      }
      {passage.continues ? <CardText>{t('found.continues')}</CardText> : null}
    </ResultCard>
  );
}
