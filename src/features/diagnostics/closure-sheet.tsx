import { Modal, ScrollView, StyleSheet, View } from 'react-native';

import { getDisplayedLanguage } from '@/i18n';
import { ActionButton, AppText, layout, spacing, useColors } from '@/ui';

import { shareText } from './active';
import { copyFor } from './copy';
import { formatCrashRecord } from './crash-record';
import { ReportDetails } from './report-details';
import { useDiagnostics, useDiagnosticsSnapshot } from './use-diagnostics';

/**
 * The sheet of the launch that follows a closure the app saw: "L'app s'est fermée la dernière
 * fois", with what was noted. It comes once per record (diagnostics.ts) and can be opened again
 * from the settings. It stays away when the app closed without leaving a record, which means the
 * cause was not JavaScript.
 */
export function ClosureSheet({ language = getDisplayedLanguage() }: { language?: string }) {
  const diagnostics = useDiagnostics();
  const { previous, isSheetOpen } = useDiagnosticsSnapshot(diagnostics);
  const colors = useColors();
  const copy = copyFor(language);
  if (diagnostics === null || previous === null) return null;
  const report = formatCrashRecord(previous);
  return (
    <Modal
      visible={isSheetOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={diagnostics.dismissSheet}
    >
      <View style={[styles.sheet, { backgroundColor: colors.canvas }]} testID="closure-sheet">
        <ScrollView contentContainerStyle={styles.content}>
          <AppText variant="title2" color="heading" accessibilityRole="header">
            {copy.sheetTitle}
          </AppText>
          <AppText variant="body" color="muted">
            {copy.sheetBody}
          </AppText>
          <ReportDetails text={report} testID="closure-details" />
          <ActionButton
            label={copy.share}
            onPress={() => {
              void shareText(report);
            }}
            testID="closure-share"
          />
          <ActionButton
            variant="tonal"
            label={copy.clear}
            onPress={diagnostics.clear}
            testID="closure-clear"
          />
          <ActionButton
            variant="plain"
            label={copy.close}
            onPress={diagnostics.dismissSheet}
            testID="closure-close"
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  content: { padding: layout.screenMargin, paddingTop: spacing.lg, gap: spacing.md },
});
