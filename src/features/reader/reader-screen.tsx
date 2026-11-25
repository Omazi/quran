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

import {
  Button,
  ContentUnavailable,
  Screen,
  layout,
  readerShapes,
  spacing,
  useReducedMotion,
  type IconSymbol,
} from '@/ui';

import { BookPager, type BookPagerHandle } from './book-pager';
import { READER_CONFIG } from './config';
import { MushafPageView, type PageTurnActions } from './mushaf-page-view';
import { FeedbackPill, ReaderBottomBar, ReaderHeader } from './reader-bar';
import { computePageMetrics, type PageArea, type PageMetrics } from './page-layout';
import { nextPage, previousPage } from './page-order';
import type { ReadingFeedback } from './reading-feedback';
import type { ReaderActions, ReaderModel } from './use-reader';
import type { QuranFontStatus } from './use-quran-font';
import type { PageTurnDirection } from './zoom';
import { ZoomablePage, useZoomState } from './zoomable-page';

const NOT_FOUND_SYMBOL: IconSymbol = { ios: 'book.closed', android: 'book_2' };
const FONT_SYMBOL: IconSymbol = { ios: 'textformat', android: 'text_fields' };
/** The bottom bar runs under the home indicator and keeps it clear itself. */
const TOP_AND_SIDES = ['top', 'left', 'right'] as const;
const NEXT_ACTION = 'nextPage';
const PREVIOUS_ACTION = 'previousPage';

export { surahDisplayName } from './surah-name';

export interface ReaderScreenProps {
  model: ReaderModel;
  actions: ReaderActions;
  fontStatus: QuranFontStatus;
  /** The page the reader opened on: the pager starts there. */
  initialPage: number;
  /** Leaves the reader for the table of contents. */
  openContents: () => void;
  /** Leaves the reader for where the person came from. */
  close: () => void;
  /** Opens the listening screen, from the microphone. */
  openListening: () => void;
}

/**
 * The reader (spec 2), as the validated mockup draws it (docs/design/mushaf.png): on the warm
 * ground, the bar (a round back button, the surah of the page and where it is, a round button to
 * the contents), the row of the watered pill, then one page of the mushaf in its double golden
 * frame. A tap on the page hides the bar and brings it back (toolbars.md › Best practices); the
 * bar keeps its room, so the page never moves.
 *
 * When the page just left was counted (spec 3), the watered pill shows in its own row under the
 * title, as in the mockup, for a few seconds: status feedback near what it is about, not an alert
 * (feedback.md › Consider integrating status feedback into your interface). The row is kept when
 * the pill is gone, so it covers no line and the page does not move for it.
 */
export function ReaderScreen({
  model,
  actions,
  fontStatus,
  initialPage,
  openContents,
  close,
  openListening,
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
    <Screen background="readerCanvas" edges={TOP_AND_SIDES} testID="reader">
      <ReaderHeader
        model={model}
        isVisible={model.barsVisible}
        onBack={close}
        onToggleBookmark={actions.toggleBookmark}
      />
      <View style={styles.pillRow} testID="reader-pill-row">
        {feedbackText === null ? null : <FeedbackPill key={feedbackText} text={feedbackText} />}
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
      <ReaderBottomBar isVisible={model.barsVisible} onListen={openListening} />
    </Screen>
  );
}

/** What the page just left gave, in words, or null when there is nothing to say. */
function useFeedbackText(feedback: ReadingFeedback | null): string | null {
  const { t } = useTranslation(['reader', 'garden']);
  if (feedback === null) return null;
  if (feedback.kind === 'hizb-completed') {
    return t('reader:feedback.hizbCompleted', {
      element: t(`garden:kinds.${feedback.elementKind}`),
    });
  }
  // What the page grows, by name ("+1 page, ton grenadier grandit"); the garden when nothing does.
  return feedback.growingKind === null
    ? t('reader:feedback.pageCounted')
    : t('reader:feedback.pageGrows', {
        growth: t(`reader:feedback.grows.${feedback.growingKind}`),
      });
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
    <Screen background="readerCanvas" testID={testID}>
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
  // The room of the system navigation bar, which floats over a reader that has nothing to show.
  barRoom: { height: Platform.select(READER_CONFIG.navigationBarHeight) },
  // The row of the watered pill, kept when it is empty, so the page does not move.
  pillRow: {
    minHeight: readerShapes.pillRowHeight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: layout.screenMargin,
  },
  pages: { flex: 1 },
  action: { paddingHorizontal: layout.screenMargin, paddingVertical: spacing.md },
});
