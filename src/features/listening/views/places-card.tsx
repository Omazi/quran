import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { splitVerseWords, WORD_SEPARATOR } from '@/domain/quran';
import { useQuranFont } from '@/features/reader';
import {
  layout,
  listeningShape,
  spacing,
  stateOpacity,
  useListeningColors,
  type IconSymbol,
} from '@/ui';

import { RESULT_TEXT } from '../config';
import type { PassageWords } from '../passage-words';
import { CardPill, CardText, CardVerse, ResultCard } from '../scene/result-card';
import { SceneSymbol } from '../scene/scene-symbol';
import { SceneText } from '../scene/scene-text';
import { useVerseTexts, type LoadVerseText } from '../use-verse-texts';

const DISCLOSURE_SYMBOL: IconSymbol = { ios: 'chevron.forward', android: 'chevron_right' };

export interface PlacesCardProps {
  /** Every tied place, in the order of the mushaf. */
  readonly passages: readonly PassageWords[];
  /** How many places the search counted: more than are listed when the list was cut. */
  readonly totalCount: number;
  readonly isComplete: boolean;
  readonly loadVerseText: LoadVerseText;
  readonly onOpenPage: (page: number) => void;
}

/**
 * "Several passages": the search never chooses at random (specs/recognition.md), so the card
 * lists the places and lets the person choose. Each row begins with the opening words of its
 * verse in the Quran's script, which tell the places apart (the words heard are the same in all
 * of them), then names the place, with its page in the pill of the found card. Choosing a row is
 * the next step, so the card has no prominent button (buttons.md › Style).
 */
export function PlacesCard({
  passages,
  totalCount,
  isComplete,
  loadVerseText,
  onOpenPage,
}: PlacesCardProps) {
  const { t } = useTranslation('listening');
  const colors = useListeningColors();
  const verses = useMemo(() => passages.map((passage) => passage.firstVerse), [passages]);
  const texts = useVerseTexts(verses, loadVerseText);
  const isFontReady = useQuranFont() === 'ready';

  return (
    <ResultCard label={t('several.title')} title={t('several.choose')} testID="listening-several">
      <CardText>{t('several.description', { count: totalCount })}</CardText>
      <View>
        {passages.map((passage, index) => (
          <View key={`${index}:${passage.firstVerse.surah}:${passage.firstVerse.verse}`}>
            {index === 0 ? null : (
              <View style={[styles.separator, { backgroundColor: colors.cardSeparator }]} />
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
        <CardText>
          {t('several.incomplete', { shown: passages.length, count: totalCount })}
        </CardText>
      )}
    </ResultCard>
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
 * One place: the opening words on the paper of the mushaf, as the found card shows its verse,
 * then the place and its page. The whole row is one button for screen readers, which hear where it leads; a
 * pressed state (buttons.md › Best practices) and a 44-point target; it ends with the disclosure
 * chevron of rows that lead somewhere (lists-and-tables.md › Mobile), which turns in Arabic.
 */
function PlaceRow({ passage, openingWords, onPress }: PlaceRowProps) {
  const { t } = useTranslation('listening');
  const colors = useListeningColors();
  const page = t('page', { page: passage.page });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${passage.place}, ${page}`}
      accessibilityHint={t('several.rowHint', { page: passage.page })}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: stateOpacity.pressed }]}
      testID={`listening-place-${passage.firstVerse.surah}-${passage.firstVerse.verse}`}
    >
      {openingWords === null ? null : <CardVerse runs={[{ text: openingWords }]} />}
      <View style={styles.rowPlace}>
        <SceneText variant="subhead" color={colors.cardTitle} style={styles.placeName}>
          {passage.place}
        </SceneText>
        <CardPill label={page} />
        <SceneSymbol
          symbol={DISCLOSURE_SYMBOL}
          size={listeningShape.buttonSymbol - spacing.xs}
          color={colors.cardSecondary}
          isDirectional
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: layout.touchTarget,
    paddingVertical: spacing.md - spacing.xs,
    gap: spacing.sm,
  },
  rowPlace: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  placeName: { flex: 1 },
  separator: { height: StyleSheet.hairlineWidth },
});
