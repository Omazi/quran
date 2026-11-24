import { Group, Image, Label, Text, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityHidden,
  font,
  foregroundStyle,
  listRowBackground,
  listRowInsets,
  listRowSeparator,
} from '@expo/ui/swift-ui/modifiers';

import { appleTextStyles, spacing } from '../../tokens';
import { useColors } from '../../use-colors';
import { OutsideGroupedList, useGroupedListGuard } from '../grouped-list-scope';
import type { ButtonRowProps, ContentRowProps, LabelRowProps } from '../types';
import { Button } from './button';
import { ReactNativeContent } from './swiftui-host';

/** The system's own secondary level, which adapts to its context (labels.md › Best practices). */
const SECONDARY = foregroundStyle({ type: 'hierarchical', style: 'secondary' });

/** A row without the list's own margins, background and separator: its content is the row. */
const BARE_ROW = [
  listRowInsets({
    top: spacing.none,
    leading: spacing.none,
    bottom: spacing.none,
    trailing: spacing.none,
  }),
  listRowBackground('clear'),
  listRowSeparator('hidden'),
];

/**
 * The system label: a symbol at the leading end of the row, followed by its words
 * (lists-and-tables.md › Style). With the default tone the system draws the symbol itself, in
 * the accent the list gives it. Another tone replaces that colour on the symbol alone: the
 * symbol is then an image in the text style of the row, so it still grows with the text
 * (Expo UI would otherwise fix it at 24 points), and the words keep the system's label colours
 * (labels.md › Best practices). The symbol is decorative: VoiceOver reads the words.
 */
export function LabelRow({ label, detail, symbol, tone = 'accent', testID }: LabelRowProps) {
  useGroupedListGuard('LabelRow');
  const colors = useColors();
  const tonedSymbol =
    tone === 'accent' ? undefined : (
      <Image
        systemName={symbol.ios}
        modifiers={[
          font({ textStyle: appleTextStyles.body }),
          tone === 'secondaryLabel' ? SECONDARY : foregroundStyle(colors[tone]),
          accessibilityHidden(),
        ]}
      />
    );
  return (
    <Label
      title={detail === undefined ? label : undefined}
      systemImage={tonedSymbol === undefined ? symbol.ios : undefined}
      icon={tonedSymbol}
      testID={testID}
    >
      {detail === undefined ? undefined : (
        <VStack alignment="leading" spacing={spacing.xs}>
          <Text>{label}</Text>
          <Text modifiers={[font({ textStyle: appleTextStyles.subhead }), SECONDARY]}>
            {detail}
          </Text>
        </VStack>
      )}
    </Label>
  );
}

/**
 * The system button as a row. A plain button takes the list's own style: the whole row is the
 * button, at the height of a row. The two bordered styles are the row themselves: the row gives
 * up its margins and its background, and the button spans it at the large control size, above
 * 44 points (buttons.md › Best practices).
 */
export function ButtonRow({ variant = 'primary', ...button }: ButtonRowProps) {
  useGroupedListGuard('ButtonRow');
  if (variant === 'plain') return <Button {...button} variant="plain" />;
  return (
    <Group modifiers={BARE_ROW}>
      <Button {...button} variant={variant} fullWidth />
    </Group>
  );
}

/**
 * React Native content as a row of the system list, so that it scrolls with the rows instead of
 * above them. The row gives up its margins, background and separator, and follows the height of
 * its content.
 */
export function ContentRow({ children, accessibilityLabel, testID }: ContentRowProps) {
  useGroupedListGuard('ContentRow');
  return (
    <Group modifiers={BARE_ROW}>
      <ReactNativeContent height="content" accessibilityLabel={accessibilityLabel} testID={testID}>
        <OutsideGroupedList>{children}</OutsideGroupedList>
      </ReactNativeContent>
    </Group>
  );
}
