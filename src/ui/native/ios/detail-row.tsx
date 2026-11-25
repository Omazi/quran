import {
  Button as SwiftUIButton,
  HStack,
  Image,
  LabeledContent,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import { accessibilityHidden, font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';

import { appleTextStyles, fontFamily, spacing, textStyles } from '../../tokens';
import { useColors } from '../../use-colors';
import { useGroupedListGuard } from '../grouped-list-scope';
import type { DetailRowProps } from '../types';

/** The system's own label levels, which adapt to their context (labels.md › Best practices). */
const PRIMARY = foregroundStyle({ type: 'hierarchical', style: 'primary' });
const SECONDARY = foregroundStyle({ type: 'hierarchical', style: 'secondary' });
const TERTIARY = foregroundStyle({ type: 'hierarchical', style: 'tertiary' });

/**
 * A row of two lines that opens something: the label, a detail line under it in the secondary
 * level, an optional value, and the disclosure indicator (lists-and-tables.md › Mobile). As for
 * `ListRow`, the system draws its own indicator only for a navigation link, which needs a SwiftUI
 * navigation stack the app does not have: the row is a button ending with `chevron.forward`,
 * which points the other way in Arabic (deviation 7 of the register).
 */
export function DetailRow({
  label,
  detail,
  value,
  valueStyle = 'standard',
  onPress,
  testID,
}: DetailRowProps) {
  useGroupedListGuard('DetailRow');
  const colors = useColors();
  // A Quran value is drawn in the Quran font, in ink, at the size of Title 2, and grows with the
  // person's text size (`Font.custom(_:size:relativeTo:)`; typography.md › Supporting Dynamic Type).
  const valueModifiers =
    valueStyle === 'quran'
      ? [
          font({
            family: fontFamily.quranPostScript,
            size: textStyles.title2.fontSize,
            textStyle: appleTextStyles.title2,
          }),
          foregroundStyle(colors.ink),
        ]
      : undefined;
  return (
    <SwiftUIButton onPress={onPress} testID={testID}>
      <LabeledContent
        label={
          <VStack alignment="leading" spacing={spacing.xs}>
            <Text modifiers={[PRIMARY]}>{label}</Text>
            <Text modifiers={[font({ textStyle: appleTextStyles.subhead }), SECONDARY]}>
              {detail}
            </Text>
          </VStack>
        }
      >
        <HStack spacing={spacing.sm}>
          {value === undefined ? null : <Text modifiers={valueModifiers}>{value}</Text>}
          <Image
            systemName="chevron.forward"
            modifiers={[
              font({ textStyle: appleTextStyles.footnote, weight: 'semibold' }),
              TERTIARY,
              accessibilityHidden(),
            ]}
          />
        </HStack>
      </LabeledContent>
    </SwiftUIButton>
  );
}
