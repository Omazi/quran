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

import { quranStructure } from '@/data/quran';
import { getDisplayedLanguage } from '@/i18n';
import {
  AppText,
  Button,
  ContentUnavailable,
  Icon,
  Screen,
  layout,
  spacing,
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

const WATER_SYMBOL: IconSymbol = { ios: 'drop.fill', android: 'water_drop' };
const NOT_FOUND_SYMBOL: IconSymbol = { ios: 'book.closed', android: 'book_2' };
const FONT_SYMBOL: IconSymbol = { ios: 'textformat', android: 'text_fields' };
const NEXT_ACTION = 'nextPage';
const PREVIOUS_ACTION = 'previousPage';
/** Holds the height of the empty feedback line, at the person's text size. */
const NO_BREAK_SPACE = '\u00a0';

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
 * hidden, so the text never moves.
 *
 * Under the bar, a line says when the page just left was counted (spec 3): status feedback in the
 * interface, near what it is about, not an alert (feedback.md › Best practices). It stays until
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
  const pager = useRef<BookPagerHandle>(null);
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

  const renderPage = useCallback(
    (page: number) =>
      metrics === null ? null : (
        <MushafPageView
          page={page}
          metrics={metrics}
          onTap={toggleBars}
          turnActions={turnActions}
        />
      ),
    [metrics, toggleBars, turnActions],
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
      <FeedbackLine feedback={model.feedback} />
      <View style={styles.pages} onLayout={onAreaLayout} testID="reader-pages">
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
              accessibilityLabel={t('page.pager')}
            />
          )
        }
      </View>
    </Screen>
  );
}

/**
 * What the page just left gave: one short line, in the ink of the page, with the water symbol in
 * the accent (charter: the accent is water, "arrosé"). VoiceOver hears it too.
 */
function FeedbackLine({ feedback }: { feedback: ReadingFeedback | null }) {
  const { t } = useTranslation(['reader', 'garden']);
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

  return (
    <View
      style={styles.feedback}
      accessibilityElementsHidden={text === null}
      importantForAccessibility={text === null ? 'no-hide-descendants' : 'auto'}
      testID="reader-feedback"
    >
      {text === null ? null : <Icon symbol={WATER_SYMBOL} textStyle="footnote" color="accent" />}
      <AppText variant="footnote" color="ink" align="center" style={styles.feedbackText}>
        {text ?? NO_BREAK_SPACE}
      </AppText>
    </View>
  );
}

/** The two lines of the navigation bar: the surah of the page, then where the page is. */
function ReaderTitle({ model }: { model: ReaderModel }) {
  const { t } = useTranslation('reader');
  return (
    <View style={styles.title} accessible accessibilityRole="header">
      <AppText variant="headline" align="center" numberOfLines={1}>
        {surahDisplayName(model.surah)}
      </AppText>
      <AppText variant="footnote" color="secondaryLabel" align="center" numberOfLines={1}>
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
  feedback: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: layout.screenMargin,
  },
  feedbackText: { flexShrink: 1 },
  pages: { flex: 1 },
  title: { alignItems: 'center' },
  action: { paddingHorizontal: layout.screenMargin, paddingVertical: spacing.md },
});
