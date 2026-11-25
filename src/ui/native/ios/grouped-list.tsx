import {
  Button as SwiftUIButton,
  Form,
  HStack,
  Image,
  Label,
  LabeledContent,
  Section,
  Spacer,
  Text,
} from '@expo/ui/swift-ui';
import {
  accessibilityHidden,
  accessibilityLabel,
  font,
  foregroundStyle,
  headerProminence,
  scrollContentBackground,
} from '@expo/ui/swift-ui/modifiers';
import { StyleSheet, View } from 'react-native';

import { appleTextStyles, fontFamily, spacing, textStyles } from '../../tokens';
import { useColors } from '../../use-colors';
import { GroupedListScope, useGroupedListGuard } from '../grouped-list-scope';
import type { GroupedListProps, ListRowProps, ListSectionProps } from '../types';
import { SwiftUIHost } from './swiftui-host';

/** The system's own label levels, which adapt to their context (SwiftUI Pro, design.md). */
const PRIMARY = foregroundStyle({ type: 'hierarchical', style: 'primary' });
const TERTIARY = foregroundStyle({ type: 'hierarchical', style: 'tertiary' });

/**
 * The system's grouped list: headers, footers and space separate the groups
 * (lists-and-tables.md › Style). It scrolls by itself and fills the place it is given.
 */
export function GroupedList({ children, header, background = 'system', testID }: GroupedListProps) {
  const list = (
    <SwiftUIHost size="fill">
      <Form
        testID={testID}
        // `clear`: the Form draws no background of its own, its groups keep theirs.
        modifiers={background === 'clear' ? [scrollContentBackground('hidden')] : undefined}
      >
        <GroupedListScope background={background}>{children}</GroupedListScope>
      </Form>
    </SwiftUIHost>
  );
  if (header === undefined) return list;
  // The header is React Native content outside the Form: the Form insets each of its rows from
  // the side edges, which a row cannot undo (`listRowInsets` only moves content inside the row).
  return (
    <View style={styles.column}>
      <View testID="grouped-list-header">{header}</View>
      {list}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { flex: 1 },
});

export function ListSection({ title, titleQuran, footer, children }: ListSectionProps) {
  useGroupedListGuard('ListSection');
  const colors = useColors();
  // With Quran text in the header, the header is built here: the title as the system draws it,
  // the Arabic at the trailing end in the Quran font, growing with the text size. The system's
  // increased header prominence raises the title next to the Arabic, which is larger: otherwise
  // the number would be the smallest text of the group (layout.md › Visual hierarchy).
  const header =
    title !== undefined && titleQuran !== undefined ? (
      <HStack>
        <Text>{title}</Text>
        <Spacer />
        <Text
          modifiers={[
            font({
              family: fontFamily.quranPostScript,
              size: textStyles.title2.fontSize,
              textStyle: appleTextStyles.title2,
            }),
            foregroundStyle(colors.ink),
          ]}
        >
          {titleQuran}
        </Text>
      </HStack>
    ) : undefined;
  return (
    <Section
      modifiers={header === undefined ? undefined : [headerProminence('increased')]}
      title={header === undefined ? title : undefined}
      header={header}
      footer={footer === undefined ? undefined : <Text>{footer}</Text>}
    >
      {children}
    </Section>
  );
}

/**
 * A row of text. With `onPress`, the row opens something and shows a disclosure indicator
 * (lists-and-tables.md › Mobile). The system draws that indicator only for its own navigation
 * link, which needs a SwiftUI navigation stack the app does not have: the row is a button with
 * the `chevron.forward` symbol, which points the other way in Arabic.
 */
export function ListRow({
  label,
  symbol,
  value,
  valueAccessibilityLabel,
  onPress,
  testID,
}: ListRowProps) {
  useGroupedListGuard('ListRow');
  // The value as written, and as VoiceOver says it when its written form is abbreviated.
  const valueText =
    value === undefined ? null : (
      <Text
        modifiers={
          valueAccessibilityLabel === undefined
            ? undefined
            : [accessibilityLabel(valueAccessibilityLabel)]
        }
      >
        {value}
      </Text>
    );
  if (onPress === undefined && symbol === undefined) {
    return value === undefined ? (
      <Text testID={testID}>{label}</Text>
    ) : (
      <LabeledContent label={label} testID={testID}>
        {valueText}
      </LabeledContent>
    );
  }
  // With a symbol, the system label: the symbol at the leading end, in the tint the list gives
  // a button (the accent), at the size of the body text; the words in the label colour.
  const words = <Text modifiers={[PRIMARY]}>{label}</Text>;
  const title =
    symbol === undefined ? (
      words
    ) : (
      <Label
        icon={
          <Image
            systemName={symbol.ios}
            modifiers={[font({ textStyle: appleTextStyles.body }), accessibilityHidden()]}
          />
        }
      >
        {words}
      </Label>
    );
  if (onPress === undefined) {
    return (
      <LabeledContent label={title} testID={testID}>
        {valueText}
      </LabeledContent>
    );
  }
  return (
    <SwiftUIButton onPress={onPress} testID={testID}>
      <LabeledContent label={title}>
        <HStack spacing={spacing.sm}>
          {valueText}
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
