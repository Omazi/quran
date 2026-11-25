import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppText } from '../../components/app-text';
import {
  appleTextStyles,
  fontFamily,
  layout,
  radius,
  spacing,
  stateOpacity,
  textStyles,
} from '../../tokens';
import { useColors, useElevation } from '../../use-colors';
import {
  GroupedListScope,
  useGroupedListAppearance,
  useGroupedListBackground,
  useGroupedListGuard,
} from '../grouped-list-scope';
import type { GroupedListProps, IconSymbol, ListRowProps, ListSectionProps } from '../types';
import { Icon } from './icon';

/**
 * Default grouped list, for Android, the web and tests: a Material list. Rows span the width,
 * a small header names each section, a hairline separates the sections, and there are no inset
 * cards and no disclosure chevrons, which are iOS conventions.
 */
export function GroupedList({
  children,
  header,
  appearance = 'system',
  background = 'system',
  testID,
}: GroupedListProps) {
  return (
    <ScrollView
      style={styles.list}
      contentContainerStyle={
        appearance === 'garden'
          ? styles.gardenContent
          : background === 'clear'
            ? styles.clearContent
            : undefined
      }
      testID={testID}
    >
      {header}
      <GroupedListScope appearance={appearance} background={background}>
        {children}
      </GroupedListScope>
    </ScrollView>
  );
}

/**
 * A section of the garden appearance: its header and footer on the canvas, its rows on a white
 * card with the soft shadow of the mockups (the `Card` of the design system), as the iOS form
 * draws an inset group.
 */
function GardenSection({ title, footer, children }: ListSectionProps) {
  const colors = useColors();
  const shadow = useElevation('card');
  return (
    <View style={styles.gardenSection}>
      {title === undefined ? null : (
        <View style={styles.gardenText} accessible accessibilityRole="header">
          <AppText variant="footnote" color="muted">
            {title}
          </AppText>
        </View>
      )}
      <View style={[styles.gardenCard, { backgroundColor: colors.surface, boxShadow: shadow }]}>
        {children}
      </View>
      {footer === undefined ? null : (
        <AppText variant="footnote" color="muted" style={styles.gardenText}>
          {footer}
        </AppText>
      )}
    </View>
  );
}

export function ListSection({
  title,
  titleQuran,
  footer,
  children,
  isBare = false,
}: ListSectionProps) {
  useGroupedListGuard('ListSection');
  const colors = useColors();
  const shadow = useElevation('card');
  const appearance = useGroupedListAppearance();
  const isOverBackdrop = useGroupedListBackground() === 'clear' && !isBare;
  if (appearance === 'garden' && !isBare && titleQuran === undefined) {
    return (
      <GardenSection title={title} footer={footer}>
        {children}
      </GardenSection>
    );
  }
  return (
    <View
      style={
        isBare
          ? styles.bareSection
          : isOverBackdrop
            ? styles.clearSection
            : [styles.section, { borderBottomColor: colors.separator }]
      }
    >
      {title === undefined ? null : (
        <View style={styles.header} accessible accessibilityRole="header">
          {/* Beside Quran text, which is larger, the title takes the prominence of a heading, as
              the iOS header does (layout.md › Visual hierarchy). */}
          <AppText
            variant={titleQuran === undefined ? 'footnote' : 'headline'}
            color={titleQuran === undefined ? 'secondaryLabel' : 'label'}
            style={styles.headerTitle}
          >
            {title}
          </AppText>
          {titleQuran === undefined ? null : (
            <Text
              accessibilityLanguage="ar"
              dynamicTypeRamp={appleTextStyles.title2}
              style={[styles.quranTitle, { color: colors.ink }]}
            >
              {titleQuran}
            </Text>
          )}
        </View>
      )}
      {isOverBackdrop ? (
        // Over a backdrop the rows sit on a card of their own, the surface of the mockups.
        <View style={[styles.card, { backgroundColor: colors.surface, boxShadow: shadow }]}>
          {children}
        </View>
      ) : (
        children
      )}
      {footer === undefined ? null : (
        <AppText variant="footnote" color="secondaryLabel" style={styles.sectionText}>
          {footer}
        </AppText>
      )}
    </View>
  );
}

interface RowLayoutProps {
  label: string;
  /** Decorative symbol before the label, in the accent. */
  symbol?: IconSymbol;
  /** Value or control shown after the label. */
  trailing?: ReactNode;
}

/**
 * Label first, value or control after it. When the two do not fit on one line, at large text
 * sizes or with a long translation, the trailing part wraps under the label instead of being
 * cut (typography.md › Supporting Dynamic Type).
 */
export function RowLayout({ label, symbol, trailing }: RowLayoutProps) {
  return (
    <View style={styles.row}>
      {symbol === undefined ? null : <Icon symbol={symbol} color="actionTint" />}
      <AppText style={styles.rowLabel}>{label}</AppText>
      {trailing}
    </View>
  );
}

export function ListRow({
  label,
  symbol,
  value,
  valueAccessibilityLabel,
  onPress,
  onLongPress,
  testID,
}: ListRowProps) {
  useGroupedListGuard('ListRow');
  const colors = useColors();
  const content = (
    <RowLayout
      label={label}
      symbol={symbol}
      trailing={value === undefined ? null : <AppText color="secondaryLabel">{value}</AppText>}
    />
  );
  // An abbreviated value is read in words: the row, one element, says the label and that value.
  const spokenLabel =
    valueAccessibilityLabel === undefined ? undefined : `${label}, ${valueAccessibilityLabel}`;
  if (onPress === undefined && onLongPress !== undefined) {
    // A hidden gesture: the row keeps the look and the role of a row that cannot be pressed.
    return (
      <Pressable
        accessible
        accessibilityLabel={spokenLabel}
        onLongPress={onLongPress}
        testID={testID}
      >
        {content}
      </Pressable>
    );
  }
  if (onPress === undefined) {
    return (
      <View accessible accessibilityLabel={spokenLabel} testID={testID}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spokenLabel}
      android_ripple={{ color: colors.fill }}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  clearContent: { paddingVertical: spacing.sm },
  clearSection: { paddingHorizontal: layout.screenMargin, paddingVertical: spacing.sm },
  card: { borderRadius: radius.xl, overflow: 'hidden' },
  gardenContent: {
    paddingHorizontal: layout.screenMargin,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    rowGap: spacing.lg,
  },
  gardenSection: { rowGap: spacing.sm },
  gardenText: { paddingHorizontal: spacing.md },
  gardenCard: { borderRadius: radius.xl, overflow: 'hidden', paddingVertical: spacing.xs },
  section: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bareSection: { alignSelf: 'stretch' },
  sectionText: {
    paddingHorizontal: layout.screenMargin,
    paddingVertical: spacing.sm,
  },
  header: {
    paddingHorizontal: layout.screenMargin,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: spacing.md,
  },
  headerTitle: { flexShrink: 1 },
  quranTitle: { fontFamily: fontFamily.quran, fontSize: textStyles.title2.fontSize },
  row: {
    minHeight: layout.touchTarget,
    paddingHorizontal: layout.screenMargin,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: spacing.md,
    rowGap: spacing.xs,
  },
  rowLabel: { flexGrow: 1, flexShrink: 1 },
  pressed: { opacity: stateOpacity.pressed },
});
