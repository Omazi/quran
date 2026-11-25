import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import {
  AppText,
  Icon,
  emphasisWeight,
  getWritingDirection,
  layout,
  readerShapes,
  spacing,
  stateOpacity,
  useReaderPalette,
  useReducedMotion,
  type IconSymbol,
} from '@/ui';

import { READER_CONFIG } from './config';
import { surahDisplayName } from './surah-name';
import type { ReaderModel } from './use-reader';

const BACK_SYMBOL: IconSymbol = { ios: 'chevron.backward', android: 'arrow_back_ios_new' };
const BOOKMARK_SYMBOL: IconSymbol = { ios: 'bookmark', android: 'bookmark_border' };
const BOOKMARK_FILLED_SYMBOL: IconSymbol = { ios: 'bookmark.fill', android: 'bookmark' };
const MICROPHONE_SYMBOL: IconSymbol = { ios: 'mic.fill', android: 'mic' };
const WATER_SYMBOL: IconSymbol = { ios: 'drop.fill', android: 'water_drop' };
/** The bottom bar keeps the home indicator clear by itself. */
const BOTTOM_EDGE = ['bottom'] as const;
const { roundButton, shadowOpacity, shadowRadius, shadowOffsetY } = readerShapes;
/** What the round button adds around its drawn circle to reach the touch target. */
const ROUND_BUTTON_SLOP = Math.max(0, (layout.touchTarget - roundButton) / 2);

interface RoundButtonProps {
  symbol: IconSymbol;
  label: string;
  onPress: () => void;
  /** For a button that is on or off: VoiceOver says which (accessibility.md › VoiceOver). */
  isSelected?: boolean;
  /** Mirrors the symbol in Arabic outside iOS: only for symbols of reading order. */
  followsReadingOrder?: boolean;
  symbolTestID?: string;
  testID: string;
}

/**
 * A round white button of the mockup's bar (docs/design/mushaf.png): a 40-point circle with an SF
 * Symbol, touched on 44 points (buttons.md › Best practices: a hit region of at least 44 × 44,
 * and a press state for a custom button). The symbol says what it does and VoiceOver hears its
 * label (toolbars.md › Actions: simple, recognizable symbols). The symbols of reading order
 * (back, a list of lines) take their right-to-left form in Arabic (right-to-left.md › Controls,
 * › Interface icons): SF Symbols does it on iOS, Material Symbols are mirrored here.
 */
function RoundButton({
  symbol,
  label,
  onPress,
  isSelected,
  followsReadingOrder = false,
  symbolTestID,
  testID,
}: RoundButtonProps) {
  const palette = useReaderPalette();
  const isMirrored =
    followsReadingOrder && Platform.OS !== 'ios' && getWritingDirection() === 'rtl';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={isSelected === undefined ? undefined : { selected: isSelected }}
      onPress={onPress}
      hitSlop={{
        top: ROUND_BUTTON_SLOP,
        bottom: ROUND_BUTTON_SLOP,
        left: ROUND_BUTTON_SLOP,
        right: ROUND_BUTTON_SLOP,
      }}
      testID={testID}
      style={({ pressed }) => [
        styles.roundButton,
        { backgroundColor: palette.card, shadowColor: palette.shadow },
        pressed && styles.pressed,
      ]}
    >
      <View style={isMirrored ? styles.mirrored : undefined}>
        <Icon symbol={symbol} textStyle="body" color="ink" testID={symbolTestID} />
      </View>
    </Pressable>
  );
}

export interface ReaderHeaderProps {
  model: ReaderModel;
  /** False while a tap on the page hides the bars: the room stays, the page does not move. */
  isVisible: boolean;
  onBack: () => void;
  onToggleBookmark: () => void;
}

/**
 * The reader's bar, as the validated mockup draws it: a round back button, the surah of the page
 * with "Juz n, Hizb n · Page n" under it, centred, and the round bookmark button, filled when the
 * page has a bookmark (owner's decision, 25 November 2026). A tap on
 * the page hides it for a page free of distraction and another brings it back
 * (toolbars.md › Best practices; going-full-screen.md › Best practices); hidden, it keeps its room
 * and leaves VoiceOver, so nothing on the page moves. Drawn here rather than by the system
 * navigation bar: deviation 82 of the register.
 */
export function ReaderHeader({ model, isVisible, onBack, onToggleBookmark }: ReaderHeaderProps) {
  const { t } = useTranslation('reader');
  return (
    <View
      testID="reader-header"
      style={[styles.header, !isVisible && styles.hidden]}
      pointerEvents={isVisible ? 'auto' : 'none'}
      accessibilityElementsHidden={!isVisible}
      importantForAccessibility={isVisible ? 'auto' : 'no-hide-descendants'}
    >
      <RoundButton
        symbol={BACK_SYMBOL}
        label={t('bar.back')}
        onPress={onBack}
        testID="reader-back"
      />
      <View style={styles.title} accessible accessibilityRole="header">
        <AppText variant="headline" color="ink" align="center" numberOfLines={1}>
          {surahDisplayName(model.surah)}
        </AppText>
        {/* Secondary ink, not the system's secondary label: on the warm ground the system grey is
            too pale (accessibility.md › Vision). */}
        <AppText variant="footnote" color="inkSecondary" align="center" numberOfLines={1}>
          {t('page.subtitle', { juz: model.juz, hizb: model.hizb, page: model.page })}
        </AppText>
      </View>
      <RoundButton
        symbol={model.isBookmarked ? BOOKMARK_FILLED_SYMBOL : BOOKMARK_SYMBOL}
        label={t('bar.bookmark')}
        onPress={onToggleBookmark}
        isSelected={model.isBookmarked}
        symbolTestID={
          model.isBookmarked ? 'reader-bookmark-symbol-filled' : 'reader-bookmark-symbol-empty'
        }
        testID="reader-bookmark"
      />
    </View>
  );
}

export interface ReaderBottomBarProps {
  isVisible: boolean;
  onListen: () => void;
}

/**
 * The bottom bar of the mockup, with its one control: the big forest-green microphone, centred,
 * that opens the listening screen (owner's decision, 25 November 2026: no other tool for now).
 * The bar is the mockup's lighter cream under a hairline and runs under the home indicator. It
 * hides and comes back with the top bar, and keeps its room so the page does not move. The
 * microphone is the screen's one coloured button (buttons.md › Style), 56 points, with a soft
 * shadow of its own green as in the mockup.
 */
export function ReaderBottomBar({ isVisible, onListen }: ReaderBottomBarProps) {
  const { t } = useTranslation('reader');
  const palette = useReaderPalette();
  return (
    <SafeAreaView
      edges={BOTTOM_EDGE}
      testID="reader-bottom-bar"
      pointerEvents={isVisible ? 'auto' : 'none'}
      accessibilityElementsHidden={!isVisible}
      importantForAccessibility={isVisible ? 'auto' : 'no-hide-descendants'}
      style={[
        styles.bottomBar,
        isVisible
          ? { backgroundColor: palette.bar, borderTopColor: palette.barEdge }
          : styles.hiddenBar,
      ]}
    >
      <View style={[styles.bottomBarContent, !isVisible && styles.hidden]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('bar.listen')}
          onPress={onListen}
          testID="reader-listen"
          style={({ pressed }) => [
            styles.microphone,
            { backgroundColor: palette.action, shadowColor: palette.action },
            pressed && styles.pressed,
          ]}
        >
          <Icon symbol={MICROPHONE_SYMBOL} textStyle="title2" tint={palette.onAction} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/**
 * The watered pill, the one designed moment of the reader, as the mockup draws it under the
 * title: white, with a soft shadow, the water drop and the words in water (the accent), the
 * words a little bolder than the text around (feedback.md › Consider integrating status feedback
 * into your interface). It comes in with the system's snappy spring, a short scale and fade tied
 * to the page that counted (motion.md › Aim for brevity and precision in feedback animations);
 * with Reduce Motion it is simply there (spec 3; accessibility.md › Cognitive).
 */
export function FeedbackPill({ text }: { text: string }) {
  const palette = useReaderPalette();
  const isMotionReduced = useReducedMotion();
  const { durationMs, dampingRatio, fromScale } = READER_CONFIG.feedbackEntrance;
  const entrance = useSharedValue(isMotionReduced ? 1 : 0);
  useEffect(() => {
    if (isMotionReduced) return;
    entrance.value = withSpring(1, { duration: durationMs, dampingRatio });
  }, [dampingRatio, durationMs, entrance, isMotionReduced]);
  const entranceStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, entrance.value),
    transform: [{ scale: fromScale + (1 - fromScale) * entrance.value }],
  }));
  return (
    <Animated.View
      style={isMotionReduced ? undefined : entranceStyle}
      pointerEvents="none"
      testID="reader-feedback-motion"
    >
      <View
        style={[styles.pill, { backgroundColor: palette.card, shadowColor: palette.shadow }]}
        accessible
        accessibilityLiveRegion="polite"
        testID="reader-feedback"
      >
        <Icon
          symbol={WATER_SYMBOL}
          textStyle="footnote"
          color="accent"
          testID="reader-feedback-drop"
        />
        <AppText variant="footnote" color="accent" numberOfLines={2} style={styles.pillText}>
          <Text style={styles.emphasis}>{text}</Text>
        </AppText>
      </View>
    </Animated.View>
  );
}

const shadow = {
  shadowOpacity,
  shadowRadius,
  shadowOffset: { width: 0, height: shadowOffsetY },
} as const;

const styles = StyleSheet.create({
  header: {
    minHeight: readerShapes.barHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: layout.screenMargin,
  },
  hidden: { opacity: 0 },
  title: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  roundButton: {
    width: roundButton,
    height: roundButton,
    borderRadius: roundButton / 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  pressed: { opacity: stateOpacity.pressed },
  mirrored: { transform: [{ scaleX: -1 }] },
  pill: {
    minHeight: readerShapes.pillHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: readerShapes.pillRadius,
    ...shadow,
  },
  pillText: { flexShrink: 1 },
  bottomBar: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'transparent',
  },
  bottomBarContent: { paddingVertical: spacing.sm },
  hiddenBar: { backgroundColor: 'transparent' },
  microphone: {
    width: readerShapes.micButton,
    height: readerShapes.micButton,
    borderRadius: readerShapes.micButton / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: shadowOpacity * 3,
    shadowRadius: shadowRadius * 1.5,
    shadowOffset: { width: 0, height: shadowOffsetY * 2 },
  },
  emphasis: { fontWeight: emphasisWeight },
});
