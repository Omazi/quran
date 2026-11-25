import { useEffect, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import {
  AppText,
  Icon,
  layout,
  pieceSizes,
  spacing,
  storyLayout,
  storyMotion,
  useReducedMotion,
  useSafeInsets,
  type TextColorRole,
} from '@/ui';

import type { OnboardingWords } from '../pages';

/** The colours of a title and of its sentence, for each kind of words (`OnboardingPage.words`). */
const WORD_COLORS: Readonly<
  Record<OnboardingWords, { title: TextColorRole; text: TextColorRole }>
> = {
  garden: { title: 'heading', text: 'muted' },
  dust: { title: 'heading', text: 'earthSecondary' },
  deep: { title: 'onDeep', text: 'onDeepSecondary' },
};

const SWIPE_SYMBOL = { ios: 'chevron.backward.2', android: 'keyboard_double_arrow_left' } as const;

interface PageWordsProps {
  title: string;
  text: string;
  words: OnboardingWords;
  /** "Glisse", with chevrons that point the way: on the first page only. */
  hint?: string;
}

/**
 * The words of a page: its title, in the serif of the mockups (Large Title, Fraunces), and one
 * sentence in the quieter colour under it (the prototype's `h1` and `p`). Both follow the writing
 * direction (right-to-left.md › Text alignment) and the person's text size.
 */
function PageWords({ title, text, words, hint }: PageWordsProps) {
  const colors = WORD_COLORS[words];
  return (
    <View style={styles.words}>
      <AppText variant="largeTitle" color={colors.title}>
        {title}
      </AppText>
      <AppText color={colors.text}>{text}</AppText>
      {hint === undefined ? null : <SwipeHint label={hint} />}
    </View>
  );
}

/**
 * The prototype's "Glisse ‹‹‹": the chevrons drift the way the pages go, gently and without end,
 * the only hint that the pages are swiped. Still with "reduce motion" (motion.md › Best practices).
 * The chevrons point backwards, which SF Symbols mirror in Arabic, where the pages come from the
 * left.
 */
function SwipeHint({ label }: { label: string }) {
  const isMotionReduced = useReducedMotion();
  const drift = useSharedValue(0);
  useEffect(() => {
    if (isMotionReduced) {
      cancelAnimation(drift);
      drift.value = 0.5;
      return;
    }
    drift.value = withRepeat(
      withTiming(1, { duration: storyMotion.hintMs, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [isMotionReduced, drift]);
  const moves = useAnimatedStyle(() => ({
    opacity: 0.4 + 0.6 * drift.value,
    transform: [{ translateX: -storyMotion.hintTravel * drift.value }],
  }));
  return (
    <View style={styles.hint} testID="onboarding-hint">
      <AppText variant="subheadEmphasized" color="actionTint">
        {label}
      </AppText>
      <Animated.View style={moves}>
        <Icon symbol={SWIPE_SYMBOL} textStyle="subheadEmphasized" color="actionTint" />
      </Animated.View>
    </View>
  );
}

export interface StoryWordsLayoutProps extends PageWordsProps {
  /** Under the words: nothing on the story, a note on a feature page. */
  children?: ReactNode;
}

/**
 * A page of the story: only its words, resting low on the page above the page dots, under the
 * scene that stays in place behind the pages (the prototype's `.copy.pin`). At the largest text
 * sizes the words grow upwards and the page scrolls, so no word is cut (layout.md › Adaptability).
 */
export function StoryWordsLayout({ children, ...words }: StoryWordsLayoutProps) {
  const insets = useSafeInsets();
  return (
    <ScrollView
      alwaysBounceVertical={false}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.storyContent,
        {
          paddingTop: insets.top + storyLayout.brandBarHeight,
          paddingBottom: insets.bottom + storyLayout.wordsBottom,
        },
      ]}
      testID="onboarding-page"
    >
      <PageWords {...words} />
      {children}
    </ScrollView>
  );
}

export interface SettingsLayoutProps extends PageWordsProps {
  /**
   * Where the words start: `goal` under the small scene (37 % of the window), `reminders` near
   * the top, under the previewed notifications.
   */
  placement: 'goal' | 'reminders';
  /** Above the words: the previewed notifications of the reminders page. */
  above?: ReactNode;
  /** Under the list: the sentence that announces the system's alert. */
  below?: ReactNode;
  /** A `GroupedList` with a clear background: it scrolls by itself. */
  children: ReactNode;
}

/** The smallest height left to the list of settings: about three rows at the default text size. */
const LIST_MIN_HEIGHT = layout.touchTarget * 3;

/**
 * A page with settings (the prototype's `.page`): the words, then the list, on the sky of the
 * story. The list scrolls by itself and cannot sit in a page that scrolls too: at the largest text
 * sizes the words scroll in the space left above the list, which keeps a minimum height
 * (layout.md › Adaptability). The bottom stays clear of the page dots, or of the last button.
 */
export function SettingsLayout({
  placement,
  above,
  below,
  children,
  ...words
}: SettingsLayoutProps) {
  const insets = useSafeInsets();
  const { height } = useWindowDimensions();
  const top = placement === 'goal' ? height * storyLayout.goalTopShare : storyLayout.remindersTop;
  // Clear of the dots (goal) or of the last button and its margin (reminders).
  const bottom =
    placement === 'goal'
      ? storyLayout.dotsBottom + layout.touchTarget
      : storyLayout.finishBottom + pieceSizes.actionHeight + spacing.sm;
  return (
    <View
      style={[
        styles.settingsPage,
        { paddingTop: insets.top + top, paddingBottom: insets.bottom + bottom },
      ]}
      testID="onboarding-page"
    >
      <ScrollView
        alwaysBounceVertical={false}
        style={styles.settingsWords}
        contentContainerStyle={styles.settingsWordsContent}
      >
        {above}
        <PageWords {...words} />
      </ScrollView>
      <View style={styles.list}>{children}</View>
      {below === undefined || below === null ? null : <View style={styles.below}>{below}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  words: { gap: storyLayout.titleGap },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.sm,
    marginTop: storyLayout.hintGap - storyLayout.titleGap,
    minHeight: layout.touchTarget / 2,
  },
  storyContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: storyLayout.margin,
  },
  settingsPage: { flex: 1 },
  // Takes the height of its words, and gives way to the list when the two do not fit.
  settingsWords: { flexGrow: 0, flexShrink: 1 },
  settingsWordsContent: { paddingHorizontal: storyLayout.margin },
  list: { flex: 1, minHeight: LIST_MIN_HEIGHT },
  below: { paddingHorizontal: storyLayout.margin, paddingTop: spacing.sm },
});
