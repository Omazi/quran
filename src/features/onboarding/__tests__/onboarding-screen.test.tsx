import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { PlatformColor, Text } from 'react-native';

import {
  createInertNotificationPermissions,
  type NotificationPermissions,
} from '@/data/notifications';
import {
  renderWithStore,
  type RenderWithStoreOptions,
} from '@/features/settings/test-support/render-with-store';
import { DEFAULT_REMINDERS } from '@/store';
import {
  APPEARANCES_AND_DIRECTIONS,
  LARGEST_FONT_SCALE,
  directionDependentStyles,
  fixedHeightsAroundText,
  resetDeviceConditions,
  setDeviceConditions,
  styleOf,
  touchTargetHeight,
  type RenderedElement,
} from '@/ui/test-support/environment';

import { OnboardingScreen } from '../onboarding-screen';
import {
  ONBOARDING_PAGES_FULL,
  ONBOARDING_PAGES_SHORT,
  type OnboardingPage,
  type OnboardingScene,
} from '../pages';
import type { SceneRenderer } from '../scene';
import { useOnboarding, type OnboardingDependencies } from '../use-onboarding';

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

const NO_BREAK_SPACE = ' ';
const GOAL_PAGE = 14;
const REMINDERS_PAGE = 15;
const WINDOW = { x: 0, y: 0, width: 390, height: 700 };

interface HarnessProps extends OnboardingDependencies {
  renderScene?: SceneRenderer;
}

/** The first-launch flow as its route composes it, with dependencies the test controls. */
function OnboardingHarness({ renderScene, ...dependencies }: HarnessProps) {
  const { model, actions } = useOnboarding(dependencies);
  return <OnboardingScreen model={model} actions={actions} renderScene={renderScene} />;
}

interface RenderOnboardingOptions extends RenderWithStoreOptions {
  page?: number;
  pages?: readonly OnboardingPage[];
  notifications?: NotificationPermissions;
  renderScene?: SceneRenderer;
}

/** The view of the pager that holds the pages: it draws them once it knows its width. */
function pagesFrame(): RenderedElement {
  const frame = screen.getByTestId('onboarding-pager').children[0];
  if (frame === undefined || typeof frame === 'string') throw new Error('No pages frame.');
  return frame;
}

async function renderOnboarding({
  page = 0,
  pages = ONBOARDING_PAGES_FULL,
  notifications = createInertNotificationPermissions({ status: 'undetermined', answer: 'granted' }),
  renderScene,
  ...options
}: RenderOnboardingOptions = {}) {
  const onFinished = jest.fn();
  const request = jest.spyOn(notifications, 'request');
  const store = await renderWithStore(
    <OnboardingHarness
      notifications={notifications}
      onFinished={onFinished}
      pages={pages}
      initialPageIndex={page}
      renderScene={renderScene}
    />,
    options,
  );
  // On an iPhone the system pager lays its pages out by itself.
  if (options.onIOS !== true) {
    await fireEvent(pagesFrame(), 'layout', { nativeEvent: { layout: WINDOW } });
  }
  return { store, onFinished, request };
}

function indicator() {
  return screen.getByTestId('onboarding-pager-indicator');
}

/** The names of the buttons on screen, in reading order: their label, or the text they show. */
function buttonNames(): string[] {
  return screen.queryAllByRole('button').map((button) => {
    if (typeof button.props.accessibilityLabel === 'string') return button.props.accessibilityLabel;
    return button
      .queryAll(({ type }) => type === 'Text')
      .flatMap((text) => text.children.filter((child) => typeof child === 'string'))
      .join(' ');
  });
}

afterEach(resetDeviceConditions);

describe('first-launch flow', () => {
  it.each(APPEARANCES_AND_DIRECTIONS)(
    'opens on the bare earth: a named scene, a title, one sentence and the page indicator ($scheme, right to left: $rightToLeft)',
    async (conditions) => {
      setDeviceConditions(conditions);
      await renderOnboarding();

      expect(
        screen.getByRole('image', { name: `Jardin${NO_BREAK_SPACE}: terre nue` }),
      ).toBeOnTheScreen();
      expect(screen.getByRole('header', { name: 'Une terre nue.' })).toBeOnTheScreen();
      expect(
        screen.getByText('Soixante hizb pour en faire un jardin. Glisse pour continuer.'),
      ).toBeOnTheScreen();
      expect(indicator()).toHaveProp('accessibilityLabel', 'Présentation');
      expect(indicator()).toHaveAccessibilityValue({ text: 'Page 1 sur 16' });
      expect(directionDependentStyles(screen.getByTestId('onboarding'))).toEqual([]);
    },
  );

  it('has no button to continue or to skip: a swipe is the way through', async () => {
    await renderOnboarding();
    expect(buttonNames()).toEqual([]);
    expect(screen.queryByText(/continuer$|passer|suivant/i)).toBeNull();
  });

  const SCENES_AND_TITLES: readonly (readonly [number, string | null, string])[] = [
    [0, `Jardin${NO_BREAK_SPACE}: terre nue`, 'Une terre nue.'],
    [1, 'Jardin au hizb 8', 'Lis, et l’eau coule.'],
    [2, 'Jardin au hizb 20', 'Un hizb, un nouvel élément.'],
    [3, 'Jardin au hizb 30', 'À mi-chemin, les murs s’élèvent.'],
    [4, 'Jardin au hizb 40', 'Les portes s’ouvrent.'],
    [5, 'Jardin au hizb 60', 'Ton jardin est complet.'],
    [6, 'Jardin après 3 jours sans lecture', 'Si tu arrêtes de lire, il a soif.'],
    [7, 'Jardin après 6 jours sans lecture', 'Puis il fane.'],
    [8, 'Jardin après 10 jours sans lecture', 'Les arbres se dénudent.'],
    [9, 'Jardin après 14 jours sans lecture', 'Et il redevient une terre morte.'],
    [10, 'Jardin qui revit après une page', 'Une page suffit pour le faire revivre.'],
    [11, 'Lecture à voix haute, suivie mot à mot', 'Lis à voix haute, l’appli te suit.'],
    [12, 'Passage reconnu à l’écoute', `D’où vient ce passage${NO_BREAK_SPACE}?`],
    [13, 'Jardins de tes proches', 'Avec tes proches.'],
    [GOAL_PAGE, null, 'Ton objectif du jour.'],
    [REMINDERS_PAGE, null, 'Tes rappels.'],
  ];

  it.each(SCENES_AND_TITLES)(
    'shows page %i with its scene (%s) and its title (%s)',
    async (page, sceneName, title) => {
      await renderOnboarding({ page });
      expect(screen.getByRole('header', { name: title })).toBeOnTheScreen();
      expect(indicator()).toHaveAccessibilityValue({ text: `Page ${page + 1} sur 16` });
      if (sceneName === null) {
        expect(screen.queryByRole('image')).toBeNull();
      } else {
        expect(screen.getByRole('image', { name: sceneName })).toBeOnTheScreen();
      }
    },
  );

  it('has a title and a sentence on every page of the full flow', () => {
    expect(SCENES_AND_TITLES).toHaveLength(ONBOARDING_PAGES_FULL.length);
  });

  it('moves one page at a time from the page indicator, forwards and back', async () => {
    await renderOnboarding();
    await fireEvent.press(screen.getByTestId('onboarding-pager-indicator-next'));
    expect(indicator()).toHaveAccessibilityValue({ text: 'Page 2 sur 16' });
    expect(screen.getByRole('header', { name: 'Lis, et l’eau coule.' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('onboarding-pager-indicator-previous'));
    expect(indicator()).toHaveAccessibilityValue({ text: 'Page 1 sur 16' });
  });

  it('lets a screen reader turn the pages without a swipe', async () => {
    await renderOnboarding();
    await fireEvent(indicator(), 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    await fireEvent(indicator(), 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    expect(indicator()).toHaveAccessibilityValue({ text: 'Page 3 sur 16' });
    await fireEvent(indicator(), 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    });
    expect(indicator()).toHaveAccessibilityValue({ text: 'Page 2 sur 16' });
  });

  it('shows the short flow when given its pages, with no other change', async () => {
    await renderOnboarding({ pages: ONBOARDING_PAGES_SHORT, page: 9 });
    expect(indicator()).toHaveAccessibilityValue({ text: 'Page 10 sur 10' });
    expect(screen.getByRole('header', { name: 'Tes rappels.' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continuer' })).toBeOnTheScreen();
  });

  it('draws its scenes with the function it is given', async () => {
    const scenes: OnboardingScene[] = [];
    const renderScene: SceneRenderer = (scene) => {
      scenes.push(scene);
      return <Text>{`Scène ${scene.kind}`}</Text>;
    };
    await renderOnboarding({ page: 1, renderScene });
    expect(scenes).toContainEqual({ kind: 'garden', hizbCompleted: 8 });
    expect(screen.queryByRole('image')).toBeNull();
    expect(screen.getAllByText('Scène garden').length).toBeGreaterThan(0);
  });

  it('is written in Arabic, mirrored, for a person who reads Arabic', async () => {
    setDeviceConditions({ rightToLeft: true });
    await renderOnboarding({ language: 'ar', page: 1 });
    expect(screen.getByRole('image', { name: 'الحديقة عند الحزب 8' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'اقرأ، فيجري الماء.' })).toBeOnTheScreen();
    expect(indicator()).toHaveProp('accessibilityLabel', 'التعريف');
    expect(indicator()).toHaveAccessibilityValue({ text: 'الصفحة 2 من 16' });
    expect(directionDependentStyles(screen.getByTestId('onboarding'))).toEqual([]);
  });

  it.each([0, 11, GOAL_PAGE, REMINDERS_PAGE])(
    'cuts no text on page %i at the largest text size',
    async (page) => {
      setDeviceConditions({ fontScale: LARGEST_FONT_SCALE });
      await renderOnboarding({ page });
      expect(fixedHeightsAroundText(screen.getByTestId('onboarding'))).toEqual([]);
    },
  );

  it('sits on the system background, and on the grouped one where a page shows a list', async () => {
    await renderOnboarding({ page: 0 });
    expect(styleOf(screen.getByTestId('onboarding')).backgroundColor).toEqual(
      PlatformColor('systemBackground'),
    );
    await fireEvent.press(screen.getByTestId('onboarding-pager-indicator-next'));
    expect(styleOf(screen.getByTestId('onboarding')).backgroundColor).toEqual(
      PlatformColor('systemBackground'),
    );
  });

  it.each([GOAL_PAGE, REMINDERS_PAGE])('puts page %i on the grouped background', async (page) => {
    await renderOnboarding({ page });
    expect(styleOf(screen.getByTestId('onboarding')).backgroundColor).toEqual(
      PlatformColor('systemGroupedBackground'),
    );
  });

  it.each([0, GOAL_PAGE, REMINDERS_PAGE])(
    'asks an iPhone for system components only on page %i, each inside a host',
    async (page) => {
      await renderOnboarding({ page, onIOS: true });
      expect(screen.getByTestId('onboarding')).toBeOnTheScreen();
    },
  );
});

describe('daily goal page', () => {
  function stepper() {
    return screen.getByRole('adjustable', { name: 'Pages par jour' });
  }

  it('shows a goal already in place, with what it means, and no button', async () => {
    await renderOnboarding({ page: GOAL_PAGE });
    expect(
      screen.getByText('C’est toi qui décides. Tu pourras le changer quand tu veux.'),
    ).toBeOnTheScreen();
    expect(stepper()).toHaveAccessibilityValue({ text: '5' });
    expect(
      screen.getByText(
        `5 pages par jour, soit un demi-hizb${NO_BREAK_SPACE}: une khatma en 121 jours.`,
      ),
    ).toBeOnTheScreen();
    expect(touchTargetHeight(stepper())).toBeGreaterThanOrEqual(44);
  });

  it('saves the goal as the person steps, and rewrites the note each time', async () => {
    const { store } = await renderOnboarding({ page: GOAL_PAGE });
    for (let step = 0; step < 5; step += 1) {
      await fireEvent.press(screen.getByTestId('daily-goal-increment'));
    }
    expect(store.getState().settings.dailyGoalPages).toBe(10);
    expect(stepper()).toHaveAccessibilityValue({ text: '10' });
    expect(
      screen.getByText(`10 pages par jour, soit un hizb${NO_BREAK_SPACE}: une khatma en 61 jours.`),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('daily-goal-decrement'));
    expect(store.getState().settings.dailyGoalPages).toBe(9);
    expect(
      screen.getByText(`9 pages par jour${NO_BREAK_SPACE}: une khatma en 68 jours.`),
    ).toBeOnTheScreen();
  });

  it('can be passed without touching anything: the goal stays the one proposed', async () => {
    const { store } = await renderOnboarding({ page: GOAL_PAGE });
    await fireEvent.press(screen.getByTestId('onboarding-pager-indicator-next'));
    expect(indicator()).toHaveAccessibilityValue({ text: 'Page 16 sur 16' });
    expect(store.getState().settings.dailyGoalPages).toBe(5);
  });
});

describe('reminders page', () => {
  const WILL_ASK = 'Ton téléphone te demandera ensuite d’autoriser les notifications.';
  const DENIED =
    'Les notifications de l’appli sont désactivées. Pour recevoir tes rappels, autorise-les dans les réglages du téléphone.';
  const NONE = 'Sans rappel, l’appli ne t’envoie aucune notification.';
  const ALL_OFF = {
    ...DEFAULT_REMINDERS,
    dailyEnabled: false,
    thirstyGardenEnabled: false,
    fridayKahfEnabled: false,
  };

  function finishButton() {
    return screen.getByRole('button', { name: 'Continuer' });
  }

  it('shows the three reminders, the time of the daily one, and a single button', async () => {
    await renderOnboarding({ page: REMINDERS_PAGE });
    expect(screen.getByText('Pour que ton jardin ne manque jamais d’eau.')).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: 'Rappel du jour' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Quand le jardin a soif' })).toBeChecked();
    expect(
      screen.getByRole('switch', { name: `Le vendredi${NO_BREAK_SPACE}: sourate Al-Kahf` }),
    ).toBeChecked();
    // The time rows open the system's picker; the only button that leaves the page is the last.
    expect(buttonNames()).toEqual(['Heure', 'Heure du vendredi', 'Continuer']);
    expect(touchTargetHeight(finishButton())).toBeGreaterThanOrEqual(44);
  });

  it('saves each switch, and shows a time only while a reminder uses it', async () => {
    const { store } = await renderOnboarding({ page: REMINDERS_PAGE });
    await fireEvent.press(screen.getByRole('switch', { name: 'Rappel du jour' }));
    expect(store.getState().settings.reminders.dailyEnabled).toBe(false);
    // The garden's reminders come at the same time: it stays until they are off too.
    expect(screen.getByRole('button', { name: 'Heure' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('switch', { name: 'Quand le jardin a soif' }));
    expect(store.getState().settings.reminders.thirstyGardenEnabled).toBe(false);
    expect(screen.queryByRole('button', { name: 'Heure' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Heure du vendredi' })).toBeOnTheScreen();
  });

  it('does not ask for the permission while the person only sets the switches', async () => {
    const { request } = await renderOnboarding({
      page: REMINDERS_PAGE,
      settings: { reminders: ALL_OFF },
    });
    await fireEvent.press(screen.getByRole('switch', { name: 'Rappel du jour' }));
    expect(request).not.toHaveBeenCalled();
  });

  it('says that the phone is about to ask, before the button that leads to the question', async () => {
    await renderOnboarding({ page: REMINDERS_PAGE });
    expect(await screen.findByText(WILL_ASK)).toBeOnTheScreen();
    // The button does not borrow the word of the system's alert.
    expect(screen.queryByText(/autoriser$|^autoriser|allow/i)).toBeNull();
  });

  it.each(['granted', 'denied'] as const)(
    'asks the system once the button is pressed and enters the app whatever the answer: %s',
    async (answer) => {
      const notifications = createInertNotificationPermissions({ status: 'undetermined', answer });
      const { store, onFinished, request } = await renderOnboarding({
        page: REMINDERS_PAGE,
        notifications,
      });
      expect(store.getState().settings.onboardingCompleted).toBe(false);

      await fireEvent.press(finishButton());
      await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
      expect(request).toHaveBeenCalledTimes(1);
      expect(onFinished).toHaveBeenCalledWith({ isReplay: false });
      expect(store.getState().settings.onboardingCompleted).toBe(true);
      // The person's choice of reminders is kept as they made it.
      expect(store.getState().settings.reminders).toEqual(DEFAULT_REMINDERS);
      await expect(notifications.getStatus()).resolves.toBe(answer);
    },
  );

  it('waits for the answer to the system before entering the app', async () => {
    let answer: (status: 'granted') => void = () => {};
    const notifications: NotificationPermissions = {
      getStatus: async () => 'undetermined',
      request: () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    };
    const { store, onFinished } = await renderOnboarding({ page: REMINDERS_PAGE, notifications });
    await fireEvent.press(finishButton());
    await fireEvent.press(finishButton());
    expect(onFinished).not.toHaveBeenCalled();
    expect(store.getState().settings.onboardingCompleted).toBe(false);
    expect(finishButton()).toBeDisabled();

    answer('granted');
    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
  });

  it('does not ask the system when every reminder is off, and says what that means', async () => {
    const { store, onFinished, request } = await renderOnboarding({
      page: REMINDERS_PAGE,
      settings: { reminders: ALL_OFF },
    });
    expect(await screen.findByText(NONE)).toBeOnTheScreen();
    expect(screen.queryByText(WILL_ASK)).toBeNull();

    await fireEvent.press(finishButton());
    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
    expect(request).not.toHaveBeenCalled();
    expect(store.getState().settings.onboardingCompleted).toBe(true);
  });

  it('follows the switches: the notice changes as the last reminder goes off and back on', async () => {
    await renderOnboarding({
      page: REMINDERS_PAGE,
      settings: { reminders: { ...ALL_OFF, dailyEnabled: true } },
    });
    expect(await screen.findByText(WILL_ASK)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('switch', { name: 'Rappel du jour' }));
    expect(screen.getByText(NONE)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('switch', { name: 'Quand le jardin a soif' }));
    expect(screen.getByText(WILL_ASK)).toBeOnTheScreen();
  });

  it('announces nothing when the person has already allowed the notifications', async () => {
    await renderOnboarding({
      page: REMINDERS_PAGE,
      notifications: createInertNotificationPermissions({ status: 'granted' }),
    });
    await waitFor(() => expect(screen.queryByText(WILL_ASK)).toBeNull());
    expect(screen.queryByText(DENIED)).toBeNull();
  });

  it('says when the system already blocks the notifications, and offers no other way out', async () => {
    const { onFinished } = await renderOnboarding({
      page: REMINDERS_PAGE,
      notifications: createInertNotificationPermissions({ status: 'denied' }),
    });
    expect(await screen.findByText(DENIED)).toBeOnTheScreen();
    expect(screen.queryByTestId('open-system-settings')).toBeNull();
    expect(buttonNames()).toEqual(['Heure', 'Heure du vendredi', 'Continuer']);

    await fireEvent.press(finishButton());
    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
  });

  it('still enters the app when the system cannot be asked', async () => {
    const notifications: NotificationPermissions = {
      getStatus: () => Promise.reject(new Error('unavailable')),
      request: () => Promise.reject(new Error('unavailable')),
    };
    const { store, onFinished } = await renderOnboarding({ page: REMINDERS_PAGE, notifications });
    await fireEvent.press(finishButton());
    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
    expect(store.getState().settings.onboardingCompleted).toBe(true);
  });

  it('is written in Arabic for a person who reads Arabic', async () => {
    setDeviceConditions({ rightToLeft: true });
    await renderOnboarding({ page: REMINDERS_PAGE, language: 'ar' });
    expect(screen.getByRole('header', { name: 'تذكيراتك.' })).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: 'عندما تعطش الحديقة' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'متابعة' })).toBeOnTheScreen();
    expect(await screen.findByText('سيطلب منك هاتفك بعد ذلك السماح بالإشعارات.')).toBeOnTheScreen();
    expect(directionDependentStyles(screen.getByTestId('onboarding'))).toEqual([]);
  });
});

describe('introduction opened again from the settings', () => {
  it('is known as a replay from the moment it opens, and says so when it ends', async () => {
    const { store, onFinished } = await renderOnboarding({
      page: REMINDERS_PAGE,
      settings: { onboardingCompleted: true },
      notifications: createInertNotificationPermissions({ status: 'granted' }),
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer' }));
    await waitFor(() => expect(onFinished).toHaveBeenCalledWith({ isReplay: true }));
    expect(store.getState().settings.onboardingCompleted).toBe(true);
  });

  it('shows the person’s own goal and reminders, not the proposed ones', async () => {
    await renderOnboarding({
      page: GOAL_PAGE,
      settings: { onboardingCompleted: true, dailyGoalPages: 20 },
    });
    expect(screen.getByRole('adjustable', { name: 'Pages par jour' })).toHaveAccessibilityValue({
      text: '20',
    });
  });
});
