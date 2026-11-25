import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { SpeechEngine } from '@/domain/listening';
import type { MushafPage, QuranStructure, VerseRef } from '@/domain/quran';
import { useQuranFont } from '@/features/reader';
import {
  AppText,
  ProgressIndicator,
  layout,
  listeningShape,
  spacing,
  useColorValues,
  useReducedMotion,
} from '@/ui';

import { BACK_SYMBOL, RoundButton } from './round-button';
import { FollowBar } from './follow-bar';
import { FollowPage } from './follow-page';
import { useVoiceFollow } from './use-voice-follow';

export interface VoiceFollowScreenProps {
  readonly engine: SpeechEngine;
  readonly page: number;
  readonly from?: VerseRef;
  readonly structure: Pick<QuranStructure, 'surah'>;
  readonly loadPage: (page: number) => Promise<MushafPage>;
  readonly onClose: () => void;
}

/** The surah's name as the data gives it, with a typographic apostrophe outside Arabic. */
function surahName(
  structure: VoiceFollowScreenProps['structure'],
  surah: number,
  language: string,
) {
  const info = structure.surah(surah);
  return language === 'ar' ? info.nameArabic : info.nameTransliterated.replace(/'/g, '’');
}

/**
 * Reading aloud with the voice followed (docs/design/voix.png): the bar of the reader above
 * (back, the surah, the juz and the page), the page of the mushaf as printed, the words marked as
 * the voice goes, and the listening bar floating at the bottom.
 *
 * Trial only, like the recognition screen: the real speech engine (D5) is not in this lot, and
 * the reader itself is another feature; this screen draws the page from the data layer so that
 * the following can be tried and seen (docs/specs/listening.md).
 */
export function VoiceFollowScreen({
  engine,
  page,
  from,
  structure,
  loadPage,
  onClose,
}: VoiceFollowScreenProps) {
  const { t, i18n } = useTranslation('listening');
  const colors = useColorValues();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const isFontReady = useQuranFont() === 'ready';
  const model = useVoiceFollow({ engine, pageNumber: page, from, loadPage, onStopped: onClose });
  const [pageWidth, setPageWidth] = useState(0);
  const onLayout = ({ nativeEvent }: LayoutChangeEvent) => setPageWidth(nativeEvent.layout.width);

  const firstWord = model.lines[0]?.words[0]?.word;
  const surah = from?.surah ?? Number(firstWord?.verseKey.split(':')[0] ?? 1);

  // VoiceOver hears the word to read again when it changes (voiceover.md › Navigation).
  useEffect(() => {
    if (model.rereadWord !== null) {
      AccessibilityInfo.announceForAccessibility(
        t('follow.rereadLabel', { word: model.rereadWord }),
      );
    }
  }, [model.rereadWord, t]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.pageGround }]} testID="voice-follow">
      <StatusBar style="auto" />
      <View style={[styles.bar, { paddingTop: insets.top + spacing.xs }]}>
        <RoundButton
          symbol={BACK_SYMBOL}
          accessibilityLabel={t('actions.back')}
          onPress={model.stop}
          background={colors.surface}
          foreground={colors.heading}
          isDirectional
          isRaised
          testID="follow-back"
        />
        <View style={styles.titles}>
          <AppText variant="headline" color="ink" align="center" accessibilityRole="header">
            {surahName(structure, surah, i18n.language)}
          </AppText>
          {model.page === null ? null : (
            <AppText variant="footnote" color="inkSecondary" align="center">
              {t('follow.where', { juz: model.page.juz, page: model.page.page })}
            </AppText>
          )}
        </View>
        {/* The same width as the back button, so the title stays centred. */}
        <View style={styles.side} />
      </View>
      <View
        style={[
          styles.pageArea,
          {
            paddingBottom:
              Math.max(insets.bottom, spacing.md) + listeningShape.followBarHeight + spacing.md,
          },
        ]}
        onLayout={onLayout}
      >
        {model.page === null || !isFontReady ? (
          <ProgressIndicator accessibilityLabel={t('follow.following')} />
        ) : (
          <FollowPage
            lines={model.lines}
            follow={model.follow}
            startIndex={model.startIndex}
            width={pageWidth}
            testID="follow-page"
          />
        )}
      </View>
      <View style={[styles.floating, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <FollowBar
          subscribeToLevel={model.status === 'following' ? engine.onLevel : null}
          reducedMotion={reducedMotion}
          rereadWord={model.rereadWord}
          onStop={model.stop}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.screenMargin - spacing.xs,
    paddingBottom: spacing.sm,
  },
  titles: { flex: 1 },
  side: { width: listeningShape.sceneButtonHit },
  pageArea: { flex: 1, paddingHorizontal: spacing.md - spacing.xs, justifyContent: 'center' },
  floating: {
    position: 'absolute',
    start: layout.screenMargin,
    end: layout.screenMargin,
    bottom: 0,
  },
});
