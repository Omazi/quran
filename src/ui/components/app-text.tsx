import { Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';

import { appleTextStyles, textStyles, type ColorRole, type TextStyleName } from '../tokens';
import { useColors } from '../use-colors';

/** Alignment relative to the writing direction: `start` is the right edge in Arabic. */
export type TextAlignment = 'start' | 'center' | 'end';

/**
 * Text size follows the person's setting and cannot be switched off or capped from a feature
 * (typography.md › Supporting Dynamic Type), hence the omitted props.
 */
export interface AppTextProps extends Omit<
  TextProps,
  'allowFontScaling' | 'dynamicTypeRamp' | 'maxFontSizeMultiplier' | 'style'
> {
  /** One of the charter's text styles. Defaults to body. */
  variant?: TextStyleName;
  /** A colour role. Defaults to the primary label colour. */
  color?: ColorRole;
  /** Defaults to `start`, which follows the writing direction. */
  align?: TextAlignment;
  /** Layout only (flex, margins). Font, size, colour and alignment always come from the props. */
  style?: StyleProp<TextStyle>;
}

/** San Francisco, the platform font, unless the text style names the system serif. */
const SYSTEM_FONT = { fontFamily: undefined };

/** The two title styles are headings for screen readers (voiceover.md › Navigation). */
const HEADING_VARIANTS: ReadonlySet<TextStyleName> = new Set(['largeTitle', 'title2']);

/**
 * The text component of the interface: one variant per text style of the charter.
 * Not for Quran text, which keeps its own fonts and is rendered as the data layer provides it.
 */
export function AppText({
  variant = 'body',
  color = 'label',
  align = 'start',
  accessibilityRole,
  style,
  ...rest
}: AppTextProps) {
  const colors = useColors();
  return (
    <Text
      accessibilityRole={
        accessibilityRole ?? (HEADING_VARIANTS.has(variant) ? 'header' : undefined)
      }
      {...rest}
      dynamicTypeRamp={appleTextStyles[variant]}
      style={[style, SYSTEM_FONT, textStyles[variant], { color: colors[color], textAlign: align }]}
    />
  );
}
