/**
 * The hidden voice diagnostics: a long press on the version shows what the voice saw on this
 * phone, so the owner can say what fails (model file, Whisper, microphone, level, transcript,
 * error).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { createVoiceDiagnosticsStore } from '@/data/speech/diagnostics';
import { showLanguage } from '@/features/garden/test-support/screen-conditions';
import { GroupedList } from '@/ui';
import { resetDeviceConditions } from '@/ui/test-support/environment';

import { VersionSection, type VoiceDiagnosticsSource } from '../voice-diagnostics-section';

afterEach(resetDeviceConditions);

function source(): VoiceDiagnosticsSource & { refresh: jest.Mock } {
  const store = createVoiceDiagnosticsStore();
  return {
    store,
    refresh: jest.fn(async () => {
      store.record({
        modelFile: { present: true, bytes: 43_537_433 },
        permission: 'granted',
        native: { inputFormat: '48000 Hz, 1 ch', inputRoute: 'MicrophoneBuiltIn' },
      });
    }),
  };
}

async function show(given: VoiceDiagnosticsSource) {
  await showLanguage('fr');
  await render(
    <GroupedList>
      <VersionSection source={given} />
    </GroupedList>,
  );
}

const value = (key: string) => screen.getByTestId(`voice-diagnostics-${key}`);

describe('the version row', () => {
  it('shows the version, and nothing of the diagnostics until a long press', async () => {
    const given = source();
    await show(given);
    expect(screen.getByTestId('settings-version')).toHaveTextContent(/Version/);
    expect(screen.queryByText('Diagnostic de la voix')).toBeNull();
    expect(given.refresh).not.toHaveBeenCalled();
  });

  it('a long press shows what the voice saw, asked of the phone again', async () => {
    const given = source();
    given.store.record({
      whisperLoaded: true,
      lastLevel: { level: 0.5, db: -35 },
      audioChunks: 12,
      lastTranscript: ' قل هو الله أحد',
      lastError: { failure: 'no-audio', message: 'No sound from the microphone after 3000 ms' },
    });
    await show(given);
    await fireEvent(screen.getByTestId('settings-version'), 'longPress');
    await waitFor(() =>
      expect(value('model')).toHaveTextContent('présent, 43.5 Mo', { exact: false }),
    );
    expect(given.refresh).toHaveBeenCalledTimes(1);
    expect(value('whisper')).toHaveTextContent('chargé', { exact: false });
    expect(value('microphone')).toHaveTextContent('autorisé', { exact: false });
    expect(value('level')).toHaveTextContent('50 % · -35 dB', { exact: false });
    expect(value('audio')).toHaveTextContent('12', { exact: false });
    expect(value('transcript')).toHaveTextContent('قل هو الله أحد', { exact: false });
    expect(value('error')).toHaveTextContent('no-audio: No sound from the microphone', {
      exact: false,
    });
    expect(value('native')).toHaveTextContent('48000 Hz, 1 ch · MicrophoneBuiltIn', {
      exact: false,
    });
  });

  it('says the model is absent when the phone says so', async () => {
    const given = source();
    given.refresh.mockImplementation(async () => {
      given.store.record({ modelFile: { present: false, bytes: 0 } });
    });
    await show(given);
    await fireEvent(screen.getByTestId('settings-version'), 'longPress');
    await waitFor(() => expect(value('model')).toHaveTextContent('absent', { exact: false }));
  });

  it('a second long press hides it again', async () => {
    await show(source());
    await fireEvent(screen.getByTestId('settings-version'), 'longPress');
    await waitFor(() => expect(screen.getByText('Diagnostic de la voix')).toBeOnTheScreen());
    await fireEvent(screen.getByTestId('settings-version'), 'longPress');
    expect(screen.queryByText('Diagnostic de la voix')).toBeNull();
  });
});
