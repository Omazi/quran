import { StyleSheet, View } from 'react-native';

import { useGenderedTranslation } from '@/features/gender';
import { useQuranFont } from '@/features/reader';
import { AppText, Button, layout, QuranText, spacing, useColors, type QuranTextRun } from '@/ui';

import { verseMarkText, type PassageWords } from '../passage-words';
import { useVerseTexts, type LoadVerseText } from '../use-verse-texts';
import { ResultActions, ResultLayout } from './result-layout';

export interface FoundViewProps {
  readonly passage: PassageWords;
  readonly loadVerseText: LoadVerseText;
  readonly onOpenPage: (page: number) => void;
  readonly onListenAgain: () => void;
  readonly onClose: () => void;
}

/**
 * "Passage found": the result is the screen. Under the still rosette, the surah's name in the
 * script of the Quran and in the language of the interface, where in the surah, then the verses
 * themselves as the reader draws them. One prominent button opens the reader at that page, the
 * most likely next step (buttons.md › Style); listening again and closing are plain.
 */
export function FoundView({
  passage,
  loadVerseText,
  onOpenPage,
  onListenAgain,
  onClose,
}: FoundViewProps) {
  const { t, i18n } = useGenderedTranslation('listening');
  const colors = useColors();
  const texts = useVerseTexts(passage.shownVerses, loadVerseText);
  const isFontReady = useQuranFont() === 'ready';
  // In Arabic the interface's name is the Arabic one: it is said once, in the Quran's script.
  const isArabic = i18n.language === 'ar';
  const runs: QuranTextRun[] | null =
    texts === null || texts.length !== passage.shownVerses.length
      ? null
      : passage.shownVerses.flatMap((verse, index) => [
          { text: texts[index] ?? '' },
          { text: verseMarkText(verse.verse), isVerseMark: true },
        ]);

  return (
    <ResultLayout
      testID="listening-found"
      actions={
        <ResultActions
          primary={
            <Button
              label={t('found.open', { page: passage.page })}
              variant="primary"
              onPress={() => onOpenPage(passage.page)}
              testID="listening-open-page"
            />
          }
          plain={
            <>
              <Button label={t('actions.listenAgain')} variant="plain" onPress={onListenAgain} />
              <Button label={t('actions.close')} variant="plain" onPress={onClose} />
            </>
          }
        />
      }
    >
      <View style={styles.heading}>
        <QuranText
          runs={[{ text: t('surahArabic', { name: passage.surahArabic }) }]}
          variant="surahName"
          isHeading={isArabic}
          testID="listening-surah-arabic"
        />
        {isArabic ? null : (
          <AppText variant="displayTitle" color="ink" align="center">
            {passage.surah}
          </AppText>
        )}
        <AppText variant="subhead" color="inkSecondary" align="center">
          {t('found.where', { verses: passage.verses, page: passage.page })}
        </AppText>
      </View>
      {
        // The verses only in the Quran font, never in another one (D19).
        runs === null || !isFontReady ? null : (
          <View style={styles.verses} testID="listening-verses">
            <View style={[styles.rule, { backgroundColor: colors.ornamentLine }]} />
            <QuranText runs={runs} variant="verse" />
            {passage.continues ? (
              <AppText variant="footnote" color="inkSecondary" align="center">
                {t('found.continues')}
              </AppText>
            ) : null}
            <View style={[styles.rule, { backgroundColor: colors.ornamentLine }]} />
          </View>
        )
      }
    </ResultLayout>
  );
}

const styles = StyleSheet.create({
  heading: { gap: spacing.xs },
  verses: { gap: spacing.md, alignItems: 'stretch' },
  // A thin rule of the mushaf's ornament gold above and below the verses: an ornament line,
  // which carries no information (charter, `ornamentLine`).
  rule: {
    alignSelf: 'center',
    width: spacing.xxl * 2,
    height: layout.outlineWidth,
  },
});
