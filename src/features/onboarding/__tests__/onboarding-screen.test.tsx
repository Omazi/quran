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
    // The figure and its unit are two texts a gap apart. A space typed after the figure sat on
    // its outer side in Arabic, where a lone figure is still written left to right: the iPhone
    // showed "7صفحة" (iOS photo of 27 November 2026).
    const figure = screen.getByText(String(threeMonths.pagesPerDay));
    expect(figure).toBeOnTheScreen();
    expect(figure.parent).toHaveStyle({ flexDirection: 'row', columnGap: 4 });
    expect(
      screen.getByText(`Dans un mois : ${threeMonths.hizbAfter30Days} hizb`, {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '1 mois' }));
    const oneMonth = computeGoalPlan({ kind: '1-month' }, TODAY);
    expect(screen.getByRole('button', { name: '1 mois', selected: true })).toBeOnTheScreen();
    expect(screen.getByText(String(oneMonth.pagesPerDay))).toBeOnTheScreen();
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

  it('turns the garden alone in a plane of its own (iOS photos of 27 November 2026)', async () => {
    // On the iPhone, pages 1 to 9 showed half a garden and half the app's name ("atuk", "Jann"):
    // a view turned in 3D among its siblings goes behind them on one side and in front of them
    // on the other. Alone in a parent that is really drawn, it is flattened into that parent.
    await open({ page: 0 });
    const garden = screen.getByTestId('onboarding-garden', { includeHiddenElements: true });
    const plane = screen.getByTestId('onboarding-garden-plane', { includeHiddenElements: true });
    expect(garden.parent).toBe(plane);
    expect(plane.children).toHaveLength(1);
    expect(plane).toHaveProp('collapsable', false);
    expect(plane).toHaveProp('pointerEvents', 'none');
    expect(plane).toHaveStyle({ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 });
  });

  // The same rule for every view of the first launch, on pages turned both ways (-5°, +1°, +4°):
  // the CI screen check of 6f46ea0 showed the stage's views (garden, name, caption, verse, dots)
  // losing the side the garden turns away from on every turned page, whole on the straight ones.
  // Any view turned in 3D must be alone in a flat native view; none may sit among the others.
  it.each([0, 3, 6])('turns nothing in 3D among other views (page %i)', async (page) => {
    await open({ page });
    const turned = hostNodes(screen.getByTestId('onboarding')).filter(isTurnedIn3D);
    expect(turned.map((node) => node.props.testID)).toContain('onboarding-garden');
    for (const node of turned) {
      const { parent } = node;
      expect(parent?.props.collapsable).toBe(false);
      expect(parent === null ? [] : hostChildren(parent)).toEqual([node]);
      expect(parent === null ? false : isTurnedIn3D(parent)).toBe(false);
    }
  });
});

type Node = ReturnType<typeof screen.getByTestId>;

/** Every element under `root` (the test renderer holds host elements only: native views). */
function hostNodes(root: Node): Node[] {
  const found: Node[] = [];
  const visit = (node: Node) => {
    found.push(node);
    hostChildren(node).forEach(visit);
  };
  visit(root);
  return found;
}

function hostChildren(node: Node): Node[] {
  return node.children.filter((child): child is Node => typeof child !== 'string');
}

/** A transform with depth: a perspective or a turn around a horizontal or vertical axis. */
function isTurnedIn3D(node: Node): boolean {
  const flat = [node.props.style].flat(Infinity) as ({ transform?: object[] } | null | false)[];
  return flat.some(
    (style) =>
      style !== null &&
      style !== false &&
      style !== undefined &&
      (style.transform ?? []).some(
        (step) => 'perspective' in step || 'rotateX' in step || 'rotateY' in step,
      ),
  );
}
