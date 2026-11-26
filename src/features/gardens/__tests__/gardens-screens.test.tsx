import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

import { HIZB_PAGE_RANGES } from '@/domain/khatm/__fixtures__/hizb-page-ranges';
import {
  buildCompletedKhatmas,
  day,
  pageRange,
  readPages,
} from '@/domain/khatm/__fixtures__/journal-builders';
import { getProgression } from '@/domain/levels';
import { showLanguage } from '@/features/garden/test-support/screen-conditions';
import {
  APPEARANCES_AND_DIRECTIONS,
  directionDependentStyles,
  resetDeviceConditions,
  setDeviceConditions,
} from '@/ui/test-support/environment';

import { BadgeShelf } from '../badge-shelf';
import { FriendLevelSection } from '../friend-level-section';
import { celebrationOf, ownShelf } from '../gardens-model';
import { KhatmaCelebrationScreen } from '../khatma-celebration-screen';
import { MyGardensScreen } from '../my-gardens-screen';

jest.mock('expo-haptics', () => ({
  ...jest.requireActual('expo-haptics'),
  notificationAsync: jest.fn(() => Promise.resolve()),
}));

afterEach(resetDeviceConditions);

const START = day('2026-03-01');
const oneKhatmaThenNine = readPages(
  buildCompletedKhatmas(1, START, 10),
  2,
  pageRange(1, 91),
  day('2026-04-01'),
);
const progression = getProgression(oneKhatmaThenNine, HIZB_PAGE_RANGES);

describe('the khatma celebration', () => {
  const celebration = celebrationOf(
    getProgression(buildCompletedKhatmas(1, START, 10), HIZB_PAGE_RANGES).completed[0]!,
  );

  async function show(language: 'fr' | 'en' | 'ar' = 'fr') {
    await showLanguage(language);
    const onSeeGarden = jest.fn();
    const onClose = jest.fn();
    await render(
      <KhatmaCelebrationScreen
        celebration={celebration}
        onSeeGarden={onSeeGarden}
        onClose={onClose}
      />,
    );
    return { onSeeGarden, onClose };
  }

  it('shows the badge, the invocation, the numbers and the new garden', async () => {
    await show();
    expect(screen.getByLabelText('Badge de la khatma 1, Cour à fontaine')).toBeOnTheScreen();
    expect(screen.getByText('Khatma terminée')).toBeOnTheScreen();
    expect(screen.getByText('تقبّل الله منك')).toBeOnTheScreen();
    expect(screen.getByText('Qu’Allah l’accepte de toi.')).toBeOnTheScreen();
    expect(screen.getByLabelText('60 hizb, 604 pages, 7 jours')).toBeOnTheScreen();
    expect(screen.getByText('Ton nouveau jardin t’attend')).toBeOnTheScreen();
    expect(screen.getByText('Niveau 2 · Oasis, sur une terre nue')).toBeOnTheScreen();
  });

  it('marks the moment with a success haptic', async () => {
    jest.mocked(Haptics.notificationAsync).mockClear();
    await show();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success,
    );
  });

  it('leads to the new garden, or closes', async () => {
    const { onSeeGarden, onClose } = await show();
    await fireEvent.press(screen.getByRole('button', { name: 'Voir mon nouveau jardin' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));
    expect(onSeeGarden).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('draws no petals and still shows everything when motion is reduced', async () => {
    setDeviceConditions({ reducedMotion: true });
    await show();
    expect(await screen.findByText('Khatma terminée')).toBeOnTheScreen();
  });

  it('is written in Arabic without repeating the invocation, mirrored', async () => {
    setDeviceConditions({ rightToLeft: true });
    await show('ar');
    expect(screen.getByText('تمّت الختمة')).toBeOnTheScreen();
    expect(screen.getAllByText('تقبّل الله منك')).toHaveLength(1);
    expect(directionDependentStyles(screen.getByTestId('khatma-celebration'))).toEqual([]);
  });

  it('beyond the last garden, says the same garden grows anew', async () => {
    const last = getProgression(buildCompletedKhatmas(7, START, 30), HIZB_PAGE_RANGES)
      .completed[6]!;
    await showLanguage('fr');
    await render(
      <KhatmaCelebrationScreen
        celebration={celebrationOf(last)}
        onSeeGarden={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(
      screen.getByText('Un nouveau jardin, Jardin de nuit, sur une terre nue'),
    ).toBeOnTheScreen();
  });
});

describe('"Mes jardins"', () => {
  it('shows the completed level with its khatma and date, the current one, and secrets', async () => {
    await showLanguage('fr');
    await render(<MyGardensScreen progression={progression} garden={null} />);
    expect(
      screen.getByLabelText('Niveau 1, Cour à fontaine, Achevé, Khatma 1 · 7 mars 2026'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Niveau 2, Oasis, En cours · 9 hizb sur 60')).toBeOnTheScreen();
    for (let level = 3; level <= 7; level += 1) {
      expect(screen.getByLabelText(`Niveau ${level}, à venir, encore secret`)).toBeOnTheScreen();
    }
    for (const secret of ['Verger au bord de l’eau', 'Jardin de nuit', 'Cerisiers en fleurs']) {
      expect(screen.queryByText(secret)).toBeNull();
    }
    expect(screen.queryByTestId('my-gardens-last')).toBeNull();
  });

  it('says more gardens will come once the last one is reached', async () => {
    await showLanguage('fr');
    const atTheTop = getProgression(buildCompletedKhatmas(6, START, 30), HIZB_PAGE_RANGES);
    await render(<MyGardensScreen progression={atTheTop} garden={null} />);
    expect(screen.getByTestId('my-gardens-last')).toBeOnTheScreen();
  });

  it.each(APPEARANCES_AND_DIRECTIONS)(
    'lays out without physical sides (%o)',
    async (conditions) => {
      setDeviceConditions(conditions);
      await showLanguage(conditions.rightToLeft ? 'ar' : 'fr');
      await render(<MyGardensScreen progression={progression} garden={null} />);
      expect(directionDependentStyles(screen.getByTestId('my-gardens'))).toEqual([]);
    },
  );
});

describe('the badge shelf', () => {
  it('shares its width while it holds three places or fewer', async () => {
    await showLanguage('fr');
    await render(<BadgeShelf items={ownShelf(progression)} testID="shelf" />);
    expect(screen.queryByTestId('shelf-scroll')).toBeNull();
  });

  it('reads each place as one sentence, in English too', async () => {
    await showLanguage('en');
    await render(<BadgeShelf items={ownShelf(progression)} testID="shelf" />);
    expect(
      screen.getByLabelText('Khatma 1 badge, Fountain Courtyard, earned on March 7, 2026'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Oasis, in progress, 9 hizb of 60')).toBeOnTheScreen();
    expect(screen.getByLabelText('Level 3, coming up')).toBeOnTheScreen();
  });

  it('scrolls sideways once there are more than three places', async () => {
    await showLanguage('fr');
    const many = getProgression(buildCompletedKhatmas(4, START, 30), HIZB_PAGE_RANGES);
    await render(<BadgeShelf items={ownShelf(many)} testID="shelf" />);
    expect(screen.getByTestId('shelf-scroll')).toBeOnTheScreen();
    expect(screen.getAllByLabelText(/^Badge de la khatma/)).toHaveLength(4);
  });
});

describe('a friend’s level', () => {
  const badges = [
    { userId: 'f', khatmNumber: 1, completedOn: day('2026-02-02') },
    { userId: 'f', khatmNumber: 2, completedOn: day('2026-08-30') },
  ];
  const shared = {
    level: 3,
    badgeCount: 2,
    badges,
    wordsRead: 1,
    versesRead: 1,
    hasanatEstimate: 10,
  };

  it('shows their level and garden, their badges with dates, and the garden in progress', async () => {
    await showLanguage('fr');
    await render(<FriendLevelSection level={shared} hizbCompleted={18} />);
    expect(screen.getByLabelText('Niveau 3, Verger au bord de l’eau')).toBeOnTheScreen();
    expect(screen.getByText('2 khatmas')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Badge de la khatma 2, Oasis, obtenu le 30 août 2026'),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Verger au bord de l’eau, en cours, 18 hizb sur 60'),
    ).toBeOnTheScreen();
    // What comes next in someone else's path is not shown.
    expect(screen.queryByLabelText(/à venir/)).toBeNull();
  });

  it('shows nothing when the friend hides their level', async () => {
    await showLanguage('fr');
    await render(<FriendLevelSection level={null} hizbCompleted={18} />);
    expect(screen.queryByTestId('friend-level-section')).toBeNull();
  });
});
