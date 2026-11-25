import { Image } from '@expo/ui/swift-ui';
import {
  accessibilityHidden,
  accessibilityLabel as accessibilityLabelModifier,
  font,
  foregroundStyle,
} from '@expo/ui/swift-ui/modifiers';

import { appleTextStyles, textStyles, type FontWeightToken } from '../../tokens';
import { useColors } from '../../use-colors';
import type { IconProps } from '../types';
import { SwiftUIHost } from './swiftui-host';

/** SwiftUI's name of each font weight of the text styles. */
const SWIFTUI_WEIGHT = {
  '400': 'regular',
  '600': 'semibold',
  '700': 'bold',
} as const satisfies Record<FontWeightToken, string>;

/** SwiftUI spells Title 1 `title`; React Native spells it `title1`. */
function swiftUITextStyle<Style extends string>(style: Style): Exclude<Style, 'title1'> | 'title' {
  return style === 'title1' ? 'title' : (style as Exclude<Style, 'title1'>);
}

/**
 * An SF Symbol, drawn by SwiftUI in the text style and weight of the neighbouring text
 * (sf-symbols.md › Weights and scales). Being set in a text style, it grows with Dynamic Type
 * exactly as that text does (typography.md › Supporting Dynamic Type), and it takes the
 * right-to-left variant of the symbol by itself. Without a label it is hidden from VoiceOver.
 */
export function Icon({
  symbol,
  textStyle = 'body',
  color = 'label',
  accessibilityLabel,
  testID,
}: IconProps) {
  const colors = useColors();
  return (
    <SwiftUIHost size="content">
      <Image
        systemName={symbol.ios}
        testID={testID}
        modifiers={[
          font({
            textStyle: swiftUITextStyle(appleTextStyles[textStyle]),
            weight: SWIFTUI_WEIGHT[textStyles[textStyle].fontWeight],
          }),
          foregroundStyle(colors[color]),
          accessibilityLabel === undefined
            ? accessibilityHidden()
            : accessibilityLabelModifier(accessibilityLabel),
        ]}
      />
    </SwiftUIHost>
  );
}
