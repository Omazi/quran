import { Host } from '@expo/ui/swift-ui';
import { createContext, useContext, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { getWritingDirection } from '../../direction';

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
 * already the host. The system gives the content its appearance, text size and contrast; the
 * writing direction is passed on from React Native.
 */
export function SwiftUIHost({ size, children }: SwiftUIHostProps) {
  const insideSwiftUI = useIsInsideSwiftUI();
  if (insideSwiftUI) return <>{children}</>;
  return (
    <Host
      matchContents={
        size === 'content' ? true : size === 'contentHeight' ? { vertical: true } : false
      }
      layoutDirection={getWritingDirection() === 'rtl' ? 'rightToLeft' : 'leftToRight'}
      style={size === 'content' ? undefined : size === 'fill' ? styles.fill : styles.stretch}
    >
      <InsideSwiftUI.Provider value>{children}</InsideSwiftUI.Provider>
    </Host>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  stretch: { alignSelf: 'stretch' },
});
