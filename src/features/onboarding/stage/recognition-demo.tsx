import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { Rosette } from '@/features/listening/rosette/rosette';
import {
  AppText,
  Icon,
  fontFamily,
  radius,
  textStyles,
  useColorValues,
  voiceStoryLayout as L,
  voiceStoryDetails as D,
  voiceStoryShadows,
} from '@/ui';

import { STORY_MOTION } from '../config';
import { easeOut, mix, presence } from '../story-math';
import { useDemoVoice } from '../use-demo-voice';
import { useSamplePassage } from '../use-sample-passage';
import { isNear, type StageProps } from './stage-props';

/**
 * The listening page (page 12 of the prototype): the app's own listening rosette (D27, D29, its
 * night values on the dusk sky) listens to a simulated voice for 2.7 s, then the card "Passage
 * reconnu" rises under it (Al-Kahf 18:10, the validated mockup's passage, its text from the data
 * layer) while the rosette shrinks above it; the loop starts again every 9 s. With "reduce
 * motion" the card is shown at once and the rosette is still.
 */
export function RecognitionDemo(stage: StageProps) {
  const { position, engine, layout, marks, pageIndex, reducedMotion } = stage;
  const { t } = useTranslation('onboarding');
  const light = useColorValues('light');
  const passage = useSamplePassage(true);
  const isHere = pageIndex === marks.recognition;
  const subscribe = useDemoVoice(isHere && !reducedMotion);
  const [cardHeight, setCardHeight] = useState(0);
  const m = STORY_MOTION;
  const cardTop = layout.copyTop - L.foundAboveCopy - cardHeight;
  const foundY = Math.max(
    layout.top + L.rosetteMinTop,
    cardTop - L.rosetteAboveCard - layout.rosetteRadius * L.rosetteFoundScale * L.rosetteFoundRoom,
  );
  const found = (ms: number) => {
    'worklet';
    if (reducedMotion) return 1;
    if (ms < 0) return 0;
    const listen = m.recognitionListenMs;
    if (ms < listen) return 0;
    if (ms < listen + m.recognitionCardMs) return easeOut((ms - listen) / m.recognitionCardMs);
    if (ms < m.recognitionLeaveAtMs) return 1;
    return 1 - easeOut((ms - m.recognitionLeaveAtMs) / m.recognitionLeaveMs);
  };
  const rosette = useAnimatedStyle(() => {
    const d = position.get() - marks.recognition;
    const shown = presence(position.get(), marks.recognition);
    const f = found(engine.recognitionMs.get());
    const y = mix(layout.rosetteY, foundY, f) - (reducedMotion ? 0 : d * m.rosetteTravel);
    const scale = mix(1, L.rosetteFoundScale, f) * (reducedMotion ? 1 : 0.86 + 0.14 * shown);
    return { opacity: shown, transform: [{ translateY: y - layout.rosetteY }, { scale }] };
  });
  const label = useAnimatedStyle(() => {
    const d = position.get() - marks.recognition;
    const f = found(engine.recognitionMs.get());
    return {
      opacity: presence(position.get(), marks.recognition) * (1 - f),
      transform: [{ translateY: reducedMotion ? 0 : -d * m.labelTravel - f * m.labelLift }],
    };
  });
  const card = useAnimatedStyle(() => {
    const d = position.get() - marks.recognition;
    const f = found(engine.recognitionMs.get());
    return {
      opacity: cardHeight === 0 ? 0 : presence(position.get(), marks.recognition) * f,
      transform: reducedMotion
        ? []
        : [
            { translateY: (1 - f) * L.foundRise - d * m.rosetteTravel },
            { scale: m.cardScaleFrom + (1 - m.cardScaleFrom) * f },
          ],
    };
  });
  if (!isNear(pageIndex, marks.recognition)) return null;
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transformOrigin: [layout.width / 2, layout.rosetteY, 0] },
          rosette,
        ]}
      >
        <Rosette
          width={layout.width}
          height={layout.height}
          subscribeToLevel={subscribe}
          reducedMotion={reducedMotion}
          appearance="dark"
          frame={{ cx: layout.width / 2, cy: layout.rosetteY, radius: layout.rosetteRadius }}
          testID="onboarding-rosette"
        />
      </Animated.View>
      <Animated.View style={[styles.label, { top: layout.listenLabelTop }, label]}>
        <AppText variant="title1" color="onAction" align="center">
          {t('recognition.listening')}
        </AppText>
      </Animated.View>
      <Animated.View
        style={[styles.card, { top: cardTop, backgroundColor: light.surfaceInset }, card]}
        onLayout={(event: LayoutChangeEvent) => setCardHeight(event.nativeEvent.layout.height)}
        testID="onboarding-found-card"
      >
        <View style={styles.cardTop}>
          <Text style={[textStyles.footnote, styles.bold, { color: light.action }]}>
            {t('recognition.found')}
          </Text>
          <View style={[styles.pagePill, { backgroundColor: light.actionTonal }]}>
            <Text style={[textStyles.footnote, styles.bold, { color: light.action }]}>
              {t('recognition.page', { page: passage.page })}
            </Text>
          </View>
        </View>
        <Text style={[textStyles.title3, { color: light.heading }]}>
          {t('recognition.where', { surah: passage.surahName, verse: passage.verse })}
        </Text>
        {passage.text === null ? null : (
          <View style={[styles.verse, { backgroundColor: light.foundVerseBack }]}>
            <Text style={[styles.verseText, { color: light.ink }]} accessibilityLanguage="ar">
              {passage.text}
            </Text>
          </View>
        )}
        <View style={styles.actions}>
          <View style={[styles.open, { backgroundColor: light.action }]}>
            <Text style={[textStyles.headline, { color: light.onAction }]}>
              {t('recognition.open')}
            </Text>
          </View>
          <View style={[styles.listen, { backgroundColor: light.actionTonal }]}>
            <Icon
              symbol={{ ios: 'headphones', android: 'headphones' }}
              tint={light.action}
              textStyle="title3"
            />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { position: 'absolute', start: 0, end: 0 },
  card: {
    position: 'absolute',
    start: L.foundInset,
    end: L.foundInset,
    borderRadius: L.foundRadius,
    padding: L.foundPadding,
    gap: D.hairGap,
    boxShadow: voiceStoryShadows.found,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bold: { fontWeight: '600' },
  pagePill: {
    paddingHorizontal: D.pagePillPaddingH,
    paddingVertical: D.pagePillPaddingV,
    borderRadius: radius.md,
  },
  verse: {
    marginTop: D.verseTop,
    paddingHorizontal: D.versePaddingH,
    paddingVertical: D.versePaddingV,
    borderRadius: radius.lg,
  },
  verseText: {
    fontFamily: fontFamily.quran,
    fontSize: L.foundVerseSize,
    lineHeight: L.foundVerseSize * L.foundVerseLineEm,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  actions: { flexDirection: 'row', gap: D.actionsGap, marginTop: D.actionsTop },
  open: {
    flex: 1,
    height: L.foundButtonHeight,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listen: {
    width: L.foundButtonHeight,
    height: L.foundButtonHeight,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
