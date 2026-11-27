import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

import { HIZB_PAGE_RANGES } from '@/domain/khatm/__fixtures__/hizb-page-ranges';
import {
  buildCompletedKhatmas,
  day,
  pageRange,
  readPages,
} from '@/domain/khatm/__fixtures__/journal-builders';
import { getProgression } from '@/domain/levels';
import { showLanguage } from '@/features/garden/test-support/screen-conditions';
import { resetDeviceConditions, setDeviceConditions } from '@/ui/test-support/environment';

import { BadgeShelf } from '../badge-shelf';
import { formatBadgeDate } from '../format';
import { celebrationOf, ownShelf } from '../gardens-model';
import { KhatmaCelebrationScreen } from '../khatma-celebration-screen';
import { MyGardensScreen } from '../my-gardens-screen';
import { CAPTURE_SETTLE_MS } from '../share/share-card-host';

jest.mock('expo-haptics', () => ({
  ...jest.requireActual('expo-haptics'),
  notificationAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn(), releaseCapture: jest.fn() }));

const HIDDEN = { includeHiddenElements: true } as const;
const START = day('2026-03-01');
const twoKhatmasThenNine = readPages(
  buildCompletedKhatmas(2, START, 10),
  3,
  pageRange(1, 91),
  day('2026-06-01'),
);
const progression = getProgression(twoKhatmasThenNine, HIZB_PAGE_RANGES);
const [first, second] = progression.completed;
const card = () => within(screen.getByTestId('share-card', HIDDEN));

beforeEach(() => {
  jest.useFakeTimers();
  jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
  jest.mocked(Sharing.shareAsync).mockResolvedValue(undefined);
  jest.mocked(captureRef).mockResolvedValue('file:///cache/card.png');
});
afterEach(async () => {
  jest.useRealTimers();
  await resetDeviceConditions();
  jest.clearAllMocks();
});

/** What the host waits for before it takes the picture. */
async function drawCard() {
  await fireEvent(screen.getByTestId('share-card-host', HIDDEN), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 450 } },
  });
  await fireEvent(screen.getByTestId('share-card-icon', HIDDEN), 'load', {
    nativeEvent: { source: { width: 1024, height: 1024 } },
  });
  await act(async () => {
    jest.advanceTimersByTime(CAPTURE_SETTLE_MS);
  });
}

describe('"Partager" on the khatma celebration', () => {
  const celebration = celebrationOf(
    getProgression(buildCompletedKhatmas(1, START, 10), HIZB_PAGE_RANGES).completed[0]!,
  );

  async function show(language: 'fr' | 'en' | 'ar' = 'fr') {
    await showLanguage(language);
    await render(
      <KhatmaCelebrationScreen
        celebration={celebration}
        onSeeGarden={jest.fn()}
        onClose={jest.fn()}
      />,
    );
  }

  it('shares the picture of this khatma, with its days, and the system sheet opens on it', async () => {
    await show();
    await fireEvent.press(screen.getByRole('button', { name: 'Partager le badge de la khatma 1' }));
    expect(await screen.findByText('Khatma n°1 terminée', HIDDEN)).toBeOnTheScreen();
    expect(card().getByText('7', HIDDEN)).toBeOnTheScreen();
    await drawCard();
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      'file:///cache/card.png',
      expect.objectContaining({ mimeType: 'image/png' }),
    );
  });

  it('keeps the screen as it was: one prominent button, and the close button', async () => {
    await show();
    expect(screen.getByRole('button', { name: 'Voir mon nouveau jardin' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Fermer' })).toBeOnTheScreen();
  });

  it.each([
    ['en', 'Share the badge of khatma 1'],
    ['ar', 'مشاركة وسام الختمة 1'],
  ] as const)('is written in %s', async (language, name) => {
    await show(language);
    expect(screen.getByRole('button', { name })).toBeOnTheScreen();
  });

  it('turns the button off while a share runs', async () => {
    await show();
    const button = () => screen.getByRole('button', { name: 'Partager le badge de la khatma 1' });
    await fireEvent.press(button());
    expect(button()).toBeDisabled();
  });
});

describe('"Partager" on "Mes jardins"', () => {
  it('is on each completed level, and only there', async () => {
    await showLanguage('fr');
    await render(<MyGardensScreen progression={progression} garden={null} />);
    expect(screen.getByTestId('my-gardens-share-1')).toBeOnTheScreen();
    expect(screen.getByTestId('my-gardens-share-2')).toBeOnTheScreen();
    expect(screen.queryByTestId('my-gardens-share-3')).not.toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: /^Partager le badge/ })).toHaveLength(2);
  });

  it('shares the badge of the level it is under, with the days that khatma took', async () => {
    await showLanguage('fr');
    await render(<MyGardensScreen progression={progression} garden={null} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Partager le badge de la khatma 2' }));
    expect(await screen.findByText('Khatma n°2 terminée', HIDDEN)).toBeOnTheScreen();
    expect(card().getByText(String(second!.daysTaken), HIDDEN)).toBeOnTheScreen();
  });

  it('keeps each level one element for VoiceOver, the button beside it', async () => {
    await showLanguage('fr');
    await render(<MyGardensScreen progression={progression} garden={null} />);
    expect(
      screen.getByLabelText(
        `Niveau 1, Cour à fontaine, Achevé, Khatma 1 · ${formatBadgeDate(first!.completedOn, 'fr')}`,
      ),
    ).toBeOnTheScreen();
  });
});

describe('"Partager" on the badge shelf', () => {
  it('is under each earned badge when the shelf can share, and not otherwise', async () => {
    await showLanguage('fr');
    const items = ownShelf(progression);
    await render(<BadgeShelf items={items} onShare={jest.fn()} testID="shelf" />);
    expect(screen.getAllByRole('button', { name: /^Partager le badge/ })).toHaveLength(2);
    await screen.unmount();
    await render(<BadgeShelf items={items} testID="shelf" />);
    expect(screen.queryByRole('button', { name: /^Partager/ })).not.toBeOnTheScreen();
  });

  it('asks to share the khatma of the badge it is under', async () => {
    await showLanguage('fr');
    const onShare = jest.fn();
    await render(<BadgeShelf items={ownShelf(progression)} onShare={onShare} testID="shelf" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Partager le badge de la khatma 2' }));
    expect(onShare).toHaveBeenCalledWith(2);
  });

  it('still says each badge in one sentence', async () => {
    await showLanguage('fr');
    await render(<BadgeShelf items={ownShelf(progression)} onShare={jest.fn()} testID="shelf" />);
    expect(
      screen.getByLabelText(
        `Badge de la khatma 1, Cour à fontaine, obtenu le ${formatBadgeDate(first!.completedOn, 'fr')}`,
      ),
    ).toBeOnTheScreen();
  });

  it('mirrors in Arabic without any flipped style of its own', async () => {
    setDeviceConditions({ rightToLeft: true });
    await showLanguage('ar');
    await render(<BadgeShelf items={ownShelf(progression)} onShare={jest.fn()} testID="shelf" />);
    expect(screen.getAllByRole('button', { name: /^مشاركة وسام/ })).toHaveLength(2);
  });
});
