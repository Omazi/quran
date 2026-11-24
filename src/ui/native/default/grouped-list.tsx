import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '../../components/app-text';
import { layout, spacing, stateOpacity } from '../../tokens';
import { useColors } from '../../use-colors';
import { GroupedListScope, useGroupedListGuard } from '../grouped-list-scope';
import type { GroupedListProps, ListRowProps, ListSectionProps } from '../types';

/**
 * Default grouped list, for Android, the web and tests: a Material list. Rows span the width,
 * a small header names each section, a hairline separates the sections, and there are no inset
 * cards and no disclosure chevrons, which are iOS conventions.
 */
export function GroupedList({ children, testID }: GroupedListProps) {
  return (
    <ScrollView style={styles.list} testID={testID}>
      <GroupedListScope>{children}</GroupedListScope>
    </ScrollView>
  );
}

export function ListSection({ title, footer, children }: ListSectionProps) {
  useGroupedListGuard('ListSection');
  const colors = useColors();
  return (
    <View style={[styles.section, { borderBottomColor: colors.separator }]}>
      {title === undefined ? null : (
        <AppText
          accessibilityRole="header"
          variant="footnote"
          color="secondaryLabel"
          style={styles.sectionText}
        >
          {title}
        </AppText>
      )}
      {children}
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
  /** Value or control shown after the label. */
  trailing?: ReactNode;
}

/**
 * Label first, value or control after it. When the two do not fit on one line, at large text
 * sizes or with a long translation, the trailing part wraps under the label instead of being
 * cut (typography.md › Supporting Dynamic Type).
 */
export function RowLayout({ label, trailing }: RowLayoutProps) {
  return (
    <View style={styles.row}>
      <AppText style={styles.rowLabel}>{label}</AppText>
      {trailing}
    </View>
  );
}

export function ListRow({ label, value, onPress, testID }: ListRowProps) {
  useGroupedListGuard('ListRow');
  const colors = useColors();
  const content = (
    <RowLayout
      label={label}
      trailing={value === undefined ? null : <AppText color="secondaryLabel">{value}</AppText>}
    />
  );
  if (onPress === undefined) {
    return (
      <View accessible testID={testID}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
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
  section: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionText: {
    paddingHorizontal: layout.screenMargin,
    paddingVertical: spacing.sm,
  },
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
