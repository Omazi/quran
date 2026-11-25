import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText } from '../../components/app-text';
import { layout, spacing } from '../../tokens';
import { OutsideGroupedList, useGroupedListGuard } from '../grouped-list-scope';
import type { ButtonPairRowProps, ButtonRowProps, ContentRowProps, LabelRowProps } from '../types';
import { Button } from './button';
import { Icon } from './icon';

/**
 * Default label row: Material's list item with a leading icon, then one or two lines of text.
 * The tone colours the icon only. One element for screen readers, which hear the words: the
 * icon is decorative.
 */
export function LabelRow({ label, detail, symbol, tone = 'accent', testID }: LabelRowProps) {
  useGroupedListGuard('LabelRow');
  return (
    <View
      accessible
      testID={testID}
      style={[styles.row, styles.labelRow, detail !== undefined && styles.twoLines]}
    >
      <Icon symbol={symbol} color={tone} />
      <View style={styles.words}>
        <AppText>{label}</AppText>
        {detail === undefined ? null : (
          <AppText variant="subhead" color="secondaryLabel">
            {detail}
          </AppText>
        )}
      </View>
    </View>
  );
}

/** Default button row: the button of this implementation, as wide as the row, inside its inset. */
export function ButtonRow(props: ButtonRowProps) {
  useGroupedListGuard('ButtonRow');
  return (
    <View style={styles.row}>
      <Button {...props} fullWidth />
    </View>
  );
}

/**
 * Default pair of buttons: the two buttons of this implementation side by side, sharing the width
 * of the row, the preferred one filled (or outlined), the other a text button; stacked at large
 * text sizes. Each has its own target of 48 dp on Android.
 */
export function ButtonPairRow({
  preferred,
  other,
  preferredVariant = 'primary',
}: ButtonPairRowProps) {
  useGroupedListGuard('ButtonPairRow');
  const { fontScale } = useWindowDimensions();
  const isStacked = fontScale > layout.sideBySideMaxFontScale;
  return (
    <View style={[styles.row, isStacked ? styles.stacked : styles.sideBySide]}>
      {[
        { item: preferred, variant: preferredVariant },
        { item: other, variant: 'plain' as const },
      ].map(({ item, variant }) => (
        <View key={item.testID ?? item.label} style={isStacked ? undefined : styles.half}>
          <Button
            label={item.label}
            accessibilityLabel={item.accessibilityLabel}
            onPress={item.onPress}
            variant={variant}
            disabled={item.disabled}
            fullWidth
            testID={item.testID}
          />
        </View>
      ))}
    </View>
  );
}

/**
 * Default content row: a block as wide as the list, with the side inset of the other rows, so
 * that its content lines up with them as it does inside the iOS list; or with no inset at all
 * when it runs edge to edge.
 */
export function ContentRow({
  children,
  accessibilityLabel,
  isEdgeToEdge = false,
  testID,
}: ContentRowProps) {
  useGroupedListGuard('ContentRow');
  return (
    <View
      accessible={accessibilityLabel !== undefined}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={isEdgeToEdge ? styles.edgeToEdge : styles.content}
    >
      <OutsideGroupedList>{children}</OutsideGroupedList>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: layout.screenMargin,
    paddingVertical: spacing.sm,
  },
  labelRow: {
    minHeight: layout.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  // With a second line the icon stays beside the first one, however long the sentence gets.
  twoLines: { alignItems: 'flex-start' },
  // The words take the width left by the icon and wrap at large text sizes.
  words: { flexGrow: 1, flexShrink: 1, gap: spacing.xs },
  sideBySide: { flexDirection: 'row', gap: layout.controlGap },
  stacked: { gap: layout.controlGap },
  half: { flex: 1 },
  content: { alignSelf: 'stretch', paddingHorizontal: layout.screenMargin },
  edgeToEdge: { alignSelf: 'stretch' },
});
