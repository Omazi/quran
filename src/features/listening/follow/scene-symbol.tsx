import { SymbolView } from 'expo-symbols';
import { Platform, useWindowDimensions } from 'react-native';

import { getWritingDirection, type IconSymbol } from '@/ui';

export interface SceneSymbolProps {
  readonly symbol: IconSymbol;
  /** Size in points at the default text size; it grows with the person's text size. */
  readonly size: number;
  /** A colour of the listening palette. */
  readonly color: string;
  /**
   * The symbol shows a direction (back): it points the other way in Arabic
   * (right-to-left.md › Controls). SF Symbols turn by themselves; Material Symbols are turned.
   */
  readonly isDirectional?: boolean;
  readonly testID?: string;
}

/**
 * A system symbol in a colour of the mockups: an SF Symbol on iOS, a Material Symbol elsewhere
 * (`Icon` takes the charter's roles only). Always decorative: the control around it carries the
 * label (voiceover.md › Content descriptions).
 */
export function SceneSymbol({
  symbol,
  size,
  color,
  isDirectional = false,
  testID,
}: SceneSymbolProps) {
  const { fontScale } = useWindowDimensions();
  const isTurned = isDirectional && Platform.OS !== 'ios' && getWritingDirection() === 'rtl';
  return (
    <SymbolView
      name={{ ios: symbol.ios, android: symbol.android, web: symbol.android }}
      size={size * fontScale}
      weight="semibold"
      tintColor={color}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={isTurned ? { transform: [{ scaleX: -1 }] } : undefined}
      testID={testID}
    />
  );
}
