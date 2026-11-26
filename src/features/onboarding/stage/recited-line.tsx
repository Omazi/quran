import { useMemo, useRef } from 'react';
import { StyleSheet, Text, View, type ColorValue, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import type { MushafPage } from '@/domain/quran';
import { verseMarkText } from '@/features/listening/passage-words';
import { fontFamily, useColors, useColorValues, voiceStoryLayout as L } from '@/ui';

import { STORY_MOTION } from '../config';
import { recitedLines, surahWords, type RecitedLine } from '../recitation';
import {
  introArrival,
  litWords,
  pageValue,
  smooth,
  verseLineLook,
  verseWordOpacity,
  versePillLook,
} from '../story-math';
import type { StageProps } from './stage-props';

/**
 * Al-Fatiha under the garden (`.fline`): one verse at a time, its words lighting one by one as the
 * finger brings the garden up through its five growing pages, a gold pill on the word the voice is
 * on. The words are page 1 of the mushaf as the data layer gives them, in the Quran's own font
 * (KFGQPC Hafs, the one the text was published for); nothing is typed or changed. After the
 * revival the line rises away. Decorative: the pages say what it shows.
 */
export function RecitedVerse({ fatiha, ...stage }: StageProps & { fatiha: MushafPage | null }) {
  const { position, engine, layout, pages, marks, reducedMotion } = stage;
  const lines = useMemo(() => (fatiha === null ? [] : recitedLines(fatiha)), [fatiha]);
  const total = useMemo(() => (fatiha === null ? 0 : surahWords(fatiha).length), [fatiha]);
  const voices = useMemo(() => pages.map((page) => page.voice), [pages]);
  const whole = useAnimatedStyle(() => {
    const pos = position.get();
    const after = pos - marks.revival;
    const leaving = after <= 0 ? 1 : 1 - smooth(after * STORY_MOTION.presenceRate);
    // Arrives 160 ms after the first frame, rising 10 points (motion spec §2).
    const arrival = introArrival(
      engine.introMs.get(),
      STORY_MOTION.introLineDelayMs,
      reducedMotion,
    );
    const leave = after > 0 && !reducedMotion ? -after * STORY_MOTION.lineLeaveTravel : 0;
    return {
      opacity: leaving * arrival,
      transform: [{ translateY: leave + (1 - arrival) * L.introLineRise }],
    };
  });
  if (lines.length === 0) return null;
  return (
    <Animated.View
      style={[styles.line, { top: layout.verseTop }, whole]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="onboarding-recited-line"
    >
      {lines.map((line, index) => (
        <VerseLine
          key={line.start}
          line={line}
          isFirst={index === 0}
          isLast={index === lines.length - 1}
          total={total}
          position={position}
          voices={voices}
          reducedMotion={reducedMotion}
        />
      ))}
    </Animated.View>
  );
}

interface VerseLineProps {
  readonly line: RecitedLine;
  readonly isFirst: boolean;
  readonly isLast: boolean;
  readonly total: number;
  readonly position: SharedValue<number>;
  readonly voices: readonly number[];
  readonly reducedMotion: boolean;
}

function VerseLine({
  line,
  isFirst,
  isLast,
  total,
  position,
  voices,
  reducedMotion,
}: VerseLineProps) {
  const colors = useColors();
  const values = useColorValues();
  const boxes = useSharedValue<(readonly [number, number])[]>([]);
  const measured = useRef<(readonly [number, number])[]>([]);
  const onWordLayout = (index: number) => (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    measured.current[index] = [x, width];
    if (measured.current.filter(Boolean).length === line.words.length)
      boxes.set([...measured.current]);
  };
  const look = useAnimatedStyle(() => {
    const lit = litWords(position.get(), total);
    const shown = verseLineLook(lit, line.start, line.words.length, isFirst, isLast, reducedMotion);
    return { opacity: shown.opacity, transform: [{ translateY: shown.translateY }] };
  });
  const pill = useAnimatedStyle(() => {
    const pos = position.get();
    const shape = versePillLook(
      litWords(pos, total),
      line.start,
      boxes.get(),
      pageValue(voices, pos),
      L.versePillPad,
    );
    return {
      opacity: shape.opacity,
      transform: [{ translateX: shape.x }, { scaleX: shape.width / L.pillBaseWidth }],
    };
  });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.verse, look]}>
      <View style={styles.row}>
        <Animated.View style={[styles.pill, { backgroundColor: values.versePill }, pill]} />
        {line.words.map((word, k) => (
          <Word
            key={k}
            text={word}
            index={line.start + k}
            total={total}
            position={position}
            voices={voices}
            color={colors.heading}
            onLayout={onWordLayout(k)}
          />
        ))}
        {line.endsVerse ? (
          <Text style={[styles.text, styles.mark, { color: colors.ornament }]}>
            {verseMarkText(line.verse)}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

function Word({
  text,
  index,
  total,
  position,
  voices,
  color,
  onLayout,
}: {
  text: string;
  index: number;
  total: number;
  position: SharedValue<number>;
  voices: readonly number[];
  color: ColorValue;
  onLayout: (event: LayoutChangeEvent) => void;
}) {
  const style = useAnimatedStyle(() => {
    const pos = position.get();
    return { opacity: verseWordOpacity(litWords(pos, total), index, pageValue(voices, pos)) };
  });
  return (
    <Animated.Text
      onLayout={onLayout}
      accessibilityLanguage="ar"
      style={[styles.text, { color }, style]}
    >
      {text}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  line: { position: 'absolute', left: 0, right: 0, height: L.verseLineHeight },
  verse: { alignItems: 'center' },
  // A verse reads right to left in every interface.
  row: {
    flexDirection: 'row',
    direction: 'rtl',
    alignItems: 'center',
    gap: L.verseTextSize * L.verseWordGapEm,
    height: L.verseLineHeight,
  },
  text: {
    fontFamily: fontFamily.quran,
    fontSize: L.verseTextSize,
    lineHeight: L.verseLineHeight,
  },
  mark: { fontSize: L.verseMarkSize },
  pill: {
    position: 'absolute',
    left: 0,
    top: (L.verseLineHeight - L.versePillHeight) / 2,
    width: L.pillBaseWidth,
    height: L.versePillHeight,
    borderRadius: L.versePillRadius,
    transformOrigin: 'left',
  },
});
