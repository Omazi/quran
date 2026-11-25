import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import {
  FlatList,
  StyleSheet,
  View,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { useReducedMotion } from '@/ui';

import { LAST_PAGE, pageAtPagerIndex, pagerIndexOfPage } from './page-order';

export interface BookPagerProps {
  /** The page shown when the pager opens. */
  initialPage: number;
  /** Size of one page: the pager is exactly one page wide. */
  width: number;
  height: number;
  /** Called when a swipe settles on another page. */
  onPageChange: (page: number) => void;
  renderPage: (page: number) => ReactNode;
  /** False while the page on screen is enlarged: a swipe then moves around it. */
  scrollEnabled?: boolean;
  accessibilityLabel: string;
}

export interface BookPagerHandle {
  /** Shows a page, as a VoiceOver action asks: animated unless motion is reduced. */
  showPage: (page: number) => void;
}

/** The pages from left to right: 604 first, page 1 last (see `pagerIndexOfPage`). */
const PAGER_INDEXES: readonly number[] = Array.from({ length: LAST_PAGE }, (_, index) => index);

/**
 * The pages of the mushaf, one per screen, turned in the direction of the book: the next page
 * comes from the left, in every interface language (spec 2; right-to-left.md: content is not
 * mirrored). The platform's paged list does the swipe, so the page follows the finger and can be
 * caught mid-way (gestures.md › Best practices).
 *
 * Only the page on screen and its two neighbours are mounted (one screen on each side), so a
 * turn is ready before it starts and memory stays flat on an old iPhone (spec 2).
 */
export const BookPager = forwardRef<BookPagerHandle, BookPagerProps>(function BookPager(
  {
    initialPage,
    width,
    height,
    onPageChange,
    renderPage,
    scrollEnabled = true,
    accessibilityLabel,
  },
  ref,
) {
  const list = useRef<FlatList<number>>(null);
  const isMotionReduced = useReducedMotion();

  useImperativeHandle(
    ref,
    () => ({
      showPage: (page: number) =>
        list.current?.scrollToIndex({ index: pagerIndexOfPage(page), animated: !isMotionReduced }),
    }),
    [isMotionReduced],
  );

  const getItemLayout = useCallback(
    (_data: ArrayLike<number> | null | undefined, index: number) => ({
      length: width,
      offset: width * index,
      index,
    }),
    [width],
  );

  const settle = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(event.nativeEvent.contentOffset.x / width);
      const bounded = Math.min(Math.max(index, 0), LAST_PAGE - 1);
      onPageChange(pageAtPagerIndex(bounded));
    },
    [onPageChange, width],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<number>) => (
      <View style={{ width, height }}>{renderPage(pageAtPagerIndex(item))}</View>
    ),
    [height, renderPage, width],
  );

  const initialIndex = useMemo(() => pagerIndexOfPage(initialPage), [initialPage]);

  return (
    <FlatList
      ref={list}
      accessibilityLabel={accessibilityLabel}
      data={PAGER_INDEXES}
      keyExtractor={String}
      renderItem={renderItem}
      getItemLayout={getItemLayout}
      initialScrollIndex={initialIndex}
      horizontal
      pagingEnabled
      scrollEnabled={scrollEnabled}
      showsHorizontalScrollIndicator={false}
      // One screen on each side of the visible page: the page and its two neighbours.
      windowSize={3}
      initialNumToRender={1}
      maxToRenderPerBatch={1}
      removeClippedSubviews
      onMomentumScrollEnd={settle}
      style={styles.pager}
      testID="book-pager"
    />
  );
});

const styles = StyleSheet.create({
  // Fixed left to right: the order of the pages is the book's, not the interface's.
  pager: { flex: 1, direction: 'ltr' },
});
