import { SymbolView, type SymbolWeight } from 'expo-symbols';
import { useWindowDimensions } from 'react-native';

import { textStyles, type FontWeightToken } from '../../tokens';
import { useColors } from '../../use-colors';
import type { IconProps } from '../types';

/** The symbol weight that matches each font weight of the text styles. */
const SYMBOL_WEIGHT: Record<FontWeightToken, SymbolWeight> = {
  '400': 'regular',
  '600': 'semibold',
  '700': 'bold',
};

/**
 * Default icon, for Android, the web and tests: a Material Symbol, drawn by `expo-symbols`. It
 * takes the size of the neighbouring text and grows with the device's font scale, which Android
 * applies to every text alike (typography.md › Supporting Dynamic Type). No emoji, no drawing.
 */
export function Icon({
  symbol,
  textStyle = 'body',
  color = 'label',
  accessibilityLabel,
  testID,
}: IconProps) {
  const colors = useColors();
  const { fontScale } = useWindowDimensions();
  const style = textStyles[textStyle];
  const isDecorative = accessibilityLabel === undefined;
  return (
    <SymbolView
      name={{ ios: symbol.ios, android: symbol.android, web: symbol.android }}
      size={style.fontSize * fontScale}
      weight={SYMBOL_WEIGHT[style.fontWeight]}
      tintColor={colors[color]}
      accessible={!isDecorative}
      accessibilityRole={isDecorative ? undefined : 'image'}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={isDecorative}
      importantForAccessibility={isDecorative ? 'no-hide-descendants' : 'yes'}
      testID={testID}
    />
  );
}
