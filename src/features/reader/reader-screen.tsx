import type { NativeStackNavigationOptions } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { quranStructure } from '@/data/quran';
import { getDisplayedLanguage } from '@/i18n';
import {
  AppText,
  Button,
  ContentUnavailable,
  Icon,
  Screen,
  layout,
  radius,
  spacing,
  useColors,
  useReducedMotion,
  type IconSymbol,
} from '@/ui';

import { BookPager, type BookPagerHandle } from './book-pager';
import { READER_CONFIG } from './config';
import { MushafPageView, type PageTurnActions } from './mushaf-page-view';
import { computePageMetrics, type PageArea, type PageMetrics } from './page-layout';
import { nextPage, previousPage } from './page-order';
import type { ReadingFeedback } from './reading-feedback';
import type { ReaderActions, ReaderModel } from './use-reader';
import type { QuranFontStatus } from './use-quran-font';
import type { PageTurnDirection } from './zoom';
import { ZoomablePage, useZoomState } from './zoomable-page';

const WATER_SYMBOL: IconSymbol = { ios: 'drop.fill', android: 'water_drop' };
const NOT_FOUND_SYMBOL: IconSymbol = { ios: 'book.closed', android: 'book_2' };
const FONT_SYMBOL: IconSymbol = { ios: 'textformat', android: 'text_fields' };
const NEXT_ACTION = 'nextPage';
const PREVIOUS_ACTION = 'previousPage';

/** The name of a surah in the language of the interface. */
export function surahDisplayName(surah: number): string {
  const info = quranStructure.surah(surah);
  return getDisplayedLanguage() === 'ar' ? info.nameArabic : info.nameTransliterated;
}

export interface ReaderScreenProps {
  model: ReaderModel;
  actions: ReaderActions;
  fontStatus: QuranFontStatus;
  /** The page the reader opened on: the pager starts there. */
  initialPage: number;
  /** Leaves the reader for the table of contents. */
  openContents: () => void;
}

/**
 * The reader (spec 2): one page of the mushaf per screen, on the paper of the page, under the
 * system navigation bar, which floats over the top and which a tap hides or shows
 * (toolbars.md › Best practices: hide toolbars for a distraction-free experience, restore them
 * with a tap; going-full-screen.md › Best practices). The room of the bar stays empty when it is
 * hidden, so the text never moves; the framed page is centred in the room under it.
 *
 * When the page just left was counted (spec 3), the watered pill takes the place of the title in
 * the bar for a few seconds: status feedback in the interface, near what it is about, not an alert
 * (feedback.md › Consider integrating status feedback into your interface, as Mail does in its
 * toolbar). While the bars are hidden it shows in their empty room, at the same place. It is never
 * laid over the page, so it covers no line on any screen, and the page does not move for it.
 */
export function ReaderScreen({
  model,
  actions,
  fontStatus,
  initialPage,
  openContents,
}: ReaderScreenProps) {
  const { t } = useTranslation('reader');
  const [area, setArea] = useState<PageArea | null>(null);
  // While a page is enlarged, a swipe moves around it instead of turning it.
  const [isZoomed, setZoomed] = useState(false);
  const isMotionReduced = useReducedMotion();
  const pager = useRef<BookPagerHandle>(null);
  const zoom = useZoomState();
  const { changePage, toggleBars } = actions;
  const feedbackText = useFeedbackText(model.feedback);

  // Heard once, wherever the pill shows (feedback.md › Make sure all feedback is accessible).
  useEffect(() => {
    if (feedbackText !== null) AccessibilityInfo.announceForAccessibility(feedbackText);
  }, [feedbackText]);

  const onAreaLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setArea((current) =>
      current?.width === width && current.height === height ? current : { width, height },
    );
  }, []);

  const metrics = useMemo<PageMetrics | null>(
    () => (area === null || area.width <= 0 || area.height <= 0 ? null : computePageMetrics(area)),
    [area],
  );

  const pageRef = useRef(model.page);
  useEffect(() => {
    pageRef.current = model.page;
  }, [model.page]);
  const turnActions = useMemo<PageTurnActions>(
    () => ({
      actions: [
        { name: NEXT_ACTION, label: t('page.next') },
        { name: PREVIOUS_ACTION, label: t('page.previous') },
      ],
      onAction: (event: AccessibilityActionEvent) => {
        const current = pageRef.current;
        const target =
          event.nativeEvent.actionName === NEXT_ACTION ? nextPage(current) : previousPage(current);
        if (target === null) return;
        pager.current?.showPage(target);
        changePage(target);
      },
    }),
    [changePage, t],
  );

  // A drag that reaches the edge of the enlarged page turns it, like a swipe at its own size.
  const turnFromEdge = useCallback(
    (direction: PageTurnDirection) => {
      const current = pageRef.current;
      const target = direction === 'next' ? nextPage(current) : previousPage(current);
      if (target === null) return;
      pager.current?.showPage(target);
      changePage(target);
    },
    [changePage],
  );

  const currentPage = model.page;
  const renderPage = useCallback(
    (page: number) =>
      metrics === null || area === null ? null : (
        <ZoomablePage
          zoom={zoom}
          isCurrent={page === currentPage}
          side={page > currentPage ? 'next' : 'previous'}
          onEdgeTurn={turnFromEdge}
          width={area.width}
          height={area.height}
          onTap={toggleBars}
          onZoomChange={setZoomed}
          isMotionReduced={isMotionReduced}
          testID={`reader-page-${page}`}
        >
          <MushafPageView page={page} metrics={metrics} area={area} turnActions={turnActions} />
        </ZoomablePage>
      ),
    [area, currentPage, isMotionReduced, metrics, toggleBars, turnActions, turnFromEdge, zoom],
  );

  if (fontStatus === 'failed') {
    return (
      <ReaderUnavailable
        title={t('fontMissing.title')}
        description={t('fontMissing.description')}
        actionLabel={t('fontMissing.action')}
        symbol={FONT_SYMBOL}
        onAction={openContents}
        testID="reader-font-missing"
      />
    );
  }

  return (
    <Screen background="paper" testID="reader">
      <View style={[styles.barRoom, titleAlignment]} testID="reader-bar-room">
        {model.barsVisible || feedbackText === null ? null : <FeedbackPill text={feedbackText} />}
      </View>
      <View style={styles.pages}>
        <GestureHandlerRootView style={styles.pages} onLayout={onAreaLayout} testID="reader-pages">
          {
            // No page before the font: the Quran text is never shown in another one (spec).
            metrics === null || area === null || fontStatus !== 'ready' ? null : (
              <BookPager
                ref={pager}
                initialPage={initialPage}
                width={area.width}
                height={area.height}
                onPageChange={changePage}
                renderPage={renderPage}
                scrollEnabled={!isZoomed}
                accessibilityLabel={t('page.pager')}
              />
            )
          }
        </GestureHandlerRootView>
      </View>
    </Screen>
  );
}

/** What the page just left gave, in words, or null when there is nothing to say. */
function useFeedbackText(feedback: ReadingFeedback | null): string | null {
  const { t } = useTranslation(['reader', 'garden']);
  if (feedback === null) return null;
  return feedback.kind === 'page-counted'
    ? t('reader:feedback.pageCounted')
    : t('reader:feedback.hizbCompleted', { element: t(`garden:kinds.${feedback.elementKind}`) });
}

/**
 * The bar's title and the pill share the platform's alignment of a bar title: centred on iOS,
 * at the start on Android and the web (toolbars.md › Titles; React Navigation's own default), so
 * that every line of the block lines up with the others (layout.md › Visual hierarchy: align
 * elements to make them easier to scan).
 */
const titleAlignment = Platform.OS === 'ios' ? { alignItems: 'center' as const } : null;
const titleTextAlignment = Platform.OS === 'ios' ? 'center' : 'start';

/**
 * The watered pill, the one designed moment of the reader: the accent, which is water (charter),
 * filled with its own label colour, with the water drop of SF Symbols in the weight of its text
 * (sf-symbols.md › Weights and scales). It comes in with the system's snappy spring, a short scale
 * and fade tied to the page that counted (motion.md › Aim for brevity and precision in feedback
 * animations); with Reduce Motion it is simply there (spec 3; accessibility.md › Cognitive). It
 * holds two lines at most, the height of the bar.
 */
function FeedbackPill({ text }: { text: string }) {
  const colors = useColors();
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
        style={[styles.feedback, { backgroundColor: colors.accent }]}
        accessible
        accessibilityLiveRegion="polite"
        testID="reader-feedback"
      >
        <Icon
          symbol={WATER_SYMBOL}
          textStyle="footnote"
          color="onAccent"
          testID="reader-feedback-drop"
        />
        <AppText variant="footnote" color="onAccent" numberOfLines={2} style={styles.feedbackText}>
          {text}
        </AppText>
      </View>
    </Animated.View>
  );
}

/**
 * The title of the navigation bar: the surah of the page, then where the page is; or, for a few
 * seconds after a page counted, the watered pill in their place.
 */
function ReaderTitle({ model }: { model: ReaderModel }) {
  const { t } = useTranslation('reader');
  const feedbackText = useFeedbackText(model.feedback);
  if (feedbackText !== null) {
    return (
      <View style={[styles.title, titleAlignment]}>
        <FeedbackPill key={feedbackText} text={feedbackText} />
      </View>
    );
  }
  return (
    <View style={[styles.title, titleAlignment]} accessible accessibilityRole="header">
      <AppText variant="headline" color="ink" align={titleTextAlignment} numberOfLines={1}>
        {surahDisplayName(model.surah)}
      </AppText>
      {/* Secondary ink, not the system's secondary label: the bar floats over the paper, on which
          the system grey reaches only 3.35:1 (accessibility.md › Vision). */}
      <AppText variant="footnote" color="inkSecondary" align={titleTextAlignment} numberOfLines={1}>
        {t('page.subtitle', { juz: model.juz, hizb: model.hizb, page: model.page })}
      </AppText>
    </View>
  );
}

/**
 * The options of the system navigation bar for the reader. The bar is transparent: on iOS 26 the
 * system gives its controls the Liquid Glass material over the page, which is where the material
 * belongs (liquid-glass.md › Where the material belongs); the back button is the system's own
 * (toolbars.md › Navigation).
 */
export function useReaderHeaderOptions(model: ReaderModel): NativeStackNavigationOptions {
  return useMemo(
    () => ({
      headerShown: model.barsVisible,
      headerTitle: () => <ReaderTitle model={model} />,
    }),
    [model],
  );
}

interface ReaderUnavailableProps {
  title: string;
  description: string;
  actionLabel: string;
  symbol: IconSymbol;
  onAction: () => void;
  testID: string;
}

/**
 * A reader with nothing to show: the system's empty state says why and what to do, and one button
 * leads to the table of contents (writing.md › Best practices: clear next steps on a blank screen).
 */
export function ReaderUnavailable({
  title,
  description,
  actionLabel,
  symbol,
  onAction,
  testID,
}: ReaderUnavailableProps) {
  return (
    <Screen testID={testID}>
      <View style={styles.barRoom} />
      <ContentUnavailable title={title} description={description} symbol={symbol} />
      <View style={styles.action}>
        <Button label={actionLabel} onPress={onAction} fullWidth testID={`${testID}-action`} />
      </View>
    </Screen>
  );
}

/** The page asked for does not exist: only 1 to 604 do. */
export function ReaderNotFound({ openContents }: { openContents: () => void }) {
  const { t } = useTranslation('reader');
  return (
    <ReaderUnavailable
      title={t('notFound.title')}
      description={t('notFound.description')}
      actionLabel={t('notFound.action')}
      symbol={NOT_FOUND_SYMBOL}
      onAction={openContents}
      testID="reader-not-found"
    />
  );
}

const styles = StyleSheet.create({
  // The room of the bar, kept when the bar is hidden; the pill then sits in it, where the title was.
  barRoom: {
    height: Platform.select(READER_CONFIG.navigationBarHeight),
    justifyContent: 'center',
    paddingHorizontal: layout.screenMargin,
  },
  feedback: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg * 2,
  },
  feedbackText: { flexShrink: 1 },
  pages: { flex: 1 },
  title: { justifyContent: 'center' },
  action: { paddingHorizontal: layout.screenMargin, paddingVertical: spacing.md },
});
