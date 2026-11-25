import { memo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  type LayoutChangeEvent,
} from 'react-native';

import { quranStructure } from '@/data/quran';
import {
  ContentUnavailable,
  ProgressIndicator,
  fontFamily,
  layout,
  radius,
  useColors,
  type IconSymbol,
} from '@/ui';

import { READER_CONFIG } from './config';
import type { PageLine, PageItem } from './page-content';
import { fitLine, type PageMetrics } from './page-layout';
import { useMushafPage } from './use-mushaf-page';

const ERROR_SYMBOL: IconSymbol = { ios: 'exclamationmark.triangle', android: 'warning' };
/** Pages 1 and 2 are printed with short centred lines (docs/specs/quran.md, invariants). */
const LAST_CENTRED_PAGE = 2;

/** VoiceOver actions offered on every line: the page can be turned without a swipe. */
export interface PageTurnActions {
  readonly actions: readonly AccessibilityActionInfo[];
  readonly onAction: (event: AccessibilityActionEvent) => void;
}

export interface MushafPageViewProps {
  page: number;
  metrics: PageMetrics;
  onTap: () => void;
  turnActions: PageTurnActions;
}

/**
 * One page of the mushaf: its lines, in order, each as wide as the column, on the paper of the
 * page (spec 2). Memoised: the pager mounts the current page and its neighbours, and a page
 * already drawn does not draw again while the person reads.
 */
export const MushafPageView = memo(function MushafPageView({
  page,
  metrics,
  onTap,
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
  const isCentred = page <= LAST_CENTRED_PAGE;
  return (
    // A tap shows or hides the bars. Not a button for screen readers: its lines stay readable
    // one by one, and VoiceOver keeps the bars on screen anyway.
    <Pressable
      accessible={false}
      onPress={onTap}
      style={styles.page}
      testID={`mushaf-page-${page}`}
    >
      <View style={[styles.block, { width: metrics.textWidth }]}>
        {state.lines.map((line, index) => (
          <MushafLine
            // Lines never move within a page: their position is their identity.
            key={index}
            line={line}
            metrics={metrics}
            isCentred={isCentred}
            turnActions={turnActions}
          />
        ))}
      </View>
    </Pressable>
  );
});

interface MushafLineProps {
  line: PageLine;
  metrics: PageMetrics;
  isCentred: boolean;
  turnActions: PageTurnActions;
}

function MushafLine({ line, metrics, isCentred, turnActions }: MushafLineProps) {
  const { t } = useTranslation('reader');
  const colors = useColors();
  const row = { height: metrics.lineHeight };
  if (line.kind === 'surah-header') {
    const name = quranStructure.surah(line.surah).nameArabic;
    return (
      <View style={[styles.row, row]}>
        <View
          accessible
          accessibilityRole="header"
          accessibilityLanguage="ar"
          accessibilityActions={turnActions.actions}
          onAccessibilityAction={turnActions.onAction}
          style={[
            styles.cartouche,
            {
              height: metrics.lineHeight * READER_CONFIG.surahHeaderHeightRatio,
              borderColor: colors.ornament,
            },
          ]}
        >
          <Text
            allowFontScaling={false}
            style={{
              fontFamily: fontFamily.quranTitle,
              fontSize: metrics.fontSize,
              color: colors.ink,
            }}
          >
            {t('page.surahTitle', { name })}
          </Text>
        </View>
      </View>
    );
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
 * A line of text. Each word and verse mark is its own element, and the line spreads them across
 * the column: the space between words grows, the words stay as they are (spec, "Exigence
 * absolue"). Once every item has been laid out, a line wider than the column is drawn smaller
 * until it fits (`fitLine`); most lines keep the page's size. It is one element for VoiceOver,
 * which reads its words in Arabic.
 */
function TextLine({ items, spokenText, metrics, isCentred, turnActions }: TextLineProps) {
  const [scale, setScale] = useState(1);
  const widths = useRef<(number | undefined)[]>([]);
  const isMeasured = useRef(false);

  const measure = (index: number) => (event: LayoutChangeEvent) => {
    if (isMeasured.current) return;
    widths.current[index] = event.nativeEvent.layout.width;
    const measured = widths.current.filter((width): width is number => width !== undefined);
    if (measured.length < items.length) return;
    isMeasured.current = true;
    setScale(
      fitLine({
        itemWidths: measured,
        available: metrics.textWidth,
        minimumGap: metrics.minimumGap,
      }).scale,
    );
  };

  const fontSize = metrics.fontSize * scale;
  const spread = !isCentred && items.length > 1;
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
        spread ? styles.spreadRow : [styles.centredRow, { columnGap: metrics.minimumGap * scale }],
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
  page: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // The page reads right to left whatever the language of the interface (spec 2).
  block: { direction: 'rtl' },
  centred: { flex: 1, justifyContent: 'center', paddingHorizontal: layout.screenMargin },
  row: { flexDirection: 'row', alignItems: 'center' },
  spreadRow: { justifyContent: 'space-between' },
  centredRow: { justifyContent: 'center' },
  // The surah header: the name in a frame of one rule. A drawn ornate frame needs an image,
  // which does not exist (spec 2, D12).
  cartouche: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: layout.outlineWidth,
    borderRadius: radius.sm,
  },
});
