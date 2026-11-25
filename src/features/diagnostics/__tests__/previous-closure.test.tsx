import { fireEvent, render, screen } from '@testing-library/react-native';
import { Share } from 'react-native';

import { DiagnosticsProvider } from '../use-diagnostics';
import { ClosureSheet } from '../closure-sheet';
import { DiagnosticsSection } from '../diagnostics-section';
import { RouteErrorBoundary } from '../route-error-boundary';
import { createDiagnostics, type Diagnostics } from '../diagnostics';
import { encodeCrashRecord, type CrashRecord } from '../crash-record';
import { createMemoryRecordFile } from '../record-file';
import { setActiveDiagnostics } from '../active';
import { GroupedList } from '@/ui';

const APP = { version: '0.1.0', build: '57', os: 'ios 26.1', device: 'iPhone 15' };
const RECORD: CrashRecord = {
  source: 'fatal',
  message: 'undefined is not an object',
  stack: 'TypeError: undefined is not an object\n    at Foo (main.jsbundle:1:2)',
  componentStack: null,
  recentErrors: [],
  time: '2026-11-25T18:04:05.000Z',
  route: '/onboarding',
  app: APP,
  breadcrumbs: [{ at: 0, kind: 'nav', label: '/onboarding' }],
  isShown: false,
};

function launchWith(record: CrashRecord | null): Diagnostics {
  const file = createMemoryRecordFile(record === null ? null : encodeCrashRecord(record));
  const diagnostics = createDiagnostics({ file, now: () => 0, app: APP });
  diagnostics.load();
  return diagnostics;
}

afterEach(() => {
  setActiveDiagnostics(null);
  jest.restoreAllMocks();
});

describe('the sheet of the next launch', () => {
  it('shows what the app noted, once, with Copier, Effacer and Fermer', async () => {
    const diagnostics = launchWith(RECORD);
    await render(
      <DiagnosticsProvider diagnostics={diagnostics}>
        <ClosureSheet language="fr" />
      </DiagnosticsProvider>,
    );
    expect(screen.getByText("L'app s'est fermée la dernière fois")).toBeOnTheScreen();
    expect(String(screen.getByTestId('closure-details').props.children)).toContain(
      'undefined is not an object',
    );
    expect(screen.getByRole('button', { name: 'Copier ou envoyer' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByText("L'app s'est fermée la dernière fois")).toBeNull();
    // The record stays for the settings.
    expect(diagnostics.getSnapshot().previous).not.toBeNull();
  });

  it('does not show when the app closed with no record (that means native)', async () => {
    const diagnostics = launchWith(null);
    await render(
      <DiagnosticsProvider diagnostics={diagnostics}>
        <ClosureSheet language="fr" />
      </DiagnosticsProvider>,
    );
    expect(screen.queryByText("L'app s'est fermée la dernière fois")).toBeNull();
  });

  it('clears the record for good on Effacer', async () => {
    const diagnostics = launchWith(RECORD);
    await render(
      <DiagnosticsProvider diagnostics={diagnostics}>
        <ClosureSheet language="fr" />
      </DiagnosticsProvider>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Effacer' }));
    expect(screen.queryByText("L'app s'est fermée la dernière fois")).toBeNull();
    expect(diagnostics.getSnapshot().previous).toBeNull();
  });

  it('copies or sends the whole record', async () => {
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    const diagnostics = launchWith(RECORD);
    await render(
      <DiagnosticsProvider diagnostics={diagnostics}>
        <ClosureSheet language="fr" />
      </DiagnosticsProvider>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Copier ou envoyer' }));
    expect(share.mock.calls[0]?.[0].message).toContain('at Foo');
    expect(share.mock.calls[0]?.[0].message).toContain('/onboarding');
  });
});

describe('Settings > Diagnostics', () => {
  async function renderSection(diagnostics: Diagnostics) {
    await render(
      <DiagnosticsProvider diagnostics={diagnostics}>
        <GroupedList appearance="garden">
          <DiagnosticsSection language="fr" />
        </GroupedList>
        <ClosureSheet language="fr" />
      </DiagnosticsProvider>,
    );
  }

  it('keeps the record after the sheet was shown, and opens it again from a row', async () => {
    const diagnostics = launchWith(RECORD);
    await renderSection(diagnostics);
    await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByText("L'app s'est fermée la dernière fois")).toBeNull();

    await fireEvent.press(screen.getByText('Dernière fermeture inattendue'));
    expect(screen.getByText("L'app s'est fermée la dernière fois")).toBeOnTheScreen();
  });

  it('says plainly that nothing was noted when there is no record', async () => {
    await renderSection(launchWith(null));
    expect(screen.getByText('Aucune fermeture notée par l’app.')).toBeOnTheScreen();
    expect(screen.queryByText('Dernière fermeture inattendue')).toBeNull();
  });
});

describe('the error screen that expo-router asks a layout to export', () => {
  it('shows the error, keeps it for the next launch and retries', async () => {
    const diagnostics = launchWith(null);
    const spy = jest.spyOn(diagnostics, 'recordBoundaryError');
    setActiveDiagnostics(diagnostics);
    const retry = jest.fn(async () => {});
    await render(<RouteErrorBoundary error={new Error('layout failed')} retry={retry} />);
    expect(screen.getByText('Un problème est survenu.')).toBeOnTheScreen();
    expect(spy).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
