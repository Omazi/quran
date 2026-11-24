import { TabView } from '@expo/ui/swift-ui';
import { indexViewStyle, tabViewStyle } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet, View } from 'react-native';

import { layout } from '../../tokens';
import { Pager as DefaultPager } from '../default/pager';
import type { PagerProps } from '../types';
import { assertPagePosition } from '../validation';
import { IOS_USES_SYSTEM_PAGER } from './pager-settings';
import { ReactNativeContent, SwiftUIHost } from './swiftui-host';

/**
 * The system pager: SwiftUI's `TabView` in its page style, one swipe for one page, with the
 * system page indicator centred at the bottom, always shown and never coloured
 * (page-controls.md › Best practices, › Customizing indicators). The indicator keeps its
 * background, the style for a page control that is the main way to navigate a screen
 * (page-controls.md › Mobile). The system mirrors the pager in a right-to-left interface and
 * describes its own indicator to VoiceOver: the two accessibility strings are not used here.
 *
 * Each page is React Native content. It keeps clear of the indicator, which lies over the bottom
 * of the pages.
 */
export function Pager(props: PagerProps) {
  if (!IOS_USES_SYSTEM_PAGER) return <DefaultPager {...props} />;
  return <SystemPager {...props} />;
}

function SystemPager({ pageCount, page, onPageChange, renderPage, testID }: PagerProps) {
  assertPagePosition({ count: pageCount, index: page });
  const pages = Array.from({ length: pageCount }, (_, index) => index);
  return (
    <SwiftUIHost size="fill">
      <TabView
        selection={String(page)}
        onSelectionChange={(selection) => onPageChange(Number(selection))}
        testID={testID}
        modifiers={[
          tabViewStyle({ type: 'page', indexDisplayMode: 'always' }),
          indexViewStyle({ backgroundDisplayMode: 'always' }),
        ]}
      >
        {pages.map((index) => (
          <TabView.Tab key={index} value={String(index)}>
            <ReactNativeContent>
              <View style={styles.page}>{renderPage(index)}</View>
            </ReactNativeContent>
          </TabView.Tab>
        ))}
      </TabView>
    </SwiftUIHost>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingBottom: layout.touchTarget },
});
