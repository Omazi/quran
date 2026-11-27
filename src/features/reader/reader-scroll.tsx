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
import { splitVerseWords, type VerseRef } from '@/domain/quran';
import type { ReaderScript } from '@/store';

import { READER_CONFIG } from './config';
import { followScrollOffset, type TrackWord, type VerseLook } from './follow-model';
import { PageSectionView } from './page-section-view';
import { scriptTextStyle } from './script-fonts';
import { buildSectionBlocks } from './section-content';
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
  /** While a recitation is followed: how each verse looks (see `PageSectionView`). */
  lookOfVerse?: ((ref: VerseRef, wordCount: number) => VerseLook | null) | null;
  /** The word to keep at the reading line while a recitation is followed. */
  followTarget?: TrackWord | null;
  /** With Reduce Motion, the scroll jumps a line at a time instead of gliding. */
  isMotionReduced?: boolean;
  /**
   * The room kept above the first page and below the last: the text runs the full height of the
   * screen, under the floating controls, and rests clear of them (layout.md › Visual hierarchy).
   */
  contentInset?: { readonly top: number; readonly bottom: number };
}

/**
 * The continuous scroll of the Quran (D41): the 604 pages of the mushaf, one section each, one
 * under the other, in a virtualised list. It opens with the page asked at the top and grows
 * upwards on demand (`READER_CONFIG.list`): the list never measures the pages it has not drawn, so
 * opening on page 604 costs no more than opening on page 1, and the scroll indicator stays honest
 * about what is drawn. Native lists keep the place when pages are added above
 * (`maintainVisibleContentPosition`); the web list does not, so the web preview starts at the page
 * asked and does not add pages above it.
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
  lookOfVerse = null,
  followTarget = null,
  isMotionReduced = false,
  contentInset = NO_INSET,
}: ReaderScrollProps) {
  const sections = sectionsOfTheMushaf();
  const [firstPage, setFirstPage] = useState(initialPage);
  const data = useMemo(() => sections.slice(firstPage - 1), [firstPage, sections]);
  const list = useRef<FlatList<PageSection>>(null);

  const cells = useRef(new Map<number, LayoutRectangle>());
  const segments = useRef(
    new Map<string, { page: number; surah: number; frame: LayoutRectangle }>(),
  );
  const paragraphs = useRef(new Map<string, LayoutRectangle>());
  const viewport = useRef<Viewport | null>(null);
  /** The last offset the following scrolled to, so that it moves once per line. */
  const followedOffset = useRef<number | null>(null);
  /**
   * A layout measured while a voice is followed and nothing was scrolled yet: the first place to
   * scroll to may only be known once the page, its paragraph and the scroll have their sizes.
   */
  const [followLayouts, setFollowLayouts] = useState(0);
  const isAwaitingFollowLayout = useRef(false);
  /** The page of the word followed: when its cell moves (pages added above), the place is redone. */
  const followedPage = useRef<number | null>(null);
  const noteFollowLayout = useCallback(() => {
    if (isAwaitingFollowLayout.current) setFollowLayouts((count) => count + 1);
  }, []);

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
        const before = cells.current.get(page);
        cells.current.set(page, frame);
        if (page === followedPage.current && before !== undefined && before.y !== frame.y) {
          setFollowLayouts((count) => count + 1);
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

  const onParagraphLayout = useCallback(
    (page: number, index: number, frame: LayoutRectangle) => {
      paragraphs.current.set(`${page}:${index}`, frame);
      noteFollowLayout();
    },
    [noteFollowLayout],
  );

  /** Where the scroll goes for the word followed, from what was measured; null if not drawn. */
  const followOffsetOf = useCallback(
    (target: TrackWord): number | null => {
      const cell = cells.current.get(target.page);
      const height = viewport.current?.height;
      if (cell === undefined || height === undefined) return null;
      let blocks;
      try {
        blocks = buildSectionBlocks(sectionsOfTheMushaf()[target.page - 1]!, textOf, script);
      } catch {
        return null;
      }
      let segmentIndex = -1;
      for (const block of blocks) {
        if (block.kind !== 'verses') continue;
        segmentIndex += 1;
        if (block.surah !== target.surah) continue;
        const segment = segments.current.get(`${target.page}:${segmentIndex}`);
        const paragraph = paragraphs.current.get(`${target.page}:${segmentIndex}`);
        if (segment === undefined || paragraph === undefined) return null;
        let before = 0;
        let total = 0;
        for (const verse of block.verses) {
          const words = splitVerseWords(verse.text);
          const length = verse.text.length + verse.mark.length + 2;
          if (verse.verse < target.verse) before += length;
          if (verse.verse === target.verse) {
            before += words.slice(0, Math.min(target.word, words.length)).join(' ').length;
          }
          total += length;
        }
        return followScrollOffset({
          paragraphTop: cell.y + segment.frame.y + paragraph.y,
          paragraphHeight: paragraph.height,
          lineHeight: scriptTextStyle(script).lineHeight * textScale,
          charsBefore: before,
          totalChars: total,
          viewportHeight: height,
        });
      }
      return null;
    },
    [script, textOf, textScale],
  );

  // While a voice is followed, the line of the current word stays at the reading line (spec 3b).
  useEffect(() => {
    followedPage.current = followTarget?.page ?? null;
    if (followTarget === null) {
      followedOffset.current = null;
      isAwaitingFollowLayout.current = false;
      return;
    }
    const offset = followOffsetOf(followTarget);
    isAwaitingFollowLayout.current = offset === null;
    if (offset === null || offset === followedOffset.current) return;
    followedOffset.current = offset;
    list.current?.scrollToOffset({ offset, animated: !isMotionReduced });
  }, [followLayouts, followOffsetOf, followTarget, isMotionReduced]);

  const addPagesAbove = useCallback(() => {
    setFirstPage((current) => Math.max(1, current - READER_CONFIG.list.pagesAddedAbove));
  }, []);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, layoutMeasurement } = event.nativeEvent;
      viewport.current = { top: contentOffset.y, height: layoutMeasurement.height };
      report();
      const nearTop = layoutMeasurement.height * READER_CONFIG.list.nearTopScreens;
      // Pages are added above only where the list keeps its place when they come (iOS, Android:
      // `maintainVisibleContentPosition`; the web list does not and would jump), and never while
      // a followed voice drives the scroll.
      const canAddAbove = Platform.OS !== 'web' && followedPage.current === null;
      if (canAddAbove && contentOffset.y < nearTop && firstPage > 1) addPagesAbove();
    },
    [addPagesAbove, firstPage, report],
  );

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { height } = event.nativeEvent.layout;
      viewport.current = { top: viewport.current?.top ?? 0, height };
      report();
      noteFollowLayout();
    },
    [noteFollowLayout, report],
  );

  // A new script or text size draws every page again: what was measured no longer holds.
  useEffect(() => {
    segments.current.clear();
    paragraphs.current.clear();
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
        onParagraphLayout={onParagraphLayout}
        lookOfVerse={lookOfVerse}
      />
    ),
    [lookOfVerse, onParagraphLayout, onSegmentLayout, onTap, script, textOf, textScale],
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
        extraData={lookOfVerse ?? `${script}:${textScale}`}
        initialNumToRender={READER_CONFIG.list.initialSections}
        windowSize={READER_CONFIG.list.windowSize}
        maintainVisibleContentPosition={MAINTAIN_POSITION}
        onScroll={onScroll}
        scrollEventThrottle={SCROLL_EVENT_INTERVAL_MS}
        onLayout={onLayout}
        removeClippedSubviews={Platform.OS === 'android'}
        contentContainerStyle={{ paddingTop: contentInset.top, paddingBottom: contentInset.bottom }}
      />
    </CellRegistryContext.Provider>
  );
}

const MAINTAIN_POSITION = { minIndexForVisible: 0 } as const;
const NO_INSET = { top: 0, bottom: 0 } as const;

function keyOf(section: PageSection): string {
  return String(section.page);
}
