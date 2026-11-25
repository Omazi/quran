import { Host, RNHostView } from '@expo/ui/swift-ui';
import { createContext, useContext, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { getWritingDirection } from '../../direction';
import { useColors } from '../../use-colors';

/** True below a SwiftUI host: a control found there is drawn as it is, without a host of its own. */
const InsideSwiftUI = createContext(false);

/**
 * How the SwiftUI content takes its place in the React Native layout.
 * `content`: the host takes the size of its content. `contentHeight`: it takes the width it is
 * given and the height of its content. `fill`: it takes the size it is given.
 */
export type HostSize = 'content' | 'contentHeight' | 'fill';

/** Whether the caller is drawn inside a SwiftUI host, such as a row of a `GroupedList`. */
export function useIsInsideSwiftUI(): boolean {
  return useContext(InsideSwiftUI);
}

interface SwiftUIHostProps {
  size: HostSize;
  children: ReactNode;
}

/**
 * The boundary between React Native and SwiftUI. Every control of this folder goes through it,
 * so the same control works alone on a screen and inside a `GroupedList`, where the list is
 * already the host.
 *
 * The host is also the one place where the app's action colour is given to SwiftUI, as the tint
 * of everything below: the system then applies it where it uses an accent, such as the background
 * of a prominent button (color.md › Liquid Glass color). It is the forest green of the validated
 * mockups (owner's decision, 25 November 2026), lighter at night so that it reads on a dark
 * background; the water's teal keeps the water's meaning only. The system gives the content its
 * appearance, text size and contrast; the writing direction is passed on from React Native.
 */
export function SwiftUIHost({ size, children }: SwiftUIHostProps) {
  const insideSwiftUI = useIsInsideSwiftUI();
  const colors = useColors();
  if (insideSwiftUI) return <>{children}</>;
  return (
    <Host
      matchContents={
        size === 'content' ? true : size === 'contentHeight' ? { vertical: true } : false
      }
      layoutDirection={getWritingDirection() === 'rtl' ? 'rightToLeft' : 'leftToRight'}
      seedColor={colors.actionTint}
      style={size === 'content' ? undefined : size === 'fill' ? styles.fill : styles.stretch}
    >
      <InsideSwiftUI.Provider value>{children}</InsideSwiftUI.Provider>
    </Host>
  );
}

interface ReactNativeContentProps {
  /**
   * `fill` (default): the content takes the size SwiftUI gives it. `content`: it takes the width
   * SwiftUI gives it and the height it needs, which SwiftUI then follows.
   */
  height?: 'fill' | 'content';
  /** Makes the content one element for VoiceOver, with this label. */
  accessibilityLabel?: string;
  testID?: string;
  children: ReactNode;
}

/**
 * React Native content placed inside a SwiftUI view. Below it the tree is React Native again: a
 * control found there needs a host of its own.
 */
export function ReactNativeContent({
  height = 'fill',
  accessibilityLabel,
  testID,
  children,
}: ReactNativeContentProps) {
  return (
    <RNHostView matchContents={height === 'content' ? { vertical: true } : false}>
      <View
        accessible={accessibilityLabel !== undefined}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        style={height === 'content' ? undefined : styles.fill}
      >
        <InsideSwiftUI.Provider value={false}>{children}</InsideSwiftUI.Provider>
      </View>
    </RNHostView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  stretch: { alignSelf: 'stretch' },
});
