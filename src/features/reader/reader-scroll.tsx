import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  FlatList,
  Platform,
  View,
  type LayoutChangeEvent,
  type LayoutRectangle,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

import { quranStructure } from '@/data/quran';
import type { VerseRef } from '@/domain/quran';
import type { ReaderScript } from '@/store';

import { READER_CONFIG } from './config';
import { PageSectionView } from './page-section-view';
import type { SegmentExtent, Viewport } from './reading-place';
import { pageSections, type PageSection } from './reading-sections';
import type { SectionExtent } from './scroll-reading';
import type { MeasuredExtents } from './use-reader';

/** The 604 sections, built once from the structure of the mushaf. */
let allSections: readonly PageSection[] | null = null;
function sectionsOfTheMushaf(): readonly PageSection[] {
  allSections ??= pageSections(quranStructure);
  return allSections;
}

/** Every scroll event is a look at the screen (`useReader().observe`): about 30 per second. */
const SCROLL_EVENT_INTERVAL_MS = 32;

/** Where the cells of the list lie in its content, reported by `PageCell`. */
interface CellRegistry {
  readonly report: (page: number, frame: LayoutRectangle | null) => void;
}
const CellRegistryContext = createContext<CellRegistry | null>(null);

interface PageCellProps {
  item: PageSection;
  onLayout?: (event: LayoutChangeEvent) => void;
  onFocusCapture?: ViewProps['onFocusCapture'];
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/**
 * The cell of a page: the list's own cell, which also tells the reader where the page lies in the
 * content (FlatList `CellRendererComponent` passes the list's `onLayout`, which must be kept).
 */
function PageCell({ item, onLayout, onFocusCapture, style, children }: PageCellProps) {
  const registry = useContext(CellRegistryContext);
  useEffect(() => () => registry?.report(item.page, null), [item.page, registry]);
  return (
    <View
      style={style}
      onFocusCapture={onFocusCapture}
      testID={`page-cell-${item.page}`}
      onLayout={(event) => {
        onLayout?.(event);
        registry?.report(item.page, event.nativeEvent.layout);
      }}
    >
      {children}
    </View>
  );
}

export interface ReaderScrollProps {
  /** The page the list opens on, at the top. */
  initialPage: number;
  script: ReaderScript;
  textScale: number;
  textOf: (ref: VerseRef) => string;
  onObserve: (viewport: Viewport, extents: MeasuredExtents) => void;
  onTap: () => void;
  accessibilityLabel: string;
}

/**
 * The continuous scroll of the Quran (D41): the 604 pages of the mushaf, one section each, one
 * under the other, in a virtualised list. It opens with the page asked at the top and grows
 * upwards on demand (`READER_CONFIG.list`): the list never measures the pages it has not drawn, so
 * opening on page 604 costs no more than opening on page 1, and the scroll indicator stays honest
 * about what is drawn. Native lists keep the place when pages are added above
 * (`maintainVisibleContentPosition`); the web list does not, so the offset is moved by the height
 * added.
 *
 * It reports what is on screen on every scroll event and every layout change: the reader decides
 * from it what the bar says and which pages count.
 */
export function ReaderScroll({
  initialPage,
  script,
  textScale,
  textOf,
  onObserve,
  onTap,
  accessibilityLabel,
}: ReaderScrollProps) {
  const sections = sectionsOfTheMushaf();
  const [firstPage, setFirstPage] = useState(initialPage);
  const data = useMemo(() => sections.slice(firstPage - 1), [firstPage, sections]);
  const list = useRef<FlatList<PageSection>>(null);

  const cells = useRef(new Map<number, LayoutRectangle>());
  const segments = useRef(
    new Map<string, { page: number; surah: number; frame: LayoutRectangle }>(),
  );
  const viewport = useRef<Viewport | null>(null);
  /** On the web, the page that was first before pages were added above, and where it was. */
  const anchor = useRef<{ page: number; top: number; offset: number } | null>(null);

  const measured = useCallback((): MeasuredExtents => {
    const sectionExtents: SectionExtent[] = [];
    for (const [page, frame] of cells.current) {
      sectionExtents.push({ page, top: frame.y, bottom: frame.y + frame.height });
    }
    const segmentExtents: SegmentExtent[] = [];
    for (const { page, surah, frame } of segments.current.values()) {
      const cell = cells.current.get(page);
      if (cell === undefined) continue;
      const top = cell.y + frame.y;
      segmentExtents.push({ page, surah, top, bottom: top + frame.height });
    }
    return { sections: sectionExtents, segments: segmentExtents };
  }, []);

  const report = useCallback(() => {
    if (viewport.current !== null) onObserve(viewport.current, measured());
  }, [measured, onObserve]);

  const registry = useMemo<CellRegistry>(
    () => ({
      report: (page, frame) => {
        if (frame === null) {
          cells.current.delete(page);
          return;
        }
        cells.current.set(page, frame);
        const pending = anchor.current;
        if (Platform.OS === 'web' && pending !== null && pending.page === page) {
          anchor.current = null;
          list.current?.scrollToOffset({
            offset: pending.offset + frame.y - pending.top,
            animated: false,
          });
        }
        report();
      },
    }),
    [report],
  );

  const onSegmentLayout = useCallback(
    (page: number, index: number, surah: number, frame: LayoutRectangle) => {
      segments.current.set(`${page}:${index}`, { page, surah, frame });
      report();
    },
    [report],
  );

  const addPagesAbove = useCallback(() => {
    setFirstPage((current) => {
      if (current <= 1) return current;
      const cell = cells.current.get(current);
      if (Platform.OS === 'web' && cell !== undefined && viewport.current !== null) {
        anchor.current = { page: current, top: cell.y, offset: viewport.current.top };
      }
      return Math.max(1, current - READER_CONFIG.list.pagesAddedAbove);
    });
  }, []);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, layoutMeasurement } = event.nativeEvent;
      viewport.current = { top: contentOffset.y, height: layoutMeasurement.height };
      report();
      const nearTop = layoutMeasurement.height * READER_CONFIG.list.nearTopScreens;
      if (contentOffset.y < nearTop && firstPage > 1 && anchor.current === null) addPagesAbove();
    },
    [addPagesAbove, firstPage, report],
  );

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { height } = event.nativeEvent.layout;
      viewport.current = { top: viewport.current?.top ?? 0, height };
      report();
    },
    [report],
  );

  // A new script or text size draws every page again: what was measured no longer holds.
  useEffect(() => {
    segments.current.clear();
  }, [script, textScale]);

  const renderItem = useCallback(
    ({ item }: { item: PageSection }) => (
      <PageSectionView
        page={item.page}
        script={script}
        textScale={textScale}
        textOf={textOf}
        onTap={onTap}
        onSegmentLayout={onSegmentLayout}
      />
    ),
    [onSegmentLayout, onTap, script, textOf, textScale],
  );

  return (
    <CellRegistryContext.Provider value={registry}>
      <FlatList
        ref={list}
        testID="reader-scroll"
        accessibilityLabel={accessibilityLabel}
        data={data}
        keyExtractor={keyOf}
        renderItem={renderItem}
        CellRendererComponent={PageCell}
        extraData={`${script}:${textScale}`}
        initialNumToRender={READER_CONFIG.list.initialSections}
        windowSize={READER_CONFIG.list.windowSize}
        maintainVisibleContentPosition={MAINTAIN_POSITION}
        onScroll={onScroll}
        scrollEventThrottle={SCROLL_EVENT_INTERVAL_MS}
        onLayout={onLayout}
        removeClippedSubviews={Platform.OS === 'android'}
      />
    </CellRegistryContext.Provider>
  );
}

const MAINTAIN_POSITION = { minIndexForVisible: 0 } as const;

function keyOf(section: PageSection): string {
  return String(section.page);
}
