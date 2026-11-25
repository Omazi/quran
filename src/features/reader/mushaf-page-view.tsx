import { memo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet,
  Text,
  View,
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  type LayoutChangeEvent,
} from 'react-native';

import {
  ContentUnavailable,
  ProgressIndicator,
  fontFamily,
  layout,
  readerShapes,
  useColors,
  type IconSymbol,
} from '@/ui';

import { MushafFrame } from './mushaf-frame';
import type { PageLine, PageItem } from './page-content';
import {
  computeOpeningPageMetrics,
  fitLine,
  isOpeningPage,
  pageFrameHeight,
  pageTopInset,
  type PageArea,
  type PageMetrics,
} from './page-layout';
import { SurahCartouche } from './surah-cartouche';
import { useMushafPage } from './use-mushaf-page';

const ERROR_SYMBOL: IconSymbol = { ios: 'exclamationmark.triangle', android: 'warning' };

/** VoiceOver actions offered on every line: the page can be turned without a swipe. */
export interface PageTurnActions {
  readonly actions: readonly AccessibilityActionInfo[];
  readonly onAction: (event: AccessibilityActionEvent) => void;
}

export interface MushafPageViewProps {
  page: number;
  /** The size of every page but 1 and 2, which take theirs from `area`. */
  metrics: PageMetrics;
  /** The room the screen gives a page. */
  area: PageArea;
  turnActions: PageTurnActions;
}

/**
 * One page of the mushaf: its lines, in order, on the paper of the page, inside the double golden
 * frame of the validated mockup (`MushafFrame`). The frame has the same size and place on every
 * page, right under the bar, so it does not move when a page turns; pages 1 and 2 set their
 * few lines larger inside it (`computeOpeningPageMetrics`), as the print does. Memoised: the
 * pager mounts the current page and its neighbours, and a page already drawn does not draw again
 * while the person reads. Taps and zoom belong to `ZoomablePage`, around it.
 */
export const MushafPageView = memo(function MushafPageView({
  page,
  metrics,
  area,
  turnActions,
}: MushafPageViewProps) {
  const { t } = useTranslation('reader');
  const state = useMushafPage(page);
  if (state.status === 'loading') {
    return (
      <View style={styles.centred}>
        <ProgressIndicator accessibilityLabel={t('page.loading', { page })} />
      </View>
    );
  }
  if (state.status === 'error') {
    return (
      <View style={styles.centred} testID={`mushaf-page-${page}-error`}>
        <ContentUnavailable
          title={t('page.error.title')}
          description={t('page.error.description')}
          symbol={ERROR_SYMBOL}
        />
      </View>
    );
  }
  const isOpening = isOpeningPage(page);
  const lineMetrics = isOpening ? computeOpeningPageMetrics(area, state.lines.length) : metrics;
  return (
    <View
      style={[styles.page, { paddingTop: pageTopInset(area, metrics) }]}
      testID={`mushaf-page-${page}`}
    >
      <MushafFrame
        width={area.width - 2 * readerShapes.frameInset}
        height={pageFrameHeight(metrics)}
        testID={`mushaf-page-${page}`}
      >
        <View style={[styles.block, { width: lineMetrics.textWidth }]}>
          {state.lines.map((line, index) => (
            <MushafLine
              // Lines never move within a page: their position is their identity.
              key={index}
              line={line}
              metrics={lineMetrics}
              isCentred={isOpening}
              turnActions={turnActions}
            />
          ))}
        </View>
      </MushafFrame>
    </View>
  );
});

interface MushafLineProps {
  line: PageLine;
  metrics: PageMetrics;
  isCentred: boolean;
  turnActions: PageTurnActions;
}

function MushafLine({ line, metrics, isCentred, turnActions }: MushafLineProps) {
  const row = { height: metrics.lineHeight };
  if (line.kind === 'surah-header') {
    return <SurahCartouche surah={line.surah} metrics={metrics} turnActions={turnActions} />;
  }
  if (line.kind === 'basmala') {
    return (
      <View
        accessible
        accessibilityLanguage="ar"
        accessibilityActions={turnActions.actions}
        onAccessibilityAction={turnActions.onAction}
        style={[styles.row, styles.centredRow, row]}
      >
        <QuranText text={line.text} fontSize={metrics.fontSize} />
      </View>
    );
  }
  return (
    <TextLine
      // A new text size measures the line again, from the full size.
      key={`${metrics.fontSize}:${metrics.textWidth}`}
      items={line.items}
      spokenText={line.spokenText}
      metrics={metrics}
      isCentred={isCentred}
      turnActions={turnActions}
    />
  );
}

interface TextLineProps {
  items: readonly PageItem[];
  spokenText: string;
  metrics: PageMetrics;
  isCentred: boolean;
  turnActions: PageTurnActions;
}

/**
 * A line of text. Each word and verse mark is its own element; the words stay as they are (spec,
 * "Exigence absolue"). Once every item has been laid out, `fitLine` decides: a line that fills at
 * least 60 % of the column is spread across it, the space between words growing; a shorter one is
 * centred with the font's space; a line wider than the column closes its gaps, then is drawn
 * smaller until it fits. It is one element for VoiceOver, which reads its words in Arabic.
 */
function TextLine({ items, spokenText, metrics, isCentred, turnActions }: TextLineProps) {
  const [fit, setFit] = useState({ scale: 1, justify: true });
  const widths = useRef<(number | undefined)[]>([]);
  const isMeasured = useRef(false);

  const measure = (index: number) => (event: LayoutChangeEvent) => {
    if (isMeasured.current) return;
    widths.current[index] = event.nativeEvent.layout.width;
    const measured = widths.current.filter((width): width is number => width !== undefined);
    if (measured.length < items.length) return;
    isMeasured.current = true;
    setFit(
      fitLine({
        itemWidths: measured,
        available: metrics.textWidth,
        wordGap: metrics.wordGap,
        tightestGap: metrics.tightestGap,
      }),
    );
  };

  const { scale } = fit;
  const fontSize = metrics.fontSize * scale;
  const spread = !isCentred && fit.justify && items.length > 1;
  return (
    <View
      accessible
      accessibilityLabel={spokenText}
      accessibilityLanguage="ar"
      accessibilityActions={turnActions.actions}
      onAccessibilityAction={turnActions.onAction}
      style={[
        styles.row,
        { height: metrics.lineHeight },
        spread ? styles.spreadRow : [styles.centredRow, { columnGap: metrics.wordGap * scale }],
      ]}
    >
      {items.map((item, index) => (
        <QuranText
          key={item.key}
          text={item.text}
          fontSize={fontSize}
          isVerseEnd={item.kind === 'verse-end'}
          onLayout={measure(index)}
        />
      ))}
    </View>
  );
}

interface QuranTextProps {
  text: string;
  fontSize: number;
  /** The verse mark is an ornament of the page (spec 2: ornaments take `ornament`). */
  isVerseEnd?: boolean;
  onLayout?: (event: LayoutChangeEvent) => void;
}

/**
 * Quran text, exactly as given, in the font of the King Fahd Complex and nothing else. Its size
 * is the page's, never the text size setting: the page is composed like an image (spec 2,
 * deviation to `typography.md › Supporting Dynamic Type`).
 */
function QuranText({ text, fontSize, isVerseEnd = false, onLayout }: QuranTextProps) {
  const colors = useColors();
  return (
    <Text
      allowFontScaling={false}
      onLayout={onLayout}
      style={{
        fontFamily: fontFamily.quran,
        fontSize,
        color: isVerseEnd ? colors.ornament : colors.ink,
      }}
    >
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  // Right under the bar (`pageTopInset`); a tall room leaves its rest under the page.
  page: { flex: 1, alignItems: 'center', justifyContent: 'flex-start' },
  // The page reads right to left whatever the language of the interface (spec 2).
  block: { direction: 'rtl' },
  centred: { flex: 1, justifyContent: 'center', paddingHorizontal: layout.screenMargin },
  row: { flexDirection: 'row', alignItems: 'center' },
  spreadRow: { justifyContent: 'space-between' },
  centredRow: { justifyContent: 'center' },
});
