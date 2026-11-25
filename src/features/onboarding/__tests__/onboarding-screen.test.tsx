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
  onboardingPages,
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
const GOAL_PAGE = 11;
const REMINDERS_PAGE = 12;
/** The flow once the three features it presents exist. */
const PAGES_WITH_EVERY_FEATURE = onboardingPages(
  'full',
  new Set(['voice', 'recognition', 'friends']),
);
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

/** The pages on screen: each paints its own background. */
function pageBackgrounds() {
  return screen.getAllByTestId('onboarding-page').map((page) => styleOf(page).backgroundColor);
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
      expect(screen.getByRole('header', { name: 'Une terre nue' })).toBeOnTheScreen();
      expect(
        screen.getByText('Soixante hizb pour en faire un jardin. Glisse pour continuer.'),
      ).toBeOnTheScreen();
      expect(indicator()).toHaveProp('accessibilityLabel', 'Présentation');
      expect(indicator()).toHaveAccessibilityValue({ text: 'Page 1 sur 13' });
      expect(directionDependentStyles(screen.getByTestId('onboarding'))).toEqual([]);
    },
  );

  it('has no button to continue or to skip: a swipe is the way through', async () => {
    await renderOnboarding();
    expect(buttonNames()).toEqual([]);
    expect(screen.queryByText(/^continuer$|passer|suivant/i)).toBeNull();
  });

  const SCENES_AND_TITLES: readonly (readonly [number, string | null, string])[] = [
    [0, `Jardin${NO_BREAK_SPACE}: terre nue`, 'Une terre nue'],
    [1, 'Jardin au hizb 8', 'Lis, et l’eau coule'],
    [2, 'Jardin au hizb 20', 'Un hizb, un nouvel élément'],
    [3, 'Jardin au hizb 30', 'À mi-chemin, les murs s’élèvent'],
    [4, 'Jardin au hizb 40', 'Les portes s’ouvrent'],
    [5, 'Jardin après 3 jours sans lecture', 'Si tu arrêtes de lire, il a soif'],
    [6, 'Jardin après 6 jours sans lecture', 'Puis il fane'],
    [7, 'Jardin après 10 jours sans lecture', 'Les arbres se dénudent'],
    [8, 'Jardin après 14 jours sans lecture', 'Et il redevient une terre morte'],
    [9, 'Jardin qui revit après une page', 'Une page suffit pour le faire revivre'],
    [10, 'Jardin au hizb 60', 'Au soixantième hizb, ton jardin est complet'],
    [GOAL_PAGE, null, 'Ton objectif du jour'],
    [REMINDERS_PAGE, null, 'Tes rappels'],
  ];

  it.each(SCENES_AND_TITLES)(
    'shows page %i with its scene (%s) and its title (%s)',
    async (page, sceneName, title) => {
      await renderOnboarding({ page });
      expect(screen.getByRole('header', { name: title })).toBeOnTheScreen();
      expect(indicator()).toHaveAccessibilityValue({ text: `Page ${page + 1} sur 13` });
      if (sceneName === null) {
        expect(screen.queryByRole('image')).toBeNull();
      } else {
        expect(screen.getByRole('image', { name: sceneName })).toBeOnTheScreen();
      }
    },
  );

  it('gives the scene the top of the page, edge to edge, and the same height on every page', async () => {
    await renderOnboarding();
    const page = screen.getAllByTestId('onboarding-page')[0];
    if (page === undefined) throw new Error('No page.');
    const scene = page.queryAll((element) => element.props.accessibilityRole === 'image')[0];
    const sceneFrame = scene?.parent;
    if (sceneFrame === undefined) throw new Error('The page has no scene.');
    if (sceneFrame === null) throw new Error('The scene has no frame.');
    // Before the page is measured the scene takes what the words leave.
    expect(styleOf(sceneFrame).flexGrow).toBe(1);
    await fireEvent(page, 'layout', { nativeEvent: { layout: { ...WINDOW, height: 800 } } });
    expect(styleOf(sceneFrame).height).toBe(480);
    // No side margin on the scene: only the words have one.
    expect(styleOf(page).paddingHorizontal).toBeUndefined();
  });

  it('has a title and a sentence on every page of the full flow', () => {
    expect(SCENES_AND_TITLES).toHaveLength(ONBOARDING_PAGES_FULL.length);
  });

  it('tells the complete garden last, as the one that no longer dries', async () => {
    await renderOnboarding({ page: 10 });
    expect(
      screen.getByText('Tu as lu le Coran en entier, et ce jardin-là ne sèche plus.'),
    ).toBeOnTheScreen();
  });

  it('writes the sentence of a page in the primary text colour, like its title', async () => {
    await renderOnboarding();
    const sentence = screen.getByText(
      'Soixante hizb pour en faire un jardin. Glisse pour continuer.',
    );
    const title = screen.getByRole('header', { name: 'Une terre nue' });
    expect(styleOf(sentence).color).toEqual(PlatformColor('label'));
    expect(styleOf(sentence).color).toEqual(styleOf(title).color);
  });

  it.each([
    [11, 'Lecture à voix haute, suivie mot à mot', 'Lis à voix haute, l’appli te suit'],
    [12, 'Passage reconnu à l’écoute', `D’où vient ce passage${NO_BREAK_SPACE}?`],
    [13, 'Jardins de tes proches', 'Avec tes proches'],
  ])('has page %i ready for the day its feature ships: %s', async (page, sceneName, title) => {
    await renderOnboarding({ page, pages: PAGES_WITH_EVERY_FEATURE });
    expect(indicator()).toHaveAccessibilityValue({ text: `Page ${page + 1} sur 16` });
    expect(screen.getByRole('image', { name: sceneName })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: title })).toBeOnTheScreen();
  });

  it('moves one page at a time from the page indicator, forwards and back', async () => {
    await renderOnboarding();
    await fireEvent.press(screen.getByTestId('onboarding-pager-indicator-next'));
    expect(indicator()).toHaveAccessibilityValue({ text: 'Page 2 sur 13' });
    expect(screen.getByRole('header', { name: 'Lis, et l’eau coule' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('onboarding-pager-indicator-previous'));
    expect(indicator()).toHaveAccessibilityValue({ text: 'Page 1 sur 13' });
  });

  it('lets a screen reader turn the pages without a swipe', async () => {
    await renderOnboarding();
    await fireEvent(indicator(), 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    await fireEvent(indicator(), 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    expect(indicator()).toHaveAccessibilityValue({ text: 'Page 3 sur 13' });
    await fireEvent(indicator(), 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    });
    expect(indicator()).toHaveAccessibilityValue({ text: 'Page 2 sur 13' });
  });

  it('shows the short flow when given its pages, with no other change', async () => {
    await renderOnboarding({ pages: ONBOARDING_PAGES_SHORT, page: 7 });
    expect(indicator()).toHaveAccessibilityValue({ text: 'Page 8 sur 8' });
    expect(screen.getByRole('header', { name: 'Tes rappels' })).toBeOnTheScreen();
    expect(await screen.findByRole('button', { name: 'Continuer' })).toBeOnTheScreen();
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
    expect(screen.getByRole('header', { name: 'اقرأ، فيجري الماء' })).toBeOnTheScreen();
    expect(indicator()).toHaveProp('accessibilityLabel', 'التعريف');
    expect(indicator()).toHaveAccessibilityValue({ text: 'الصفحة 2 من 13' });
    expect(directionDependentStyles(screen.getByTestId('onboarding'))).toEqual([]);
  });

  it.each([0, 10, GOAL_PAGE, REMINDERS_PAGE])(
    'cuts no text on page %i at the largest text size',
    async (page) => {
      setDeviceConditions({ fontScale: LARGEST_FONT_SCALE });
      await renderOnboarding({ page });
      expect(fixedHeightsAroundText(screen.getByTestId('onboarding'))).toEqual([]);
    },
  );

  it('paints each page with its own background, so nothing changes colour while pages slide', async () => {
    await renderOnboarding({ page: 10 });
    // The complete garden, then the two pages that show a grouped list (color.md › Mobile).
    expect(pageBackgrounds()).toEqual([
      PlatformColor('systemBackground'),
      PlatformColor('systemGroupedBackground'),
      PlatformColor('systemGroupedBackground'),
    ]);
    const screenBackground = styleOf(screen.getByTestId('onboarding')).backgroundColor;
    expect(screenBackground).toEqual(PlatformColor('systemBackground'));

    await fireEvent.press(screen.getByTestId('onboarding-pager-indicator-next'));
    expect(indicator()).toHaveAccessibilityValue({ text: 'Page 12 sur 13' });
    expect(styleOf(screen.getByTestId('onboarding')).backgroundColor).toEqual(screenBackground);
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
    expect(indicator()).toHaveAccessibilityValue({ text: 'Page 13 sur 13' });
    expect(store.getState().settings.dailyGoalPages).toBe(5);
  });
});

describe('reminders page', () => {
  const WILL_ASK = 'Ton téléphone te demandera ensuite d’autoriser les notifications.';
  const DENIED =
    'Les notifications de l’appli sont désactivées. Pour recevoir tes rappels, autorise-les dans les réglages du téléphone.';
  const NONE = 'Sans rappel, l’appli ne t’envoie aucune notification.';
  const FRIDAY = `Le vendredi${NO_BREAK_SPACE}: sourate Al-Kahf`;
  const ALL_OFF = { ...DEFAULT_REMINDERS, dailyEnabled: false, thirstyGardenEnabled: false };

  function finishButton(name = 'Continuer') {
    return screen.getByRole('button', { name });
  }

  it('shows the three reminders, the time of the reading ones, and a single button', async () => {
    await renderOnboarding({ page: REMINDERS_PAGE });
    expect(screen.getByText('Pour que ton jardin ne manque jamais d’eau.')).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: 'Rappel du jour' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Quand le jardin a soif' })).toBeChecked();
    // The Friday reminder names a surah on the lock screen: it is the person's own choice.
    expect(screen.getByRole('switch', { name: FRIDAY })).not.toBeChecked();
    // The time row opens the system's picker; the only button that leaves the page is the last.
    await screen.findByText(WILL_ASK);
    expect(buttonNames()).toEqual(['Heure des rappels', 'Continuer']);
    expect(touchTargetHeight(finishButton())).toBeGreaterThanOrEqual(44);
  });

  it('saves each switch, and shows a time only while a reminder uses it', async () => {
    const { store } = await renderOnboarding({ page: REMINDERS_PAGE });
    await fireEvent.press(screen.getByRole('switch', { name: 'Rappel du jour' }));
    expect(store.getState().settings.reminders.dailyEnabled).toBe(false);
    // The garden's reminders come at the same time: it stays until they are off too.
    expect(screen.getByRole('button', { name: 'Heure des rappels' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('switch', { name: 'Quand le jardin a soif' }));
    expect(store.getState().settings.reminders.thirstyGardenEnabled).toBe(false);
    expect(screen.queryByRole('button', { name: 'Heure des rappels' })).toBeNull();

    await fireEvent.press(screen.getByRole('switch', { name: FRIDAY }));
    expect(store.getState().settings.reminders.fridayKahfEnabled).toBe(true);
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

  it('says that the phone is about to ask right above the button that leads to the question', async () => {
    await renderOnboarding({ page: REMINDERS_PAGE });
    const notice = await screen.findByTestId('onboarding-permission-notice');
    expect(notice).toHaveTextContent(WILL_ASK);
    // Next to the button, outside the list, so it cannot scroll away from it.
    const footer = notice.parent;
    expect(footer?.children.indexOf(notice)).toBe(0);
    expect(footer?.queryAll(({ props }) => props.testID === 'onboarding-finish')).toHaveLength(1);
    expect(
      screen
        .getByTestId('onboarding-reminders')
        .queryAll(({ props }) => props.testID === 'onboarding-permission-notice'),
    ).toEqual([]);
    expect(styleOf(notice).color).toEqual(PlatformColor('label'));
    // The button does not borrow the word of the system's alert.
    expect(screen.queryByText(/autoriser$|^autoriser|allow/i)).toBeNull();
  });

  it.each(['granted', 'denied'] as const)(
    'asks the system once "Continuer" is pressed and enters the app whatever the answer: %s',
    async (answer) => {
      const notifications = createInertNotificationPermissions({ status: 'undetermined', answer });
      const { store, onFinished, request } = await renderOnboarding({
        page: REMINDERS_PAGE,
        notifications,
      });
      expect(store.getState().settings.onboardingCompleted).toBe(false);

      await fireEvent.press(await screen.findByRole('button', { name: 'Continuer' }));
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
    await fireEvent.press(await screen.findByRole('button', { name: 'Continuer' }));
    await fireEvent.press(finishButton());
    expect(onFinished).not.toHaveBeenCalled();
    expect(store.getState().settings.onboardingCompleted).toBe(false);
    expect(finishButton()).toBeDisabled();

    answer('granted');
    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
  });

  it('is named "Commencer", and asks nothing, when every reminder is off', async () => {
    const { store, onFinished, request } = await renderOnboarding({
      page: REMINDERS_PAGE,
      settings: { reminders: ALL_OFF },
    });
    expect(await screen.findByText(NONE)).toBeOnTheScreen();
    expect(screen.queryByTestId('onboarding-permission-notice')).toBeNull();
    expect(buttonNames()).toEqual(['Commencer']);

    await fireEvent.press(finishButton('Commencer'));
    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
    expect(request).not.toHaveBeenCalled();
    expect(store.getState().settings.onboardingCompleted).toBe(true);
  });

  it('follows the switches: the button and its notice change as the last reminder goes off and on', async () => {
    await renderOnboarding({
      page: REMINDERS_PAGE,
      settings: { reminders: { ...ALL_OFF, dailyEnabled: true } },
    });
    expect(await screen.findByText(WILL_ASK)).toBeOnTheScreen();
    expect(finishButton('Continuer')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('switch', { name: 'Rappel du jour' }));
    expect(screen.getByText(NONE)).toBeOnTheScreen();
    expect(screen.queryByText(WILL_ASK)).toBeNull();
    expect(finishButton('Commencer')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('switch', { name: FRIDAY }));
    expect(screen.getByText(WILL_ASK)).toBeOnTheScreen();
    expect(finishButton('Continuer')).toBeOnTheScreen();
  });

  it('is named "Commencer", with no notice, when the person has already allowed the notifications', async () => {
    const { onFinished, request } = await renderOnboarding({
      page: REMINDERS_PAGE,
      notifications: createInertNotificationPermissions({ status: 'granted' }),
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Commencer' }));
    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
    expect(request).not.toHaveBeenCalled();
    expect(screen.queryByText(WILL_ASK)).toBeNull();
    expect(screen.queryByText(DENIED)).toBeNull();
  });

  it('says when the system already blocks the notifications, and offers no other way out', async () => {
    const { onFinished, request } = await renderOnboarding({
      page: REMINDERS_PAGE,
      notifications: createInertNotificationPermissions({ status: 'denied' }),
    });
    expect(await screen.findByText(DENIED)).toBeOnTheScreen();
    expect(screen.queryByTestId('open-system-settings')).toBeNull();
    // No alert can follow: the button starts the app and says so.
    expect(buttonNames()).toEqual(['Heure des rappels', 'Commencer']);

    await fireEvent.press(finishButton('Commencer'));
    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
    expect(request).not.toHaveBeenCalled();
  });

  it('still enters the app, without promising an alert, when the system cannot be asked', async () => {
    const notifications: NotificationPermissions = {
      getStatus: () => Promise.reject(new Error('unavailable')),
      request: () => Promise.reject(new Error('unavailable')),
    };
    const { store, onFinished } = await renderOnboarding({ page: REMINDERS_PAGE, notifications });
    await fireEvent.press(finishButton('Commencer'));
    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
    expect(store.getState().settings.onboardingCompleted).toBe(true);
  });

  it('still enters the app when the system fails while it is asked', async () => {
    const notifications: NotificationPermissions = {
      getStatus: async () => 'undetermined',
      request: () => Promise.reject(new Error('unavailable')),
    };
    const { onFinished } = await renderOnboarding({ page: REMINDERS_PAGE, notifications });
    await fireEvent.press(await screen.findByRole('button', { name: 'Continuer' }));
    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
  });

  it('is written in Arabic for a person who reads Arabic', async () => {
    setDeviceConditions({ rightToLeft: true });
    await renderOnboarding({ page: REMINDERS_PAGE, language: 'ar' });
    expect(screen.getByRole('header', { name: 'تذكيراتك' })).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: 'التذكير اليومي' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'عندما تعطش الحديقة' })).toBeChecked();
    expect(await screen.findByText('سيطلب منك هاتفك بعد ذلك السماح بالإشعارات.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'التالي' })).toBeOnTheScreen();
    expect(directionDependentStyles(screen.getByTestId('onboarding'))).toEqual([]);
  });
});

describe('introduction opened again from the settings', () => {
  const REPLAY = { onboardingCompleted: true };

  it('ends with "Terminé", and says so to whoever opened it', async () => {
    const { store, onFinished, request } = await renderOnboarding({
      page: REMINDERS_PAGE,
      settings: REPLAY,
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Terminé' })).toBeOnTheScreen());
    await fireEvent.press(screen.getByRole('button', { name: 'Terminé' }));
    await waitFor(() => expect(onFinished).toHaveBeenCalledWith({ isReplay: true }));
    expect(request).not.toHaveBeenCalled();
    expect(store.getState().settings.onboardingCompleted).toBe(true);
  });

  it('never announces the system alert, even while the person has not been asked', async () => {
    await renderOnboarding({ page: REMINDERS_PAGE, settings: REPLAY });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Terminé' })).toBeOnTheScreen());
    expect(screen.queryByTestId('onboarding-permission-notice')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Continuer' })).toBeNull();
  });

  it('asks for the permission when a reminder is switched on, as the settings do', async () => {
    const { request } = await renderOnboarding({
      page: REMINDERS_PAGE,
      settings: {
        ...REPLAY,
        reminders: { ...DEFAULT_REMINDERS, dailyEnabled: false, thirstyGardenEnabled: false },
      },
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Terminé' })).toBeOnTheScreen());
    await fireEvent.press(screen.getByRole('switch', { name: 'Rappel du jour' }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  });

  it('shows the person’s own goal and reminders, not the proposed ones', async () => {
    await renderOnboarding({ page: GOAL_PAGE, settings: { ...REPLAY, dailyGoalPages: 20 } });
    expect(screen.getByRole('adjustable', { name: 'Pages par jour' })).toHaveAccessibilityValue({
      text: '20',
    });
  });
});
