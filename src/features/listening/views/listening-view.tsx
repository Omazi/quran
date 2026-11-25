import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ListeningPhase, Unsubscribe } from '@/domain/listening';
import { AppText, Button, layout, Screen, spacing } from '@/ui';

import { HEARD_WORDS, LISTENING_LAYOUT } from '../config';
import { Rosette } from '../rosette/rosette';

/** What the screen says: `preparing` before the microphone is open (the model loading). */
export type ListeningViewPhase = 'preparing' | ListeningPhase;

export interface ListeningViewProps {
  readonly subscribeToLevel: (listener: (level: number) => void) => Unsubscribe;
  readonly phase: ListeningViewPhase;
  /** The words heard so far, final and not final yet, shown faintly under the title. */
  readonly heardWords: readonly string[];
  readonly onStop: () => void;
  readonly reducedMotion: boolean;
}

const TITLE_KEY: Readonly<Record<ListeningViewPhase, string>> = {
  preparing: 'listening.preparing',
  listening: 'listening.title',
  hearing: 'listening.hearing',
  searching: 'listening.searching',
};

/**
 * "Listening" (validated, D27 and D29): the whole screen listens. The rosette in the upper part,
 * the title below it, one button at the bottom. On the paper of the mushaf, light or dark as the
 * phone is (deviation 27).
 *
 * So the person always knows the phone hears them (owner, after the first test on an iPhone,
 * deviation 123): the rosette is dim until the microphone is open, then swells with the voice;
 * the title says what happens ("J'écoute…", "Je t'entends", "Je cherche le passage…"); the words
 * heard appear under it, faint, as they come.
 */
export function ListeningView({
  subscribeToLevel,
  phase,
  heardWords,
  onStop,
  reducedMotion,
}: ListeningViewProps) {
  const { t } = useTranslation('listening');
  // The screen fills the window: its size is known before the first layout, so the first frame
  // is already drawn. The layout then gives the exact size.
  const window = useWindowDimensions();
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);
  const size = measured ?? window;
  const onLayout = ({ nativeEvent }: LayoutChangeEvent) =>
    setMeasured({ width: nativeEvent.layout.width, height: nativeEvent.layout.height });
  const shownWords = heardWords.slice(-HEARD_WORDS.shown).join(' ');

  return (
    // The prototype measures the drawing on the whole screen, safe areas included: no edge here,
    // the button alone keeps clear of the home indicator.
    <Screen background="paper" edges={[]} testID="listening">
      <View style={styles.stage} onLayout={onLayout}>
        <Rosette
          width={size.width}
          height={size.height}
          subscribeToLevel={subscribeToLevel}
          reducedMotion={reducedMotion}
          isLive={phase !== 'preparing'}
          testID="rosette"
        />
        <View style={[styles.title, { top: size.height * LISTENING_LAYOUT.titleTop }]}>
          <AppText variant="displayTitle" color="ink" align="center" testID="listening-title">
            {t(TITLE_KEY[phase])}
          </AppText>
          {shownWords === '' ? null : (
            // A new line of words fades in; the previous one is replaced, not moved.
            <Animated.View key={shownWords} entering={FadeIn.duration(HEARD_WORDS.fadeInMs)}>
              <AppText
                variant="body"
                color="inkSecondary"
                align="center"
                numberOfLines={2}
                accessibilityLanguage="ar"
                style={styles.heard}
                testID="listening-heard"
              >
                {shownWords}
              </AppText>
            </Animated.View>
          )}
        </View>
        {/* The bottom inset (34 points on an iPhone without a home button, where the prototype
            puts the button), or a margin where there is none. */}
        <SafeAreaView edges={{ bottom: 'maximum' }} style={styles.action}>
          <Button
            label={t('listening.stop')}
            variant="secondary"
            onPress={onStop}
            testID="listening-stop"
          />
        </SafeAreaView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1 },
  title: {
    position: 'absolute',
    start: layout.screenMargin,
    end: layout.screenMargin,
    rowGap: spacing.sm,
  },
  heard: { writingDirection: 'rtl', opacity: 0.8 },
  action: {
    position: 'absolute',
    bottom: 0,
    start: 0,
    end: 0,
    alignItems: 'center',
    paddingBottom: spacing.md,
  },
});
