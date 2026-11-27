import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { GlassSurface, glassVeilMinimum, useAppearance } from '@/ui';

/**
 * A capsule of glass over the reader's page (maquette-wow, `.glass`): the design system's floating
 * glass (the system's Liquid Glass where it exists, the app's elsewhere, opaque with Reduce
 * Transparency), in the appearance of the page. Text scrolls under it, so where the app draws the
 * glass itself its tint is the panel's, the thicker one (liquid-glass.md › Which variant: regular
 * for anything over text).
 */
export function ReaderGlass({
  children,
  style,
  testID,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const appearance = useAppearance();
  return (
    <GlassSurface
      appearance={appearance}
      shape="capsule"
      veil={glassVeilMinimum.panel[appearance]}
      style={style}
      testID={testID}
    >
      {children}
    </GlassSurface>
  );
}
