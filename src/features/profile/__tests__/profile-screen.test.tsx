import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { createInertNotificationPermissions } from '@/data/notifications';
import type { SecondsByDay } from '@/domain/stats';
import {
  createFixedDirection,
  renderWithStore,
} from '@/features/settings/test-support/render-with-store';
import { useSettings } from '@/features/settings';
import type { AppLanguage } from '@/i18n';
import {
  APPEARANCES_AND_DIRECTIONS,
  directionDependentStyles,
  resetDeviceConditions,
  setDeviceConditions,
} from '@/ui/test-support/environment';

import { ProfileScreen } from '../profile-screen';
import { buildFixtureTable, day, FIXTURE_PAGE, journalOf } from '../test-support/stats-fixtures';
import { useProfileGarden } from '../use-profile-garden';
import { useProfileStats } from '../use-profile-stats';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-notifications', () =>
  jest
    .requireActual<typeof import('@/data/notifications/test-support/quiet-expo-notifications')>(
      '@/data/notifications/test-support/quiet-expo-notifications',
    )
    .loadQuietly(),
);

const table = buildFixtureTable();
const loadTable = () => Promise.resolve(table);
// Wednesday 25 November 2026, in the afternoon.
const clock = () => new Date('2026-11-25T15:00:00');

const openSettings = jest.fn();
const read = jest.fn();

/** The profile tab as its route composes it, with a table and a clock the test controls. */
function ProfileHarness() {
  const { model: stats, actions: statsActions } = useProfileStats({ clock, loadTable });
  const garden = useProfileGarden({ clock });
  const { model: settings, actions: settingsActions } = useSettings({
    notifications: createInertNotificationPermissions({ status: 'granted' }),
    direction: createFixedDirection(false).platform,
    getDeviceLanguageCodes: () => ['fr'],
    openSystemSettings: jest.fn(),
    openIntroduction: jest.fn(),
  });
  return (
    <ProfileScreen
      stats={stats}
      statsActions={statsActions}
      settings={settings}
      settingsActions={settingsActions}
      garden={garden}
      actions={{ openSettings, read }}
    />
  );
}

const readingJournal = journalOf([
  ['2026-09-01', 604],
  ['2026-11-23', 4],
  ['2026-11-25', 3],
]);
const readingTime: SecondsByDay = {
  [day('2026-11-23')]: { app: 1800, reader: 1500 },
  [day('2026-11-25')]: { app: 4500, reader: 4200 },
};

async function renderProfile(
  options: {
    language?: AppLanguage;
    empty?: boolean;
    dataResetNotice?: 'journal' | null;
  } = {},
) {
  const store = await renderWithStore(<ProfileHarness />, {
    language: options.language ?? 'fr',
    settings: { onboardingCompleted: true },
    journal: options.empty ? undefined : readingJournal,
    timeSpent: options.empty ? undefined : readingTime,
    dataResetNotice: options.dataResetNotice ?? null,
  });
  await screen.findByTestId(options.empty ? 'profile-stats-empty' : 'profile-hasanat');
  return store;
}

/** Text with the grouping spaces of French (narrow no-break) made plain, to compare. */
function plain(text: string): string {
  return text.replace(/[  ]/g, ' ');
}

afterEach(async () => {
  await resetDeviceConditions();
  openSettings.mockClear();
  read.mockClear();
});

describe('ProfileScreen › statistics', () => {
  it('opens on the week: the hasanat estimate large, with its source right under it', async () => {
    await renderProfile();
    const pagesThisWeek = 7;
    expect(screen.getByText('Hasanat cette semaine')).toBeOnTheScreen();
    expect(plain(screen.getByTestId('profile-hasanat-value').props.children)).toBe(
      `≈ ${(pagesThisWeek * FIXTURE_PAGE.letters * 10).toLocaleString('fr-FR').replace(/[  ]/g, ' ')}`,
    );
    expect(screen.getByTestId('profile-hasanat-note')).toHaveTextContent(
      /Estimation .*Tirmidhî n° 2910.*Allah seul connaît la récompense\./,
    );
  });

  it('shows the other figures of the period, time included', async () => {
    await renderProfile();
    expect(within(screen.getByTestId('profile-verses')).getByText('70')).toBeOnTheScreen();
    expect(within(screen.getByTestId('profile-words')).getByText('700')).toBeOnTheScreen();
    expect(within(screen.getByTestId('profile-pages')).getByText('7')).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('profile-reading-time')).getByText('1 h 35 min'),
    ).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('profile-app-time')).getByText('1 h 45 min'),
    ).toBeOnTheScreen();
  });

  it('changes every figure with the period', async () => {
    await renderProfile();
    await fireEvent.press(screen.getByRole('radio', { name: 'Aujourd’hui' }));
    expect(screen.getByText('Hasanat aujourd’hui')).toBeOnTheScreen();
    expect(within(screen.getByTestId('profile-pages')).getByText('3')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Tout' }));
    expect(screen.getByText('Hasanat depuis le début')).toBeOnTheScreen();
    expect(within(screen.getByTestId('profile-pages')).getByText('611')).toBeOnTheScreen();
    expect(screen.getByText('Chaque mois')).toBeOnTheScreen();
  });

  it('draws the evolution day by day, each day read by VoiceOver with its value', async () => {
    await renderProfile();
    // The summary is the subtitle of the chart's title, right under it (charts.md › Descriptive
    // content).
    const title = screen.getByTestId('profile-chart-title');
    expect(within(title).getByRole('header', { name: 'Chaque jour' })).toBeOnTheScreen();
    expect(within(title).getByTestId('profile-chart-summary')).toHaveTextContent(
      /^Meilleur jour : lundi 23 novembre, 16[\s\u202f]000$/,
    );
    expect(screen.getByLabelText(/^lundi 23 novembre, Hasanat : /)).toBeOnTheScreen();
    // The days still to come are not read.
    expect(screen.queryByLabelText(/^jeudi 26 novembre/)).toBeNull();
  });

  it('lets the person choose the figure the chart follows', async () => {
    await renderProfile();
    await fireEvent.press(
      within(screen.getByTestId('profile-chart-metric')).getByRole('radio', {
        name: 'Temps de lecture',
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByLabelText('mercredi 25 novembre, Temps de lecture : 1 heure 10 minutes'),
      ).toBeOnTheScreen(),
    );
  });

  it('tells each khatma as the garden it grew, the one in progress first', async () => {
    await renderProfile();
    expect(screen.getByText('Tes jardins')).toBeOnTheScreen();
    expect(screen.getByText('Jardin 2 · en cours')).toBeOnTheScreen();
    expect(screen.getByText(/^Jardin 1 · achevé le 1 sept\. 2026$/)).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('profile-khatma-1')).getByText(/^Khatma 1 · 604 pages/),
    ).toBeOnTheScreen();
  });

  it('gives the source of the estimate once, under the figure', async () => {
    await renderProfile();
    expect(screen.getAllByText(/Tirmidhî/)).toHaveLength(1);
  });

  it('shows the person’s garden above the figures, named after the khatma it grows with', async () => {
    await renderProfile();
    const garden = screen.getByTestId('profile-garden');
    expect(within(garden).getByTestId('garden-scene')).toBeOnTheScreen();
    expect(within(garden).getByText('Jardin 2')).toBeOnTheScreen();
  });

  it('reads the times in words, not in abbreviations', async () => {
    await renderProfile();
    expect(screen.getByLabelText('Temps de lecture, 1 heure 35 minutes')).toBeOnTheScreen();
    expect(screen.getByLabelText('Temps dans l’appli, 1 heure 45 minutes')).toBeOnTheScreen();
  });

  it('says what will be counted, without a zero, before anything is read', async () => {
    await renderProfile({ empty: true });
    expect(screen.getByText('Ta première page t’attend')).toBeOnTheScreen();
    expect(screen.queryByTestId('profile-hasanat')).toBeNull();
    expect(screen.queryByTestId('profile-period')).toBeNull();
    // The bare garden, with no zero written under it.
    expect(
      within(screen.getByTestId('profile-garden')).getByTestId('garden-scene'),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/hizb/)).toBeNull();
  });

  it('gives a blank profile its next step: the button that opens the reader', async () => {
    await renderProfile({ empty: true });
    await fireEvent.press(screen.getByRole('button', { name: 'Lire et arroser' }));
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('is written in Arabic, mirrored, with Western digits', async () => {
    setDeviceConditions({ rightToLeft: true });
    await renderProfile({ language: 'ar' });
    expect(screen.getByText('الحسنات هذا الأسبوع')).toBeOnTheScreen();
    expect(screen.getByTestId('profile-hasanat-note')).toHaveTextContent(/الترمذي، رقم 2910/);
    expect(screen.getByTestId('profile-hasanat-value')).toHaveTextContent(/^≈\s28[,٬]000$/);
    expect(directionDependentStyles(screen.getByTestId('profile'))).toEqual([]);
  });
});

describe('ProfileScreen › settings behind one row', () => {
  it('lists no setting itself: one row, at the end, opens the settings', async () => {
    await renderProfile();
    expect(screen.queryByTestId('language')).toBeNull();
    expect(screen.queryByRole('adjustable', { name: 'Pages par jour' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Réglages' }));
    expect(openSettings).toHaveBeenCalledTimes(1);
  });

  it('keeps the row on a blank profile', async () => {
    await renderProfile({ empty: true });
    expect(screen.getByRole('button', { name: 'Réglages' })).toBeOnTheScreen();
  });

  it('says first, above the statistics, what data could not be read back', async () => {
    await renderProfile({ dataResetNotice: 'journal' });
    expect(screen.getByRole('header', { name: 'À savoir' })).toBeOnTheScreen();
  });
});

describe.each(APPEARANCES_AND_DIRECTIONS)('ProfileScreen in %o', (conditions) => {
  it.each([false, true])('renders, empty: %s, with no left or right of its own', async (empty) => {
    setDeviceConditions(conditions);
    await renderProfile({ empty, language: conditions.rightToLeft ? 'ar' : 'fr' });
    expect(directionDependentStyles(screen.getByTestId('profile'))).toEqual([]);
  });
});

describe('ProfileScreen on an iPhone', () => {
  it('gives every SwiftUI control a host', async () => {
    await renderWithStore(<ProfileHarness />, {
      onIOS: true,
      settings: { onboardingCompleted: true },
      journal: readingJournal,
      timeSpent: readingTime,
    });
    expect(await screen.findByTestId('profile-hasanat')).toBeOnTheScreen();
  });
});
