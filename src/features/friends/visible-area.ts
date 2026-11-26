import {
  useCallback,
  useContext,
  useRef,
  useState,
  type ComponentRef,
  type RefObject,
} from 'react';
import { useWindowDimensions, type LayoutChangeEvent, type View } from 'react-native';
import { HeaderHeightContext } from 'expo-router/react-navigation';

import { useSafeInsets } from '@/ui';

/** Where the bars leave a page visible: what they cover at its top and bottom, and the rest. */
export interface VisibleArea {
  readonly top: number;
  readonly bottom: number;
  readonly height: number;
}

export interface VisibleAreaInput {
  readonly windowHeight: number;
  /** The navigation bar, status bar included (react-navigation's header height). */
  readonly headerHeight: number;
  /** The safe area at the bottom of the tab: the tab bar and the home indicator on iOS. */
  readonly bottomInset: number;
  /** The page's top in the window, and its height; null before the first measure. */
  readonly pageTop: number | null;
  readonly pageHeight: number | null;
}

/**
 * The part of a page the bars leave visible. Whether the page runs under a bar or starts beside
 * it depends on the platform and on the bar (an opaque navigation bar on iOS, a tab bar laid out
 * under the page on Android and the web): the page's measured place in the window says which, so
 * nothing is taken off twice (layout.md › Guides and safe areas). Before the page is measured, it
 * is taken as the whole window, under both bars.
 */
export function visibleAreaOf(input: VisibleAreaInput): VisibleArea {
  const pageTop = input.pageTop ?? 0;
  const pageHeight = input.pageHeight ?? input.windowHeight - pageTop;
  const top = Math.max(0, input.headerHeight - pageTop);
  const tabBarTop = input.windowHeight - input.bottomInset;
  const bottom = Math.max(0, pageTop + pageHeight - tabBarTop);
  return { top, bottom, height: Math.max(0, pageHeight - top - bottom) };
}

/**
 * The visible area of the page whose root view takes `ref` and `onLayout`: measured in the
 * window at each layout, with the navigation bar of the stack (`HeaderHeightContext`; none outside
 * a stack) and the bottom safe area of the tab (`useSafeInsets`, the tab bar included on iOS).
 */
export function useVisibleArea(): {
  readonly area: VisibleArea;
  readonly ref: RefObject<ComponentRef<typeof View> | null>;
  readonly onLayout: (event: LayoutChangeEvent) => void;
} {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const headerHeight = useContext(HeaderHeightContext) ?? 0;
  const { bottom: bottomInset } = useSafeInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [page, setPage] = useState<{ top: number | null; height: number | null }>({
    top: null,
    height: null,
  });
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setPage((current) => ({ ...current, height }));
    ref.current?.measureInWindow((_x: number, y: number) => setPage({ top: y, height }));
  }, []);
  return {
    area: visibleAreaOf({
      windowHeight,
      headerHeight,
      bottomInset,
      pageTop: page.top,
      pageHeight: page.height,
    }),
    ref,
    onLayout,
  };
}
