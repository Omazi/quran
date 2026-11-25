import type { ReactNode } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

import { appleTextStyles, textStyles, type TextStyleName } from '@/ui/tokens';

export type SceneTextVariant = TextStyleName;

export interface SceneTextProps {
  readonly children: ReactNode;
  readonly variant: SceneTextVariant;
  /** A colour of the listening palette (`useListeningColors`). */
  readonly color: string;
  readonly align?: 'start' | 'center' | 'end';
  /** The title of the screen or of the card: screen readers can move to it. */
  readonly isHeading?: boolean;
  readonly numberOfLines?: number;
  /** Layout only (flex, margins). */
  readonly style?: StyleProp<TextStyle>;
  readonly testID?: string;
}

function styleOf(variant: SceneTextVariant) {
  return { token: textStyles[variant], ramp: appleTextStyles[variant] };
}

/**
 * Interface text of the voice-following view, in the colours of the mockup, which are not roles
 * of the charter (`AppText` takes roles only). San Francisco, a text style of Apple's, and its
 * Dynamic Type ramp, so it grows with the person's text size (typography.md › Supporting Dynamic
 * Type). Not for Quran text.
 */
export function SceneText({
  children,
  variant,
  color,
  align = 'start',
  isHeading = false,
  numberOfLines,
  style,
  testID,
}: SceneTextProps) {
  const { token, ramp } = styleOf(variant);
  return (
    <Text
      accessibilityRole={isHeading ? 'header' : undefined}
      dynamicTypeRamp={ramp}
      numberOfLines={numberOfLines}
      testID={testID}
      style={[
        style,
        {
          fontSize: token.fontSize,
          lineHeight: token.lineHeight,
          fontWeight: token.fontWeight,
          color,
          textAlign: align,
        },
      ]}
    >
      {children}
    </Text>
  );
}
