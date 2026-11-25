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
 * A pill over the band of the bar says when the page just left was counted (spec 3): status
 * feedback in the interface, near what it is about, not an alert (feedback.md › Best practices).
 * It takes no room of its own, so the page does not move when it comes and goes. It stays until
 * the next page, never dismissed by a timer (accessibility.md › Cognitive), and it does not move:
 * nothing here is animated, so Reduce Motion has nothing to remove.
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
      <View style={styles.barRoom} />
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
        <FeedbackPill feedback={model.feedback} />
      </View>
    </Screen>
  );
}

/**
 * What the page just left gave: one short pill, laid over the band of the navigation bar, with
 * the water symbol (charter: the accent is water, "arrosé"). It is the accent filled with its own
 * label colour, the prominent style of the charter, so it reads on the paper in both appearances.
 * Nothing is drawn when there is nothing to say, so it reserves no room. VoiceOver hears it too.
 */
function FeedbackPill({ feedback }: { feedback: ReadingFeedback | null }) {
  const { t } = useTranslation(['reader', 'garden']);
  const colors = useColors();
  const text =
    feedback === null
      ? null
      : feedback.kind === 'page-counted'
        ? t('reader:feedback.pageCounted')
        : t('reader:feedback.hizbCompleted', {
            element: t(`garden:kinds.${feedback.elementKind}`),
          });

  useEffect(() => {
    if (text !== null) AccessibilityInfo.announceForAccessibility(text);
  }, [text]);

  if (text === null) return null;
  return (
    <View style={styles.feedbackBand} pointerEvents="none">
      <View
        style={[styles.feedback, { backgroundColor: colors.accent }]}
        accessible
        testID="reader-feedback"
      >
        <Icon symbol={WATER_SYMBOL} textStyle="footnote" color="onAccent" />
        <AppText variant="footnote" color="onAccent" align="center" style={styles.feedbackText}>
          {text}
        </AppText>
      </View>
    </View>
  );
}

/** The two lines of the navigation bar: the surah of the page, then where the page is. */
function ReaderTitle({ model }: { model: ReaderModel }) {
  const { t } = useTranslation('reader');
  return (
    <View style={styles.title} accessible accessibilityRole="header">
      <AppText variant="headline" color="ink" align="center" numberOfLines={1}>
        {surahDisplayName(model.surah)}
      </AppText>
      {/* Secondary ink, not the system's secondary label: the bar floats over the paper, on which
          the system grey reaches only 3.35:1 (accessibility.md › Vision). */}
      <AppText variant="footnote" color="inkSecondary" align="center" numberOfLines={1}>
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
  barRoom: { height: Platform.select(READER_CONFIG.navigationBarHeight) },
  // At the top of the room under the bar (the page area, which the safe area has already moved
  // down), in the whitespace the page leaves above its frame; it covers no text.
  feedbackBand: {
    position: 'absolute',
    top: spacing.xs,
    start: 0,
    end: 0,
    alignItems: 'center',
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
  title: { alignItems: 'center' },
  action: { paddingHorizontal: layout.screenMargin, paddingVertical: spacing.md },
});
