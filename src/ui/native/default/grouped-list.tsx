import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppText } from '../../components/app-text';
import {
  appleTextStyles,
  fontFamily,
  layout,
  spacing,
  stateOpacity,
  textStyles,
} from '../../tokens';
import { useColors } from '../../use-colors';
import { GroupedListScope, useGroupedListGuard } from '../grouped-list-scope';
import type { GroupedListProps, ListRowProps, ListSectionProps } from '../types';

/**
 * Default grouped list, for Android, the web and tests: a Material list. Rows span the width,
 * a small header names each section, a hairline separates the sections, and there are no inset
 * cards and no disclosure chevrons, which are iOS conventions.
 */
export function GroupedList({ children, header, testID }: GroupedListProps) {
  return (
    <ScrollView style={styles.list} testID={testID}>
      {header}
      <GroupedListScope>{children}</GroupedListScope>
    </ScrollView>
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
  return (
    <View
      style={
        isBare ? styles.bareSection : [styles.section, { borderBottomColor: colors.separator }]
      }
    >
      {title === undefined ? null : (
        <View style={styles.header} accessible accessibilityRole="header">
          <AppText variant="footnote" color="secondaryLabel" style={styles.headerTitle}>
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
