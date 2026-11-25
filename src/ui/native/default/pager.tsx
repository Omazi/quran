import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ViewProps,
  type ListViewToken,
} from 'react-native';

import { useReducedMotion } from '../../device-settings';
import { PageIndicator } from '../page-indicator';
import type { PagerProps } from '../types';
import { assertPagePosition } from '../validation';

/** A page is the one shown once it covers more than half of the pager. */
const SHOWN_PAGE_COVERAGE_PERCENT = 51;

/**
 * Default pager, for Android, the web and tests: the platform's paging scroll view, one swipe
 * for one page, with the drawn page indicator centred under it
 * (page-controls.md › Best practices).
 *
 * The page comes from what the list reports as visible, not from scroll offsets, so it is the
 * same in a right-to-left interface, where the list starts from the right. Moving to a page
 * asked from outside (the indicator, a screen reader) slides, or jumps when the person asked
 * the device to reduce motion (accessibility.md › Cognitive).
 *
 * Every page has the width and the height of the pager, as the pages of the system pager have.
 */
export function Pager({
  pageCount,
  page,
  onPageChange,
  renderPage,
  accessibilityLabel,
  accessibilityValue,
  testID,
}: PagerProps) {
  assertPagePosition({ count: pageCount, index: page });
  const isMotionReduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const list = useRef<FlatList<number>>(null);
  /** The page the list shows: the last one it reported, or the last one asked of it. */
  const shownPage = useRef(page);
  /**
   * False while the list is on its way to a page it was asked to show: at the start when that
   * page is not the first, and during a slide. The pages it passes on the way are not the
   * person's choice and are not reported.
   */
  const hasArrived = useRef(page === 0);
  const shownWidth = useRef(0);
  const latestOnPageChange = useRef(onPageChange);
  useEffect(() => {
    latestOnPageChange.current = onPageChange;
  });

  // The list requires this pair to stay the same object for its whole life.
  const [viewabilityPairs] = useState(() => [
    {
      viewabilityConfig: { itemVisiblePercentThreshold: SHOWN_PAGE_COVERAGE_PERCENT },
      onViewableItemsChanged: ({ viewableItems }: { viewableItems: ListViewToken[] }) => {
        const visiblePage = viewableItems[0]?.index;
        if (visiblePage === undefined || visiblePage === null) return;
        if (visiblePage === shownPage.current) {
          hasArrived.current = true;
          return;
        }
        if (!hasArrived.current) return;
        shownPage.current = visiblePage;
        latestOnPageChange.current(visiblePage);
      },
    },
  ]);

  useEffect(() => {
    if (width === 0) return;
    const hasWidthChanged = shownWidth.current !== 0 && shownWidth.current !== width;
    shownWidth.current = width;
    if (page === shownPage.current && !hasWidthChanged) return;
    shownPage.current = page;
    hasArrived.current = false;
    // After a change of width the list is only put back in place: nothing has to move.
    list.current?.scrollToIndex({ index: page, animated: !isMotionReduced && !hasWidthChanged });
  }, [page, width, isMotionReduced]);

  const pages = useMemo(() => Array.from({ length: pageCount }, (_, index) => index), [pageCount]);
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  return (
    <View style={styles.pager} testID={testID}>
      <View style={styles.pages} onLayout={onLayout}>
        {width === 0 ? null : (
          <FlatList
            ref={list}
            data={pages}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={page}
            getItemLayout={(_data, index) => ({ length: width, offset: width * index, index })}
            keyExtractor={String}
            CellRendererComponent={PageCell}
            renderItem={({ item }) => <View style={{ width }}>{renderPage(item)}</View>}
            viewabilityConfigCallbackPairs={viewabilityPairs}
            // A person who starts to drag takes over from any slide in progress.
            onScrollBeginDrag={() => {
              hasArrived.current = true;
            }}
          />
        )}
      </View>
      <PageIndicator
        count={pageCount}
        index={page}
        onChange={onPageChange}
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={accessibilityValue}
        testID={testID === undefined ? undefined : `${testID}-indicator`}
      />
    </View>
  );
}

/**
 * The frame of a page in the list. A list of pages does not give its cells the height of the
 * list on every platform (on the web a cell is only as high as its content): without this a page
 * that lays itself out in the height it is given, a scene above its words, gets the height of
 * its content instead. The page has no height of its own written here: it takes the list's.
 */
function PageCell({
  children,
  style,
  onLayout,
}: Pick<ViewProps, 'children' | 'style' | 'onLayout'>) {
  return (
    <View style={[style, styles.pageCell]} onLayout={onLayout}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  pager: { flex: 1 },
  pageCell: { flex: 1 },
  pages: { flex: 1 },
});
