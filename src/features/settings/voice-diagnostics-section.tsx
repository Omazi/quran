import Constants from 'expo-constants';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';

import {
  findVoiceCapture,
  readNativeDiagnostics,
  voiceDiagnostics,
  type VoiceDiagnostics,
  type VoiceDiagnosticsStore,
} from '@/data/speech';
import { ListRow, ListSection } from '@/ui';

/** What the section asks of the phone; replaced in tests. */
export interface VoiceDiagnosticsSource {
  readonly store: VoiceDiagnosticsStore;
  /** Asks the native module again (model file, microphone); resolves when it answered. */
  readonly refresh: () => Promise<void>;
}

async function refreshFromDevice(): Promise<void> {
  const native = findVoiceCapture();
  if (native === null) return;
  const permission = await native.getPermission();
  voiceDiagnostics.record({
    permission: permission === 'granted' || permission === 'denied' ? permission : 'undetermined',
  });
  await readNativeDiagnostics(native);
}

const DEVICE_SOURCE: VoiceDiagnosticsSource = {
  store: voiceDiagnostics,
  refresh: refreshFromDevice,
};

/** The longest text shown in a row: the rest is cut, the row stays one line. */
const MAX_TEXT = 80;

function cut(text: string): string {
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 1)}…` : text;
}

/**
 * The version of the app, at the end of the settings. A long press on it shows what the voice saw
 * on this phone (hidden: nobody needs it to use the app). The owner reads it to say what fails.
 */
export function VersionSection({ source = DEVICE_SOURCE }: { source?: VoiceDiagnosticsSource }) {
  const { t } = useTranslation('settings');
  const [isOpen, setIsOpen] = useState(false);
  const version = Constants.expoConfig?.version ?? '?';
  return (
    <>
      <ListSection>
        <ListRow
          label={t('version.label')}
          value={version}
          onLongPress={() => setIsOpen((open) => !open)}
          testID="settings-version"
        />
      </ListSection>
      {isOpen ? <VoiceDiagnosticsSection source={source} /> : null}
    </>
  );
}

/** The rows of the diagnostics, in words the owner can read out. */
export function VoiceDiagnosticsSection({ source }: { source: VoiceDiagnosticsSource }) {
  const { t } = useTranslation('settings');
  const diagnostics = useSyncExternalStore(source.store.subscribe, source.store.get);
  const [refreshFailed, setRefreshFailed] = useState<string | null>(null);
  const { refresh } = source;
  const ask = useCallback(() => {
    refresh().then(
      () => setRefreshFailed(null),
      (error: unknown) => setRefreshFailed(error instanceof Error ? error.message : String(error)),
    );
  }, [refresh]);
  useEffect(ask, [ask]);

  const rows = describe(diagnostics, t);
  return (
    <ListSection title={t('voiceDiagnostics.title')} footer={t('voiceDiagnostics.footer')}>
      {rows.map(({ key, value }) => (
        <ListRow
          key={key}
          label={t(`voiceDiagnostics.${key}`)}
          value={value}
          testID={`voice-diagnostics-${key}`}
        />
      ))}
      {refreshFailed === null ? null : (
        <ListRow
          label={t('voiceDiagnostics.native')}
          value={cut(refreshFailed)}
          testID="voice-diagnostics-native-error"
        />
      )}
      <ListRow
        label={t('voiceDiagnostics.refresh')}
        onPress={ask}
        testID="voice-diagnostics-refresh"
      />
    </ListSection>
  );
}

type Translate = ReturnType<typeof useTranslation<'settings'>>['t'];

function describe(diagnostics: VoiceDiagnostics, t: Translate): { key: string; value: string }[] {
  const unknown = t('voiceDiagnostics.unknown');
  const { modelFile, whisperLoaded, permission, lastLevel, lastTranscript, lastError, native } =
    diagnostics;
  const model =
    modelFile === null
      ? unknown
      : modelFile.present
        ? t('voiceDiagnostics.modelPresent', {
            megabytes: ((modelFile.bytes ?? 0) / 1_000_000).toFixed(1),
            bytes: modelFile.bytes ?? 0,
          })
        : t('voiceDiagnostics.modelAbsent');
  const level =
    lastLevel === null
      ? unknown
      : lastLevel.db === null || !Number.isFinite(lastLevel.db)
        ? `${Math.round(lastLevel.level * 100)} %`
        : `${Math.round(lastLevel.level * 100)} % · ${Math.round(lastLevel.db)} dB`;
  const nativeSummary =
    native === null
      ? unknown
      : [
          native.inputFormat,
          native.inputRoute,
          `${String(native.buffersReceived ?? 0)} / ${String(native.chunksSent ?? 0)}`,
          native.lastNativeError,
          native.appBuild,
        ]
          .filter((part) => part !== undefined && part !== '')
          .join(' · ');
  return [
    { key: 'model', value: model },
    {
      key: 'whisper',
      value:
        whisperLoaded === null
          ? t('voiceDiagnostics.notTried')
          : whisperLoaded
            ? t('voiceDiagnostics.loaded')
            : t('voiceDiagnostics.notLoaded'),
    },
    {
      key: 'microphone',
      value: permission === null ? unknown : t(`voiceDiagnostics.${permission}`),
    },
    { key: 'level', value: level },
    { key: 'audio', value: String(diagnostics.audioChunks) },
    { key: 'transcript', value: lastTranscript === null ? '—' : cut(lastTranscript.trim() || '∅') },
    {
      key: 'error',
      value: lastError === null ? '—' : cut(`${lastError.failure}: ${lastError.message}`),
    },
    { key: 'native', value: cut(nativeSummary) },
  ];
}
