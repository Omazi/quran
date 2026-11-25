import { Platform, ScrollView, StyleSheet, Text } from 'react-native';

import { radius, spacing, useColors } from '@/ui';

/** Small monospace text the person can select, in a box that scrolls: what a photograph shows. */
export function ReportDetails({ text, testID }: { text: string; testID?: string }) {
  const colors = useColors();
  return (
    <ScrollView
      style={[styles.box, { backgroundColor: colors.field }]}
      contentContainerStyle={styles.content}
      nestedScrollEnabled
    >
      <Text
        selectable
        testID={testID}
        style={[styles.text, { color: colors.label }]}
        // Text that is written to be read letter by letter keeps its left-to-right order.
        textBreakStrategy="simple"
      >
        {text}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  box: { maxHeight: 260, borderRadius: radius.md, alignSelf: 'stretch' },
  content: { padding: spacing.sm + spacing.xs },
  text: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
});
