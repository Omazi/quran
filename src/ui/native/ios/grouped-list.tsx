import {
  Button as SwiftUIButton,
  Form,
  HStack,
  Image,
  LabeledContent,
  Section,
  Text,
} from '@expo/ui/swift-ui';
import { accessibilityHidden, font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';

import { appleTextStyles, spacing } from '../../tokens';
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
export function GroupedList({ children, testID }: GroupedListProps) {
  return (
    <SwiftUIHost size="fill">
      <Form testID={testID}>
        <GroupedListScope>{children}</GroupedListScope>
      </Form>
    </SwiftUIHost>
  );
}

export function ListSection({ title, footer, children }: ListSectionProps) {
  useGroupedListGuard('ListSection');
  return (
    <Section title={title} footer={footer === undefined ? undefined : <Text>{footer}</Text>}>
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
export function ListRow({ label, value, onPress, testID }: ListRowProps) {
  useGroupedListGuard('ListRow');
  if (onPress === undefined) {
    return value === undefined ? (
      <Text testID={testID}>{label}</Text>
    ) : (
      <LabeledContent label={label} testID={testID}>
        <Text>{value}</Text>
      </LabeledContent>
    );
  }
  return (
    <SwiftUIButton onPress={onPress} testID={testID}>
      <LabeledContent label={<Text modifiers={[PRIMARY]}>{label}</Text>}>
        <HStack spacing={spacing.sm}>
          {value === undefined ? null : <Text>{value}</Text>}
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
