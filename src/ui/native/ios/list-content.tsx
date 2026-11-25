import {
  Button as SwiftUIButton,
  Group,
  HStack,
  Image,
  Label,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityHidden,
  accessibilityLabel,
  buttonStyle,
  contentShape,
  controlSize,
  disabled as disabledModifier,
  font,
  foregroundStyle,
  frame,
  listRowBackground,
  listRowInsets,
  listRowSeparator,
  shapes,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { useWindowDimensions } from 'react-native';

import { appleTextStyles, layout, spacing } from '../../tokens';
import { useColors } from '../../use-colors';
import { OutsideGroupedList, useGroupedListGuard } from '../grouped-list-scope';
import type {
  ButtonPairItem,
  ButtonPairRowProps,
  ButtonRowProps,
  ContentRowProps,
  LabelRowProps,
} from '../types';
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
 * Two system buttons in one row of the list, at the same width: the preferred one in the
 * prominent (or bordered) style, the other borderless (buttons.md › Style). Each button states
 * its style: in a row of a list, buttons without a style of their own would make the whole row
 * one target that presses both. The borderless one gets a frame of 44 points and a rectangular
 * hit shape (buttons.md › Best practices). At large text sizes the two are stacked, so that a
 * label is never cut inside a word.
 */
export function ButtonPairRow({
  preferred,
  other,
  preferredVariant = 'primary',
}: ButtonPairRowProps) {
  useGroupedListGuard('ButtonPairRow');
  const colors = useColors();
  const { fontScale } = useWindowDimensions();
  const isStacked = fontScale > layout.sideBySideMaxFontScale;
  // The prominent one is filled with the action green of every filled button, white label.
  const isFilled = preferredVariant === 'primary' && preferred.disabled !== true;
  const preferredLabelColor = isFilled ? [foregroundStyle(colors.onAction)] : [];
  const buttons = [
    pairButton(
      preferred,
      [
        buttonStyle(SYSTEM_PAIR_STYLE[preferredVariant]),
        controlSize('large'),
        ...(isFilled ? [tint(colors.action)] : []),
      ],
      [frame({ maxWidth: Infinity }), ...preferredLabelColor],
    ),
    pairButton(
      other,
      [buttonStyle('borderless'), controlSize('large')],
      [
        frame({ maxWidth: Infinity, minHeight: layout.touchTarget }),
        contentShape(shapes.rectangle()),
      ],
    ),
  ];
  // An ordinary row of the list, with its background and insets: the answer sits in the same
  // card as the request it answers.
  return (
    <Group>
      {isStacked ? (
        <VStack spacing={layout.controlGap}>{buttons}</VStack>
      ) : (
        // Centred: if one label wraps at a larger text size, the other stays beside its middle.
        <HStack spacing={layout.controlGap} alignment="center">
          {buttons}
        </HStack>
      )}
    </Group>
  );
}

/** The system styles a preferred button can take in a pair. */
const SYSTEM_PAIR_STYLE = { primary: 'borderedProminent', secondary: 'bordered' } as const;

function pairButton(
  item: ButtonPairItem,
  style: ReturnType<typeof buttonStyle | typeof controlSize | typeof tint>[],
  labelModifiers: ReturnType<typeof foregroundStyle | typeof frame | typeof contentShape>[],
) {
  return (
    <SwiftUIButton
      key={item.testID ?? item.label}
      onPress={item.onPress}
      testID={item.testID}
      modifiers={[
        ...style,
        disabledModifier(item.disabled === true),
        ...(item.accessibilityLabel === undefined
          ? []
          : [accessibilityLabel(item.accessibilityLabel)]),
      ]}
    >
      <Text modifiers={labelModifiers}>{item.label}</Text>
    </SwiftUIButton>
  );
}

/**
 * React Native content as a row of the system list, so that it scrolls with the rows instead of
 * above them. The row gives up its margins, background and separator, and follows the height of
 * its content.
 */
// `isEdgeToEdge` changes nothing here: the row already gives up every margin of its own.
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
