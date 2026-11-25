import { ScrollView, StyleSheet, View } from 'react-native';

import { getDisplayedLanguage } from '@/i18n';
import { ActionButton, AppText, layout, spacing, useColors } from '@/ui';

import { reportOf, shareText } from './active';
import { copyFor } from './copy';
import { describeError, firstLines } from './crash-record';
import { ReportDetails } from './report-details';

const STACK_LINES = 8;
const COMPONENT_LINES = 8;

export interface ErrorFallbackProps {
  error: Error;
  /** The React component stack, when the boundary that caught the error had it. */
  componentStack?: string | null;
  retry: () => void | Promise<void>;
  /** Defaults to the language the app shows (French when it has not started). */
  language?: string;
}

/**
 * The screen shown instead of an app that would close on a render error: a calm sentence, one
 * button to try again, and under them what the owner needs to read the cause from a photograph:
 * the message, the first lines of the stack and of the component stack. It uses the design
 * system's plain pieces only (no native control) and its own words (copy.ts), so that it still
 * stands when the rest of the app does not.
 */
export function ErrorFallback({
  error,
  componentStack = null,
  retry,
  language = getDisplayedLanguage(),
}: ErrorFallbackProps) {
  const colors = useColors();
  const copy = copyFor(language);
  const { message, stack } = describeError(error);
  const shown = [
    message,
    '',
    firstLines(stack, STACK_LINES),
    ...(componentStack === null || componentStack.trim() === ''
      ? []
      : ['', 'Components:', firstLines(componentStack.replace(/^\n+/, ''), COMPONENT_LINES)]),
  ].join('\n');
  return (
    <View style={[styles.screen, { backgroundColor: colors.canvas }]} testID="error-screen">
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="title2" color="heading" accessibilityRole="header">
          {copy.title}
        </AppText>
        <AppText variant="body" color="muted">
          {copy.body}
        </AppText>
        <ActionButton
          label={copy.retry}
          onPress={() => {
            void retry();
          }}
          testID="error-retry"
        />
        <AppText variant="footnote" color="muted">
          {copy.details}
        </AppText>
        <ReportDetails text={shown} testID="error-details" />
        <ActionButton
          variant="tonal"
          label={copy.share}
          onPress={() => {
            void shareText(reportOf(error, componentStack));
          }}
          testID="error-share"
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: layout.screenMargin,
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
});
