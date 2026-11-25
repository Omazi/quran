import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { splitVerseWords, WORD_SEPARATOR } from '@/domain/quran';
import { useQuranFont } from '@/features/reader';
import {
  AppText,
  Button,
  Icon,
  layout,
  QuranText,
  spacing,
  stateOpacity,
  useColors,
  type IconSymbol,
} from '@/ui';

import { RESULT_TEXT } from '../config';
import type { PassageWords } from '../passage-words';
import { useVerseTexts, type LoadVerseText } from '../use-verse-texts';
import { ResultActions, ResultLayout } from './result-layout';

const DISCLOSURE_SYMBOL: IconSymbol = { ios: 'chevron.forward', android: 'chevron_right' };

export interface PassagesViewProps {
  /** Every tied place, in the order of the mushaf. */
  readonly passages: readonly PassageWords[];
  /** How many places the search counted: more than are listed when the list was cut. */
  readonly totalCount: number;
  readonly isComplete: boolean;
  readonly loadVerseText: LoadVerseText;
  readonly onOpenPage: (page: number) => void;
  readonly onListenAgain: () => void;
  readonly onClose: () => void;
}

/**
 * "Several passages": the search never chooses at random (specs/recognition.md), so the screen
 * shows the places and lets the person choose. The same world as the listening: the still
 * rosette, the display title, then one row per place that opens the reader at its page. Each row
 * begins with the opening words of its verse in the Quran's script, which is what tells the
 * places apart (the words heard are the same in all of them), then names it.
 *
 * Choosing a row is the next step, so there is no prominent button: listening again and closing
 * are plain (buttons.md › Style).
 */
export function PassagesView({
  passages,
  totalCount,
  isComplete,
  loadVerseText,
  onOpenPage,
  onListenAgain,
  onClose,
}: PassagesViewProps) {
  const { t } = useTranslation('listening');
  const colors = useColors();
  const verses = useMemo(() => passages.map((passage) => passage.firstVerse), [passages]);
  const texts = useVerseTexts(verses, loadVerseText);
  const isFontReady = useQuranFont() === 'ready';

  return (
    <ResultLayout
      testID="listening-several"
      actions={
        <ResultActions
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
        <AppText variant="displayTitle" color="ink" align="center">
          {t('several.title')}
        </AppText>
        <AppText color="secondaryLabel" align="center">
          {t('several.description', { count: totalCount })}
        </AppText>
      </View>
      <View>
        {passages.map((passage, index) => (
          <View key={`${index}:${passage.firstVerse.surah}:${passage.firstVerse.verse}`}>
            {index === 0 ? null : (
              <View style={[styles.separator, { backgroundColor: colors.separator }]} />
            )}
            <PlaceRow
              passage={passage}
              openingWords={openingWordsAt(texts, index, isFontReady)}
              onPress={() => onOpenPage(passage.page)}
            />
          </View>
        ))}
      </View>
      {isComplete ? null : (
        <AppText variant="footnote" color="secondaryLabel" align="center">
          {t('several.incomplete', { shown: passages.length, count: totalCount })}
        </AppText>
      )}
    </ResultLayout>
  );
}

/** The opening words of the place at `index`, once its text is read and the font is there. */
function openingWordsAt(
  texts: readonly string[] | null,
  index: number,
  isFontReady: boolean,
): string | null {
  const text = texts?.[index];
  return text === undefined || !isFontReady ? null : openingWordsOf(text);
}

/**
 * The first words of a verse, whole words as the data separates them, nothing added: no ellipsis
 * is written into Quran text.
 */
function openingWordsOf(text: string): string {
  return splitVerseWords(text).slice(0, RESULT_TEXT.openingWords).join(WORD_SEPARATOR);
}

interface PlaceRowProps {
  readonly passage: PassageWords;
  /** Null until the text is read, or when the Quran font is missing: the row then names only. */
  readonly openingWords: string | null;
  readonly onPress: () => void;
}

/**
 * One place: the opening words of its verse, then the surah, the verse and the page. The whole
 * row is one button for screen readers, which hear where it leads. A row of the system list
 * cannot hold Quran text in its font, so the row is drawn here, with a pressed state
 * (buttons.md › Best practices) and a 44-point target; on iOS it ends with the disclosure
 * chevron of the system's rows that lead somewhere (lists-and-tables.md › Mobile), which the
 * other platforms do not use.
 */
function PlaceRow({ passage, openingWords, onPress }: PlaceRowProps) {
  const { t } = useTranslation('listening');
  const where = t('several.rowValue', { verse: passage.firstVerse.verse, page: passage.page });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${passage.surah}, ${where}`}
      accessibilityHint={t('several.rowHint', { page: passage.page })}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      testID={`listening-place-${passage.firstVerse.surah}-${passage.firstVerse.verse}`}
    >
      <View style={styles.rowWords}>
        {openingWords === null ? null : (
          <QuranText runs={[{ text: openingWords }]} variant="openingWords" align="start" />
        )}
        <AppText variant="subhead" color="secondaryLabel">
          {`${passage.surah} · ${where}`}
        </AppText>
      </View>
      {Platform.OS === 'ios' ? (
        <Icon symbol={DISCLOSURE_SYMBOL} textStyle="footnote" color="tertiaryLabel" />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heading: { gap: spacing.sm },
  row: {
    minHeight: layout.touchTarget,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowWords: { flex: 1, gap: spacing.xs },
  pressed: { opacity: stateOpacity.pressed },
  separator: { height: StyleSheet.hairlineWidth },
});
