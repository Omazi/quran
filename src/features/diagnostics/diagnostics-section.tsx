import { getDisplayedLanguage } from '@/i18n';
import { ListRow, ListSection } from '@/ui';

import { copyFor } from './copy';
import { useDiagnostics, useDiagnosticsSnapshot } from './use-diagnostics';

/**
 * The settings' "Diagnostic" section, in a `GroupedList`: the last closure the app noted, which
 * opens its sheet again, or a plain sentence saying there is none. Nothing outside the app's root.
 */
export function DiagnosticsSection({ language = getDisplayedLanguage() }: { language?: string }) {
  const diagnostics = useDiagnostics();
  const { previous } = useDiagnosticsSnapshot(diagnostics);
  if (diagnostics === null) return null;
  const copy = copyFor(language);
  return (
    <ListSection title={copy.settingsTitle} footer={copy.settingsFooter}>
      {previous === null ? (
        <ListRow label={copy.settingsNone} testID="diagnostics-none" />
      ) : (
        <ListRow
          label={copy.settingsRow}
          value={previous.time.slice(0, 10)}
          onPress={diagnostics.openSheet}
          testID="diagnostics-last-closure"
        />
      )}
    </ListSection>
  );
}
