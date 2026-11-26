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
  swiftUIViewsWithoutHost,
} from '@/ui/test-support/environment';

import { useProgression } from '@/features/gardens';
import { useAppStore } from '@/store';

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
const openGardens = jest.fn();

/** The profile tab as its route composes it, with a table and a clock the test controls. */
function ProfileHarness() {
  const { model: stats, actions: statsActions } = useProfileStats({ clock, loadTable });
  const garden = useProfileGarden({ clock });
  const progression = useProgression();
  const showLevel = useAppStore((state) => state.settings.showLevel);
  const setShowLevel = useAppStore((state) => state.setShowLevel);
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
      progression={progression}
      showLevel={showLevel}
      actions={{ openSettings, read, openGardens, setShowLevel }}
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
  await screen.findByTestId(options.empty ? 'profile-stats-empty' : 'profile-hero');
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

describe('ProfileScreen › the question about the gender', () => {
  it('is the first card, until it is answered, and asks without blocking anything', async () => {
    await renderProfile();

    expect(screen.getByTestId('gender-question')).toBeOnTheScreen();
    // The rest of the tab is there, whatever the answer.
    expect(screen.getByTestId('profile-hero')).toBeOnTheScreen();
    expect(screen.getByTestId('profile-settings')).toBeOnTheScreen();
  });

  it('goes away for good once answered, and what was said is kept', async () => {
    const store = await renderProfile();

    await fireEvent.press(screen.getByRole('button', { name: 'Une femme' }));

    expect(store.getState().settings).toMatchObject({ gender: 'female', genderAsked: true });
    expect(screen.queryByTestId('gender-question')).toBeNull();
  });
});

describe('ProfileScreen › statistics', () => {
  it('opens on the week: the hasanat written large, with its source in the same card', async () => {
    await renderProfile();
    const pagesThisWeek = 7;
    const hero = screen.getByTestId('profile-hero');
    expect(within(hero).getByText('Hasanat cette semaine')).toBeOnTheScreen();
    expect(plain(screen.getByTestId('profile-hero-value').props.children)).toBe(
      `≈ ${(pagesThisWeek * FIXTURE_PAGE.letters * 10).toLocaleString('fr-FR').replace(/[  ]/g, ' ')}`,
    );
    expect(
      within(screen.getByTestId('profile-stats')).getByTestId('profile-hasanat-note'),
    ).toHaveTextContent(/Estimation .*Tirmidhî n° 2910.*Allah seul connaît la récompense\./);
  });

  it('lists every figure of the period, each one a choice of what the chart follows', async () => {
    await renderProfile();
    const figures = screen.getByTestId('profile-figures');
    expect(figures).toHaveProp('accessibilityRole', 'radiogroup');
    expect(within(screen.getByTestId('profile-figure-verses')).getByText('70')).toBeOnTheScreen();
    expect(within(screen.getByTestId('profile-figure-words')).getByText('700')).toBeOnTheScreen();
    expect(within(screen.getByTestId('profile-figure-pages')).getByText('7')).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('profile-figure-readingTime')).getByText('1 h 35 min'),
    ).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: /^Hasanat, environ/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Versets, 70' })).not.toBeChecked();
  });

  it('writes the time in the app under the figures', async () => {
    await renderProfile();
    expect(screen.getByTestId('profile-app-time')).toHaveTextContent(
      'Temps dans l’appli : 1 h 45 min',
    );
  });

  it('reads the times in words, not in abbreviations', async () => {
    await renderProfile();
    expect(
      screen.getByRole('radio', { name: 'Temps de lecture, 1 heure 35 minutes' }),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Temps dans l’appli, 1 heure 45 minutes')).toBeOnTheScreen();
  });

  it('changes every figure with the period', async () => {
    await renderProfile();
    await fireEvent.press(screen.getByRole('radio', { name: 'Jour' }));
    expect(screen.getByText('Hasanat aujourd’hui')).toBeOnTheScreen();
    expect(within(screen.getByTestId('profile-figure-pages')).getByText('3')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Tout' }));
    expect(screen.getByText('Hasanat depuis le début')).toBeOnTheScreen();
    expect(within(screen.getByTestId('profile-figure-pages')).getByText('611')).toBeOnTheScreen();
    expect(screen.getByTestId('profile-chart-summary')).toHaveTextContent(/^Meilleur mois : /);
  });

  it('says what matters right under the figure, then draws each day, read by VoiceOver', async () => {
    await renderProfile();
    // The sentence that says what the chart shows comes before it (charts.md › Descriptive
    // content), in the same block as the figure it explains.
    expect(
      within(screen.getByTestId('profile-hero')).getByTestId('profile-chart-summary'),
    ).toHaveTextContent(/^Meilleur jour : lundi 23 novembre, 16[\s\u202f]000$/);
    expect(screen.getByLabelText(/^lundi 23 novembre, Hasanat : /)).toBeOnTheScreen();
    // The days still to come are not read.
    expect(screen.queryByLabelText(/^jeudi 26 novembre/)).toBeNull();
  });

  it('makes the chosen figure the large one, and the chart follows it', async () => {
    await renderProfile();
    await fireEvent.press(screen.getByRole('radio', { name: /^Temps de lecture, / }));
    expect(
      within(screen.getByTestId('profile-hero')).getByText('Temps de lecture cette semaine'),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('profile-hero-value')).toHaveTextContent('1 h 35 min');
    expect(screen.getByRole('radio', { name: /^Temps de lecture, / })).toBeChecked();
    await waitFor(() =>
      expect(
        screen.getByLabelText('mercredi 25 novembre, Temps de lecture : 1 heure 10 minutes'),
      ).toBeOnTheScreen(),
    );
    // The source of the estimate stays with the hasanat, still listed in the card.
    expect(screen.getByTestId('profile-hasanat-note')).toBeOnTheScreen();
  });

  it('tells each khatma as the garden it grew, the one in progress first, with its estimated end', async () => {
    await renderProfile();
    expect(screen.getByRole('header', { name: 'Tes jardins' })).toBeOnTheScreen();
    // 597 pages left at the daily goal of 5 pages, 3 already read today.
    expect(
      within(screen.getByTestId('profile-khatma-2')).getByText(
        'Jardin 2 · en cours · fin estimée le 24 mars 2027',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText(/^Jardin 1 · achevé le 1 sept\. 2026$/)).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('profile-khatma-1')).getByText(/^Khatma 1 · 604 pages/),
    ).toBeOnTheScreen();
  });

  it('gives the source of the estimate once', async () => {
    await renderProfile();
    expect(screen.getAllByText(/Tirmidhî/)).toHaveLength(1);
  });

  it('shows the level under the title and the garden in progress, named after its style (D46)', async () => {
    await renderProfile();
    expect(screen.getByLabelText('Niveau 2, Oasis')).toBeOnTheScreen();
    const garden = screen.getByTestId('profile-garden');
    // The picture is described by the card around it, not by itself.
    expect(
      within(garden).getByTestId('garden-scene', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(within(garden).getByText('Oasis')).toBeOnTheScreen();
    expect(within(garden).getByText('Jardin en cours')).toBeOnTheScreen();
  });

  it('opens "Mes jardins" from the garden in progress and from the badges', async () => {
    await renderProfile();
    openGardens.mockClear();
    await fireEvent.press(screen.getByTestId('profile-garden'));
    await fireEvent.press(screen.getByRole('button', { name: 'Mes jardins' }));
    expect(openGardens).toHaveBeenCalledTimes(2);
  });

  it('shows the badge earned, the garden in progress and the next level kept a surprise', async () => {
    await renderProfile();
    expect(
      screen.getByLabelText('Badge de la khatma 1, Cour à fontaine, obtenu le 1 septembre 2026'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Oasis, en cours, /)).toBeOnTheScreen();
    expect(screen.getByLabelText('Niveau 3, à venir')).toBeOnTheScreen();
    // The garden to come is never named.
    expect(screen.queryByText('Verger au bord de l’eau')).toBeNull();
  });

  it('lets the person hide their level from friends, and says what they see', async () => {
    await renderProfile();
    expect(screen.getByText('Tes proches voient ton niveau et tes badges.')).toBeOnTheScreen();
    await fireEvent(screen.getByTestId('profile-show-level-switch'), 'valueChange', false);
    expect(screen.getByText('Ton niveau et tes badges restent pour toi.')).toBeOnTheScreen();
  });

  it('says what will be counted, without a zero, before anything is read', async () => {
    await renderProfile({ empty: true });
    expect(screen.getByText('Ta première page t’attend')).toBeOnTheScreen();
    expect(screen.queryByTestId('profile-hero')).toBeNull();
    expect(screen.queryByTestId('profile-period')).toBeNull();
    // The bare garden, with no zero written under it.
    expect(
      within(screen.getByTestId('profile-garden')).getByTestId('garden-scene', {
        includeHiddenElements: true,
      }),
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
    expect(screen.getByTestId('profile-hero-value')).toHaveTextContent(/^≈\s28[,٬]000$/);
    expect(directionDependentStyles(screen.getByTestId('profile'))).toEqual([]);
  });
});

describe('ProfileScreen › settings behind one card', () => {
  it('lists no setting itself: one card, at the end, opens the settings', async () => {
    await renderProfile();
    expect(screen.queryByTestId('language')).toBeNull();
    expect(screen.queryByRole('adjustable', { name: 'Pages par jour' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Réglages' }));
    expect(openSettings).toHaveBeenCalledTimes(1);
  });

  it('keeps the card on a blank profile', async () => {
    await renderProfile({ empty: true });
    expect(screen.getByRole('button', { name: 'Réglages' })).toBeOnTheScreen();
  });

  it('says first, above the statistics, what data could not be read back, until it is read', async () => {
    await renderProfile({ dataResetNotice: 'journal' });
    expect(screen.getByRole('header', { name: 'À savoir' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('dismiss-data-reset-notice'));
    await waitFor(() => expect(screen.queryByRole('header', { name: 'À savoir' })).toBeNull());
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
    expect(await screen.findByTestId('profile-hero')).toBeOnTheScreen();
    expect(swiftUIViewsWithoutHost()).toEqual([]);
  });
});
