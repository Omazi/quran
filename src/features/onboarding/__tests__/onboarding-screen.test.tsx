import { act, fireEvent, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

import type { NotificationPermissions } from '@/data/notifications';
import { quranRepository } from '@/data/quran';
import { computeGoalPlan } from '@/domain/goal-plan';
import type { MushafPage } from '@/domain/quran';
import { parseLocalDate } from '@/domain/shared/local-date';
import { renderWithStore } from '@/features/settings/test-support/render-with-store';
import { resetDeviceConditions, setDeviceConditions } from '@/ui/test-support/environment';

import { OnboardingScreen } from '../onboarding-screen';
import { ONBOARDING_PAGES } from '../pages';
import { useOnboarding, type OnboardingDependencies } from '../use-onboarding';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  impactAsync: jest.fn(async () => {}),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
}));

const TODAY = parseLocalDate('2026-11-25');
const WINDOW = { x: 0, y: 0, width: 390, height: 844 };
const LAST = ONBOARDING_PAGES.length - 1;

let fatiha: MushafPage;
beforeAll(async () => {
  fatiha = await quranRepository.getPage(1);
});
afterEach(resetDeviceConditions);

function permissions(status: 'undetermined' | 'granted' = 'undetermined') {
  const notifications: NotificationPermissions = {
    getStatus: jest.fn(async () => status),
    request: jest.fn(async () => 'granted' as const),
  };
  return notifications;
}

function Flow(props: Omit<OnboardingDependencies, 'today'>) {
  const { model, actions } = useOnboarding({ ...props, today: TODAY });
  return <OnboardingScreen model={model} actions={actions} fatiha={fatiha} />;
}

async function open(
  options: { page?: number; completed?: boolean; notifications?: NotificationPermissions } = {},
) {
  const onFinished = jest.fn();
  const notifications = options.notifications ?? permissions();
  const store = await renderWithStore(
    <Flow
      notifications={notifications}
      onFinished={onFinished}
      initialPageIndex={options.page ?? 0}
    />,
    { settings: { onboardingCompleted: options.completed ?? false } },
  );
  await fireEvent(screen.getByTestId('onboarding'), 'layout', { nativeEvent: { layout: WINDOW } });
  await fireEvent(screen.getByTestId('onboarding-pager-pages'), 'layout', {
    nativeEvent: { layout: WINDOW },
  });
  return { store, onFinished, notifications };
}

async function stepTo(page: number) {
  const dots = () =>
    screen.getByTestId('onboarding-pager-indicator', { includeHiddenElements: true });
  for (let k = 0; k < page; k += 1) {
    await fireEvent(dots(), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
  }
}

describe('the first launch, "voix" direction', () => {
  it('opens on the bare earth, with its words and the hint to swipe up, and the scene described', async () => {
    await open();
    expect(screen.getByRole('header', { name: 'Une terre nue.' })).toBeOnTheScreen();
    expect(screen.getByText('Glisse vers le haut')).toBeOnTheScreen();
    expect(screen.getByRole('image', { name: 'Jardin : terre nue' })).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding-pager-indicator')).toHaveAccessibilityValue({
      text: 'Page 1 sur 16',
    });
    // No skip and no next button (owner's decision).
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('turns one page per step, with a light tick as each page settles', async () => {
    await open();
    await stepTo(1);
    expect(screen.getByRole('header', { name: 'Lis, et l’eau coule.' })).toBeOnTheScreen();
    expect(screen.getByRole('image', { name: 'Jardin au hizb 8' })).toBeOnTheScreen();
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it('describes each feature page in words for screen readers', async () => {
    await open({ page: 11 });
    expect(
      screen.getByRole('header', { name: 'Lis à voix haute, l’appli te suit.' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('image', { name: /^Lecture à voix haute/ })).toBeOnTheScreen();
    // The silent demonstration: no play button, there is no licensed recitation audio yet.
    expect(screen.queryByRole('button')).toBeNull();
    await stepTo(1);
    expect(
      screen.getByRole('image', { name: /^Passage reconnu à l’écoute : Al-Kahf/ }),
    ).toBeOnTheScreen();
    await stepTo(1);
    expect(screen.getByRole('image', { name: /^Jardins de tes proches/ })).toBeOnTheScreen();
  });

  it('shows what the goal means, live, from the goal-plan domain', async () => {
    await open({ page: 14 });
    const threeMonths = computeGoalPlan({ kind: '3-months' }, TODAY);
    expect(screen.getByRole('button', { name: '3 mois', selected: true })).toBeOnTheScreen();
    expect(screen.getByText(String(threeMonths.pagesPerDay) + ' ')).toBeOnTheScreen();
    expect(
      screen.getByText(`Dans un mois : ${threeMonths.hizbAfter30Days} hizb`, {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '1 mois' }));
    const oneMonth = computeGoalPlan({ kind: '1-month' }, TODAY);
    expect(screen.getByRole('button', { name: '1 mois', selected: true })).toBeOnTheScreen();
    expect(screen.getByText(String(oneMonth.pagesPerDay) + ' ')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'À mon rythme' }));
    expect(screen.getByText('Quand tu veux')).toBeOnTheScreen();
  });

  it('saves the goal, the moment and the reminders on "Créer mon jardin", then asks to notify', async () => {
    const { store, onFinished, notifications } = await open({ page: 14 });
    await fireEvent.press(screen.getByRole('button', { name: '1 an' }));
    await stepTo(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Après Fajr' }));
    await fireEvent(screen.getByTestId('onboarding-friday'), 'valueChange', false);
    expect(store.getState().settings.onboardingCompleted).toBe(false);
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Créer mon jardin' }));
    });
    const { settings } = store.getState();
    expect(settings.goalKind).toBe('1-year');
    expect(settings.dailyGoalPages).toBe(computeGoalPlan({ kind: '1-year' }, TODAY).pagesPerDay);
    expect(settings.reminders).toMatchObject({
      dailyEnabled: true,
      dailyTime: { hour: 6, minute: 30 },
      fridayKahfEnabled: false,
      thirstyGardenEnabled: true,
    });
    expect(settings.onboardingCompleted).toBe(true);
    expect(notifications.request).toHaveBeenCalledTimes(1);
    // A medium impact on the press (motion spec §13).
    expect(Haptics.impactAsync).toHaveBeenCalledWith('medium');
    expect(onFinished).toHaveBeenCalledWith({ isReplay: false });
  });

  it('asks nothing of the system when the permission was already given, or when opened again', async () => {
    const granted = permissions('granted');
    await open({ page: LAST, notifications: granted });
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Créer mon jardin' }));
    });
    expect(granted.request).not.toHaveBeenCalled();
  });

  it('ends with "Terminé" and no question when opened again from the settings', async () => {
    const { notifications, onFinished } = await open({ page: LAST, completed: true });
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Terminé' }));
    });
    expect(notifications.getStatus).not.toHaveBeenCalled();
    expect(onFinished).toHaveBeenCalledWith({ isReplay: true });
  });

  it('with "reduce motion", moves nothing: the words only fade, the garden does not turn', async () => {
    setDeviceConditions({ reducedMotion: true });
    await open({ page: 0 });
    // Let the device setting arrive.
    await act(async () => {});
    const copy = screen.getByRole('header', { name: 'Une terre nue.' }).parent;
    expect(copy).toHaveStyle({ transform: [{ translateY: 0 }] });
    // Straight and still: no 3D transform at all, no arrival.
    expect(screen.getByTestId('onboarding-garden', { includeHiddenElements: true })).toHaveStyle({
      transform: [{ translateY: 0 }, { scale: 1 }],
    });
  });

  it('turns the garden a few degrees per page without reduce motion', async () => {
    await open({ page: 0 });
    // At the first frame (the frame clock does not run here) the garden is at the start of its
    // arrival: 14 points low, at 97 % (motion spec §2), and already turned -5°.
    expect(screen.getByTestId('onboarding-garden', { includeHiddenElements: true })).toHaveStyle({
      transform: [{ translateY: 14 }, { scale: 0.97 }, { perspective: 1400 }, { rotateY: '-5deg' }],
    });
  });
});
