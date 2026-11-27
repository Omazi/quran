import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { useGenderedTranslation } from '@/features/gender';
import {
  AppText,
  Icon,
  getWritingDirection,
  layout,
  readerShapes,
  spacing,
  stateOpacity,
  useColors,
  useElevation,
  type IconSymbol,
} from '@/ui';

import type { ReaderScript } from '@/store';

import { READER_CONFIG } from './config';
import { ReaderGlass } from './reader-glass';
import { ReaderSegmented, type ReaderChoiceOption } from './contents-parts';
import { surahDisplayName } from './surah-name';

const BACK_SYMBOL: IconSymbol = { ios: 'chevron.backward', android: 'arrow_back_ios_new' };
const BOOKMARK_SYMBOL: IconSymbol = { ios: 'bookmark', android: 'bookmark_border' };
const BOOKMARK_FILLED_SYMBOL: IconSymbol = { ios: 'bookmark.fill', android: 'bookmark' };
const TEXT_SIZE_SYMBOL: IconSymbol = { ios: 'textformat.size', android: 'format_size' };
const MICROPHONE_SYMBOL: IconSymbol = { ios: 'mic.fill', android: 'mic' };
const TEXT_SMALLER_SYMBOL: IconSymbol = {
  ios: 'textformat.size.smaller',
  android: 'text_decrease',
};
const TEXT_LARGER_SYMBOL: IconSymbol = { ios: 'textformat.size.larger', android: 'text_increase' };
const WATER_SYMBOL: IconSymbol = { ios: 'drop.fill', android: 'water_drop' };

const { glassControl, glassBarHeight, glassBarPadding, glassSideInset, sizeTrackWidth, sizeThumb } =
  readerShapes;
const CAPSULE = glassControl / 2;

/** Hidden controls keep their place and leave VoiceOver (going-full-screen.md › Best practices). */
function visibility(isVisible: boolean) {
  return {
    pointerEvents: isVisible ? ('box-none' as const) : ('none' as const),
    accessibilityElementsHidden: !isVisible,
    importantForAccessibility: isVisible ? ('auto' as const) : ('no-hide-descendants' as const),
  };
}

interface GlassButtonProps {
  symbol: IconSymbol;
  label: string;
  onPress: () => void;
  isSelected?: boolean;
  /** Mirrors the symbol in Arabic outside iOS: only for symbols of reading order. */
  followsReadingOrder?: boolean;
  /** Drawn inside a group of glass: no glass of its own. */
  isGrouped?: boolean;
  symbolTestID?: string;
  testID: string;
}

/**
 * A round glass button of the reader's top controls (maquette-wow, `.rd-top`): 44 points, the
 * touch target itself (buttons.md › Best practices), an SF Symbol in ink without border
 * (toolbars.md › Prefer system-provided symbols without borders) and a label for VoiceOver. The
 * symbols of reading order take their right-to-left form in Arabic (right-to-left.md › Interface
 * icons): SF Symbols does it on iOS, Material Symbols are mirrored here.
 */
function GlassButton({
  symbol,
  label,
  onPress,
  isSelected,
  followsReadingOrder = false,
  isGrouped = false,
  symbolTestID,
  testID,
}: GlassButtonProps) {
  const isMirrored =
    followsReadingOrder && Platform.OS !== 'ios' && getWritingDirection() === 'rtl';
  const content = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={isSelected === undefined ? undefined : { selected: isSelected }}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.glassButton, pressed && styles.pressed]}
    >
      <View style={isMirrored ? styles.mirrored : undefined}>
        <Icon symbol={symbol} textStyle="body" color="ink" testID={symbolTestID} />
      </View>
    </Pressable>
  );
  if (isGrouped) return content;
  return <ReaderGlass>{content}</ReaderGlass>;
}

export interface ReaderTopBarProps {
  surah: number;
  page: number;
  juz: number;
  hizb: number;
  isBookmarked: boolean;
  isTextSizeOpen: boolean;
  /** False while a tap on the page hides the controls. */
  isVisible: boolean;
  top: number;
  onBack: () => void;
  onToggleBookmark: () => void;
  onToggleTextSize: () => void;
}

/**
 * The reader's top controls (maquette-wow, shots 14 to 16): on the leading edge the back button;
 * in the middle, the glass title pill, the surah and the page being read ("Al-Kahf", "page 293");
 * on the trailing edge, one group of glass for the page's actions, the bookmark (filled when the
 * page has one) and the text size (toolbars.md › Item groupings: leading navigation, a title,
 * trailing actions; at most three groups). They float over the text in Liquid Glass
 * (liquid-glass.md › Where the material belongs), hide and come back with a tap on the page
 * (toolbars.md › Consider temporarily hiding toolbars) and keep their place.
 */
export function ReaderTopBar({
  surah,
  page,
  juz,
  hizb,
  isBookmarked,
  isTextSizeOpen,
  isVisible,
  top,
  onBack,
  onToggleBookmark,
  onToggleTextSize,
}: ReaderTopBarProps) {
  const { t } = useTranslation('reader');
  const name = surahDisplayName(surah);
  return (
    <View
      testID="reader-header"
      {...visibility(isVisible)}
      style={[styles.topBar, { top }, !isVisible && styles.hidden]}
    >
      <GlassButton
        symbol={BACK_SYMBOL}
        label={t('bar.back')}
        onPress={onBack}
        followsReadingOrder
        testID="reader-back"
      />
      <View style={styles.titleRoom} pointerEvents="none">
        <ReaderGlass style={styles.titlePill}>
          <View
            accessible
            accessibilityRole="header"
            accessibilityLabel={t('bar.titleSpoken', { surah: name, juz, hizb, page })}
            style={styles.titleText}
          >
            <AppText variant="pillTitle" color="ink" align="center" numberOfLines={1}>
              {name}
            </AppText>
            <AppText variant="footnote" color="inkSecondary" align="center" numberOfLines={1}>
              {t('bar.page', { page })}
            </AppText>
          </View>
        </ReaderGlass>
      </View>
      <ReaderGlass style={styles.group}>
        <GlassButton
          symbol={isBookmarked ? BOOKMARK_FILLED_SYMBOL : BOOKMARK_SYMBOL}
          label={t('bar.bookmark')}
          onPress={onToggleBookmark}
          isSelected={isBookmarked}
          isGrouped
          symbolTestID={
            isBookmarked ? 'reader-bookmark-symbol-filled' : 'reader-bookmark-symbol-empty'
          }
          testID="reader-bookmark"
        />
        <GlassButton
          symbol={TEXT_SIZE_SYMBOL}
          label={t('textSize.label')}
          onPress={onToggleTextSize}
          isSelected={isTextSizeOpen}
          isGrouped
          testID="reader-text-size"
        />
      </ReaderGlass>
    </View>
  );
}

export interface TextSizePanelProps {
  /** Zero-based step of the reader's text size, and how many there are. */
  step: number;
  stepCount: number;
  canShrinkText: boolean;
  canEnlargeText: boolean;
  onShrinkText: () => void;
  onEnlargeText: () => void;
  onChooseStep: (step: number) => void;
  /** Where the text size stands, for VoiceOver ("Taille 2 sur 5"). */
  value: string;
  top: number;
  isMotionReduced: boolean;
}

/**
 * The text size, in a glass panel under the "Aa" button (maquette-wow, shot 16): a small and a
 * large text symbol at the ends of a track whose thumb stands at the size chosen
 * (sliders.md › Customize a slider's appearance: a small icon on the leading side and a large one
 * on the trailing side; minimum on the leading side). Five steps, so the two symbols are buttons, one
 * step each, dimmed at the end of the range, and a touch or a drag on the track goes to the nearest
 * step. VoiceOver hears the two buttons and the size (steppers.md › Make the value obvious).
 */
export function TextSizePanel({
  step,
  stepCount,
  canShrinkText,
  canEnlargeText,
  onShrinkText,
  onEnlargeText,
  onChooseStep,
  value,
  top,
  isMotionReduced,
}: TextSizePanelProps) {
  const { t } = useTranslation('reader');
  const colors = useColors();
  const thumbShadow = useElevation('thumb');
  const last = Math.max(1, stepCount - 1);
  const isRightToLeft = getWritingDirection() === 'rtl';
  const choose = (event: GestureResponderEvent) => {
    const share = Math.min(1, Math.max(0, event.nativeEvent.locationX / sizeTrackWidth));
    // The smallest size is on the leading side: the right in Arabic (sliders.md › Use familiar
    // slider directions; right-to-left.md › Flip controls that show progress).
    onChooseStep(Math.round((isRightToLeft ? 1 - share : share) * last));
  };
  return (
    <Animated.View
      entering={isMotionReduced ? undefined : FadeIn.duration(READER_CONFIG.sizePanelMs)}
      exiting={isMotionReduced ? undefined : FadeOut.duration(READER_CONFIG.sizePanelMs)}
      style={[styles.sizePanelRoom, { top }]}
      testID="reader-text-size-panel"
    >
      <ReaderGlass style={styles.sizePanel}>
        <SizeButton
          symbol={TEXT_SMALLER_SYMBOL}
          label={t('textSize.smaller')}
          value={value}
          isEnabled={canShrinkText}
          onPress={onShrinkText}
          testID="reader-text-smaller"
        />
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={choose}
          onResponderMove={choose}
          testID="reader-text-size-track"
          style={styles.trackRoom}
        >
          <View style={[styles.track, { backgroundColor: colors.glassTrack }]} />
          <View
            style={[
              styles.thumb,
              {
                backgroundColor: colors.glassThumb,
                boxShadow: thumbShadow,
                start: (step / last) * (sizeTrackWidth - sizeThumb),
              },
            ]}
          />
        </View>
        <SizeButton
          symbol={TEXT_LARGER_SYMBOL}
          label={t('textSize.larger')}
          value={value}
          isEnabled={canEnlargeText}
          onPress={onEnlargeText}
          testID="reader-text-larger"
        />
      </ReaderGlass>
    </Animated.View>
  );
}

function SizeButton({
  symbol,
  label,
  value,
  isEnabled,
  onPress,
  testID,
}: {
  symbol: IconSymbol;
  label: string;
  value: string;
  isEnabled: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityValue={{ text: value }}
      accessibilityState={{ disabled: !isEnabled }}
      disabled={!isEnabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.sizeButton,
        !isEnabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Icon symbol={symbol} textStyle="body" color="ink" />
    </Pressable>
  );
}

export interface ReaderBottomBarProps {
  isVisible: boolean;
  bottom: number;
  /** The counter of the day: new pages today and the daily goal ("5 / 8"). */
  todayPages: number;
  goalPages: number;
  script: ReaderScript;
  onChooseScript: (script: ReaderScript) => void;
  onListen: () => void;
  isMotionReduced: boolean;
  onLayout?: (event: LayoutChangeEvent) => void;
}

/**
 * The reader's bottom bar, one capsule of glass (maquette-wow, shots 14 and 15): the water given
 * today ("5 / 8", the drop beside it), the "Uthmani | Simple" choice (segmented-controls.md ›
 * Best practices: closely related choices that affect a view; nouns), and the green microphone
 * that follows the recitation, the one coloured button of the screen (buttons.md › Style;
 * liquid-glass.md › Color on glass: color the background of the primary action, not its symbol).
 * In Arabic the row is mirrored (right-to-left.md › Flip controls that help people navigate).
 */
export function ReaderBottomBar({
  isVisible,
  bottom,
  todayPages,
  goalPages,
  script,
  onChooseScript,
  onListen,
  isMotionReduced,
  onLayout,
}: ReaderBottomBarProps) {
  const { t } = useGenderedTranslation('reader');
  const colors = useColors();
  const scripts = useMemo<readonly ReaderChoiceOption<ReaderScript>[]>(
    () => [
      { value: 'uthmani', label: t('script.uthmani') },
      { value: 'imlaei', label: t('script.imlaei') },
    ],
    [t],
  );
  return (
    <View
      testID="reader-bottom-bar"
      {...visibility(isVisible)}
      onLayout={onLayout}
      style={[styles.bottomRoom, { bottom }, !isVisible && styles.hidden]}
    >
      <ReaderGlass style={styles.bottomBar}>
        <View
          accessible
          accessibilityLabel={t('today.spoken', { count: todayPages, goal: goalPages })}
          style={styles.counter}
          testID="reader-today"
        >
          <Icon symbol={WATER_SYMBOL} textStyle="subhead" tint={colors.waterFill} />
          {/* The two figures share a baseline; the drop, a picture without one, is centred on
              their line instead (on the iPhone it hung 14 points lower in a row of baselines). */}
          <View style={styles.figures} testID="reader-today-figures">
            <Animated.View
              key={todayPages}
              entering={isMotionReduced ? undefined : FadeIn.duration(READER_CONFIG.counterMs)}
            >
              <AppText variant="headline" color="ink" testID="reader-today-count">
                {todayPages}
              </AppText>
            </Animated.View>
            <AppText variant="footnote" color="inkSecondary">
              {t('today.goal', { goal: goalPages })}
            </AppText>
          </View>
        </View>
        <ReaderSegmented
          label={t('script.label')}
          options={scripts}
          value={script}
          onChange={onChooseScript}
          fitsContent
          tone="glass"
          testID="reader-script"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('bar.listen')}
          onPress={onListen}
          testID="reader-listen"
          style={({ pressed }) => [
            styles.microphone,
            { backgroundColor: colors.action },
            pressed && styles.pressed,
          ]}
        >
          <Icon symbol={MICROPHONE_SYMBOL} textStyle="title3" color="onAction" />
        </Pressable>
      </ReaderGlass>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    start: glassSideInset,
    end: glassSideInset,
    minHeight: glassControl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hidden: { opacity: 0 },
  // The title stays in the middle of the screen whatever the widths of the two edges.
  titleRoom: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: glassControl * 2 + spacing.sm,
  },
  titlePill: { minHeight: glassControl, justifyContent: 'center', maxWidth: '100%' },
  titleText: { paddingHorizontal: spacing.md + spacing.xs / 2, paddingVertical: spacing.xs / 2 },
  group: { flexDirection: 'row' },
  glassButton: {
    width: glassControl,
    height: glassControl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: stateOpacity.pressed },
  mirrored: { transform: [{ scaleX: -1 }] },
  sizePanelRoom: { position: 'absolute', end: glassSideInset },
  sizePanel: { flexDirection: 'row', alignItems: 'center', minHeight: glassControl },
  sizeButton: {
    minWidth: layout.touchTarget,
    minHeight: layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: stateOpacity.disabled },
  trackRoom: { width: sizeTrackWidth, height: layout.touchTarget, justifyContent: 'center' },
  track: { height: spacing.xs, borderRadius: spacing.xs / 2 },
  thumb: {
    position: 'absolute',
    width: sizeThumb,
    height: sizeThumb,
    borderRadius: sizeThumb / 2,
  },
  bottomRoom: { position: 'absolute', start: 0, end: 0, alignItems: 'center' },
  bottomBar: {
    minHeight: glassBarHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: glassBarPadding,
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingStart: spacing.sm + spacing.xs / 2,
    paddingEnd: spacing.sm,
  },
  figures: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  microphone: {
    width: glassControl,
    height: glassControl,
    borderRadius: CAPSULE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
