import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

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
  iosPaletteColor,
  resetDeviceConditions,
  setDeviceConditions,
  styleOf,
  touchTargetHeight,
  withDescendants,
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
const PAGE_COUNT = 16;
const FINISH = 'Créer mon jardin';
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
  // The pager draws its pages once it knows its width.
  await fireEvent(screen.getByTestId('onboarding-pager-pages'), 'layout', {
    nativeEvent: { layout: WINDOW },
  });
  return { store, onFinished, request };
}

/** The page dots; on the last page they are faded out for the button and hidden from readers. */
function indicator() {
  return screen.getByTestId('onboarding-pager-indicator', { includeHiddenElements: true });
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

const WILL_ASK = 'Ton téléphone te demandera ensuite d’autoriser les notifications.';

describe('first-launch flow', () => {
  it.each(APPEARANCES_AND_DIRECTIONS)(
    'opens on the bare earth: a named scene, a title, one sentence, the hint to swipe and the page dots ($scheme, right to left: $rightToLeft)',
    async (conditions) => {
      setDeviceConditions(conditions);
      await renderOnboarding();

      expect(
        screen.getByRole('image', { name: `Jardin${NO_BREAK_SPACE}: terre nue` }),
      ).toBeOnTheScreen();
      expect(screen.getByRole('header', { name: 'Une terre nue.' })).toBeOnTheScreen();
      expect(
        screen.getByText(`Soixante hizb pour en faire un${NO_BREAK_SPACE}jardin.`),
      ).toBeOnTheScreen();
      expect(screen.getByText('Glisse')).toBeOnTheScreen();
      expect(indicator()).toHaveProp('accessibilityLabel', 'Présentation');
      expect(indicator()).toHaveAccessibilityValue({ text: `Page 1 sur ${PAGE_COUNT}` });
      expect(directionDependentStyles(screen.getByTestId('onboarding'))).toEqual([]);
    },
  );

  it('names the app at the top, as the welcome mockup does', async () => {
    await renderOnboarding();
    expect(screen.getByText('Jannatuk')).toBeOnTheScreen();
  });

  it('has no button to continue or to skip: a swipe is the way through', async () => {
    await renderOnboarding();
    expect(buttonNames()).toEqual([]);
    expect(screen.queryByText(/^continuer$|passer|suivant/i)).toBeNull();
  });

  const SCENES_AND_TITLES: readonly (readonly [number, string | RegExp | null, string])[] = [
    [0, `Jardin${NO_BREAK_SPACE}: terre nue`, 'Une terre nue.'],
    [1, 'Jardin au hizb 8', 'Lis, et l’eau coule.'],
    [2, 'Jardin au hizb 20', 'Un hizb, un nouvel élément.'],
    [3, 'Jardin au hizb 30', 'À mi-chemin, les murs s’élèvent.'],
    [4, 'Jardin au hizb 40', 'Les portes s’ouvrent.'],
    [5, 'Jardin au hizb 60', 'Ton jardin est complet.'],
    [6, 'Jardin après 3 jours sans lecture', 'Si tu t’arrêtes en chemin, il a soif.'],
    [7, 'Jardin après 6 jours sans lecture', 'Puis il fane.'],
    [8, 'Jardin après 10 jours sans lecture', 'Les arbres se dénudent.'],
    [9, 'Jardin après 14 jours sans lecture', 'Et il redevient une terre morte.'],
    [10, 'Jardin qui revit après une page', 'Une page suffit pour le faire revivre.'],
    [
      11,
      /^Passage reconnu à l’écoute, Al-Kahf, verset 10$/,
      `D’où vient ce passage${NO_BREAK_SPACE}?`,
    ],
    [
      12,
      'Lecture à voix haute : les mots récités s’allument, un mot à relire est marqué en rouge',
      'Récite, il te suit.',
    ],
    [
      13,
      /^Jardins de tes proches ; Mustapha, 38 hizb ; Sarah, 52 hizb ; Taghread, 14 hizb$/,
      'Avec tes proches.',
    ],
    [GOAL_PAGE, `Jardin${NO_BREAK_SPACE}: terre nue`, 'Ton objectif du jour.'],
    [REMINDERS_PAGE, null, 'Tes rappels.'],
  ];

  it.each(SCENES_AND_TITLES)(
    'shows page %i with its scene (%s) and its title (%s), and nothing of the other pages to a screen reader',
    async (page, sceneName, title) => {
      await renderOnboarding({ page });
      expect(screen.getByRole('header', { name: title })).toBeOnTheScreen();
      expect(screen.getAllByRole('header')).toHaveLength(1);
      expect(indicator()).toHaveAccessibilityValue({ text: `Page ${page + 1} sur ${PAGE_COUNT}` });
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

  it('shows the hint to swipe on the first page only', async () => {
    await renderOnboarding({ page: 1 });
    expect(screen.queryByTestId('onboarding-hint')).toBeNull();
  });

  it('captions each garden with what it shows, a caption screen readers skip', async () => {
    await renderOnboarding({ page: 6 });
    const captions = screen
      .getAllByTestId('onboarding-caption', { includeHiddenElements: true })
      .map((caption) => caption.queryAll(({ type }) => type === 'Text')[0]?.props.children);
    expect(captions).toEqual([
      'Hizb 8',
      'Hizb 20',
      'Hizb 30',
      'Hizb 40',
      'Hizb 60',
      '3 jours sans lecture',
      '6 jours sans lecture',
      '10 jours sans lecture',
      '14 jours sans lecture',
      'Tu reprends ta lecture',
    ]);
    expect(screen.queryByText('3 jours sans lecture')).toBeNull();
  });

  it('says the complete garden no longer dries, before the drought takes a garden on its way', async () => {
    await renderOnboarding({ page: 5 });
    expect(
      screen.getByText(
        `Soixante hizb${NO_BREAK_SPACE}: tu as lu le Coran en entier. Ce jardin-là ne sèche${NO_BREAK_SPACE}plus.`,
      ),
    ).toBeOnTheScreen();
  });

  it.each([
    [0, 'heading', 'muted'],
    [8, 'heading', 'earthSecondary'],
    [11, 'onAction', 'onActionSecondary'],
  ] as const)(
    'writes page %i in the colours of its sky: a %s title over a %s sentence',
    async (page, titleColor, textColor) => {
      await renderOnboarding({ page, onIOS: true });
      const title = screen.getByRole('header');
      const sentence = screen
        .getByTestId('onboarding-page')
        .queryAll(({ type }) => type === 'Text')[1];
      if (sentence === undefined) throw new Error('No sentence.');
      expect(styleOf(title).color).toEqual(iosPaletteColor(titleColor));
      expect(styleOf(sentence).color).toEqual(iosPaletteColor(textColor));
    },
  );

  it('lays the sky of each page behind all of them: warm, then grey, deep green, paler', async () => {
    await renderOnboarding();
    for (const layer of ['complete', 'thirsty', 'dead', 'listening', 'together']) {
      expect(
        screen.getByTestId(`onboarding-backdrop-${layer}`, { includeHiddenElements: true }),
      ).toBeOnTheScreen();
    }
    // The screen paints nothing of its own: the sky shows behind every page as they slide.
    expect(styleOf(screen.getByTestId('onboarding')).backgroundColor).toBeUndefined();
  });

  it.each([
    [11, /^Passage reconnu à l’écoute/, `D’où vient ce passage${NO_BREAK_SPACE}?`],
    [12, /^Lecture à voix haute/, 'Récite, il te suit.'],
    [13, /^Jardins de tes proches/, 'Avec tes proches.'],
  ])(
    'presents the feature of page %i, after the one before it: %s',
    async (page, sceneName, title) => {
      await renderOnboarding({ page });
      expect(indicator()).toHaveAccessibilityValue({ text: `Page ${page + 1} sur 16` });
      expect(screen.getByRole('image', { name: sceneName })).toBeOnTheScreen();
      expect(screen.getByRole('header', { name: title })).toBeOnTheScreen();
    },
  );

  it('shows the passage found as the data layer gives it, once its page is shown', async () => {
    await renderOnboarding({ page: 11 });
    const verse = await screen.findByText(/^إِذۡ أَوَى/, { includeHiddenElements: true });
    expect(verse).toBeOnTheScreen();
    expect(screen.getByText('Page 294', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('moves one page at a time from the page dots, forwards and back', async () => {
    await renderOnboarding();
    await fireEvent.press(screen.getByTestId('onboarding-pager-indicator-next'));
    expect(indicator()).toHaveAccessibilityValue({ text: `Page 2 sur ${PAGE_COUNT}` });
    expect(screen.getByRole('header', { name: 'Lis, et l’eau coule.' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('onboarding-pager-indicator-previous'));
    expect(indicator()).toHaveAccessibilityValue({ text: `Page 1 sur ${PAGE_COUNT}` });
  });

  it('lets a screen reader turn the pages without a swipe', async () => {
    await renderOnboarding();
    await fireEvent(indicator(), 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    await fireEvent(indicator(), 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    expect(indicator()).toHaveAccessibilityValue({ text: `Page 3 sur ${PAGE_COUNT}` });
    await fireEvent(indicator(), 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    });
    expect(indicator()).toHaveAccessibilityValue({ text: `Page 2 sur ${PAGE_COUNT}` });
  });

  it('keeps the page dots and the last button at least 44 points tall', async () => {
    await renderOnboarding({ page: REMINDERS_PAGE });
    expect(touchTargetHeight(indicator())).toBeGreaterThanOrEqual(44);
    expect(touchTargetHeight(screen.getByTestId('onboarding-finish'))).toBeGreaterThanOrEqual(44);
  });

  it('trades the page dots for the last button on the last page only', async () => {
    await renderOnboarding({ page: GOAL_PAGE });
    expect(screen.queryByRole('button', { name: FINISH })).toBeNull();
    expect(indicator()).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('onboarding-pager-indicator-next'));
    expect(await screen.findByRole('button', { name: FINISH })).toBeOnTheScreen();
    expect(screen.queryByRole('adjustable', { name: 'Présentation' })).toBeNull();
  });

  it('shows the short flow when given its pages, with no other change', async () => {
    await renderOnboarding({ pages: ONBOARDING_PAGES_SHORT, page: 9 });
    expect(indicator).toBeDefined();
    expect(screen.getByRole('header', { name: 'Tes rappels.' })).toBeOnTheScreen();
    expect(await screen.findByRole('button', { name: FINISH })).toBeOnTheScreen();
  });

  it('draws its gardens with the function it is given, the friends’ gardens too', async () => {
    const scenes: OnboardingScene[] = [];
    const renderScene: SceneRenderer = (scene) => {
      scenes.push(scene);
      return <Text>{`Scène ${scene.kind}`}</Text>;
    };
    await renderOnboarding({ page: 13, renderScene });
    expect(scenes).toContainEqual({ kind: 'garden', hizbCompleted: 38 });
    expect(scenes).toContainEqual({ kind: 'drought', hizbCompleted: 14, daysWithoutReading: 3 });
    expect(
      screen.getAllByText('Scène garden', { includeHiddenElements: true }).length,
    ).toBeGreaterThan(0);
  });

  it('draws only the pictures a swipe can bring: the page shown and its neighbours', async () => {
    const scenes: OnboardingScene[] = [];
    const renderScene: SceneRenderer = (scene) => {
      scenes.push(scene);
      return <Text>{`Scène ${scene.kind}`}</Text>;
    };
    await renderOnboarding({ page: 0, renderScene });
    expect(new Set(scenes.map((scene) => JSON.stringify(scene)))).toEqual(
      new Set([
        JSON.stringify({ kind: 'garden', hizbCompleted: 0 }),
        JSON.stringify({ kind: 'garden', hizbCompleted: 8 }),
      ]),
    );
  });

  it('names the surah of the passage found in Arabic for a person who reads Arabic', async () => {
    setDeviceConditions({ rightToLeft: true });
    await renderOnboarding({ language: 'ar', page: 11 });
    const scene = screen.getByTestId('onboarding-recognition-scene');
    expect(String(scene.props.accessibilityLabel)).toContain('الكهف، الآية 10');
  });

  it('is written in Arabic, mirrored, for a person who reads Arabic', async () => {
    setDeviceConditions({ rightToLeft: true });
    await renderOnboarding({ language: 'ar', page: 1 });
    expect(screen.getByRole('image', { name: 'الحديقة عند الحزب 8' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'اقرأ، فيجري الماء.' })).toBeOnTheScreen();
    expect(screen.getByText('جنتك')).toBeOnTheScreen();
    expect(indicator()).toHaveProp('accessibilityLabel', 'التعريف');
    expect(indicator()).toHaveAccessibilityValue({ text: `الصفحة 2 من ${PAGE_COUNT}` });
    expect(directionDependentStyles(screen.getByTestId('onboarding'))).toEqual([]);
  });

  it.each([0, 5, 11, 12, GOAL_PAGE, REMINDERS_PAGE])(
    'cuts no word of page %i at the largest text size',
    async (page) => {
      setDeviceConditions({ fontScale: LARGEST_FONT_SCALE });
      await renderOnboarding({ page });
      expect(fixedHeightsAroundText(screen.getByTestId('onboarding-pager-pages'))).toEqual([]);
      expect(fixedHeightsAroundText(indicator())).toEqual([]);
    },
  );

  it('previews the notifications of the reminders that are on, on a tall enough screen', async () => {
    // An iPhone 15's window: tall enough for the previews (shorter screens leave them out).
    setDeviceConditions();
    await renderOnboarding({ page: REMINDERS_PAGE });
    // The three reminders are proposed on: the reading one, the garden's and the Friday one.
    expect(
      screen.getAllByTestId('onboarding-notification', { includeHiddenElements: true }),
    ).toHaveLength(3);
  });

  it('leaves out the previewed notifications at the largest text size, for the settings', async () => {
    setDeviceConditions({ fontScale: LARGEST_FONT_SCALE });
    await renderOnboarding({ page: REMINDERS_PAGE });
    expect(
      screen.queryByTestId('onboarding-notifications', { includeHiddenElements: true }),
    ).toBeNull();
  });

  it.each([0, 11, 12, 13, GOAL_PAGE, REMINDERS_PAGE])(
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
    expect(indicator).toBeDefined();
    expect(screen.getByRole('header', { name: 'Tes rappels.' })).toBeOnTheScreen();
    expect(store.getState().settings.dailyGoalPages).toBe(5);
  });
});

describe('reminders page', () => {
  const DENIED =
    'Les notifications de l’appli sont désactivées. Pour recevoir tes rappels, autorise-les dans les réglages du téléphone.';
  const NONE = 'Sans rappel, l’appli ne t’envoie aucune notification.';
  const FRIDAY = `Le vendredi${NO_BREAK_SPACE}: sourate Al-Kahf`;
  const ALL_OFF = {
    ...DEFAULT_REMINDERS,
    dailyEnabled: false,
    thirstyGardenEnabled: false,
    fridayKahfEnabled: false,
  };

  function finishButton(name = FINISH) {
    return screen.getByRole('button', { name });
  }

  it('shows the three reminders, the time of the reading ones, and a single button', async () => {
    await renderOnboarding({ page: REMINDERS_PAGE });
    expect(screen.getByText('Pour que ton jardin ne manque jamais d’eau.')).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: 'Rappel du jour' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Quand le jardin a soif' })).toBeChecked();
    // The Friday reminder is proposed on, like the two others (owner's decision, 25 November).
    expect(screen.getByRole('switch', { name: FRIDAY })).toBeChecked();
    // The time row opens the system's picker; the only button that leaves the page is the last.
    await screen.findByText(WILL_ASK);
    expect(buttonNames()).toEqual(['Heure des rappels', 'Heure du vendredi', FINISH]);
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

    // The Friday reminder starts on, with its own time; switched off, its time goes.
    expect(screen.getByRole('button', { name: 'Heure du vendredi' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('switch', { name: FRIDAY }));
    expect(store.getState().settings.reminders.fridayKahfEnabled).toBe(false);
    expect(screen.queryByRole('button', { name: 'Heure du vendredi' })).toBeNull();
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

  it('says that the phone is about to ask, between the reminders and the one button', async () => {
    await renderOnboarding({ page: REMINDERS_PAGE });
    const notice = await screen.findByText(WILL_ASK);
    const order = withDescendants(screen.getByTestId('onboarding'));
    const finish = screen.getByTestId('onboarding-finish');
    // In reading order: the reminders, the sentence that announces the alert, then the button.
    expect(order.indexOf(notice)).toBeGreaterThan(
      order.indexOf(screen.getByRole('switch', { name: 'Rappel du jour' })),
    );
    expect(order.indexOf(finish)).toBeGreaterThan(order.indexOf(notice));
    // The button does not borrow the word of the system's alert.
    expect(screen.queryByText(/autoriser$|^autoriser|allow/i)).toBeNull();
  });

  it.each(['granted', 'denied'] as const)(
    'asks the system once "Créer mon jardin" is pressed and enters the app whatever the answer: %s',
    async (answer) => {
      const notifications = createInertNotificationPermissions({ status: 'undetermined', answer });
      const { store, onFinished, request } = await renderOnboarding({
        page: REMINDERS_PAGE,
        notifications,
      });
      expect(store.getState().settings.onboardingCompleted).toBe(false);

      await fireEvent.press(await screen.findByRole('button', { name: FINISH }));
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
    await fireEvent.press(await screen.findByRole('button', { name: FINISH }));
    await fireEvent.press(finishButton());
    expect(onFinished).not.toHaveBeenCalled();
    expect(store.getState().settings.onboardingCompleted).toBe(false);
    expect(finishButton()).toBeDisabled();

    answer('granted');
    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
  });

  it('asks nothing, and announces nothing, when every reminder is off', async () => {
    const { store, onFinished, request } = await renderOnboarding({
      page: REMINDERS_PAGE,
      settings: { reminders: ALL_OFF },
    });
    expect(await screen.findByText(NONE)).toBeOnTheScreen();
    expect(screen.queryByText(WILL_ASK)).toBeNull();
    expect(buttonNames()).toEqual([FINISH]);

    await fireEvent.press(finishButton());
    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
    expect(request).not.toHaveBeenCalled();
    expect(store.getState().settings.onboardingCompleted).toBe(true);
  });

  it('follows the switches: the notice comes and goes with the last reminder, and so do the notifications shown', async () => {
    setDeviceConditions();
    await renderOnboarding({
      page: REMINDERS_PAGE,
      settings: { reminders: { ...ALL_OFF, dailyEnabled: true } },
    });
    const previews = () =>
      screen.queryAllByTestId('onboarding-notification', { includeHiddenElements: true }).length;
    expect(await screen.findByText(WILL_ASK)).toBeOnTheScreen();
    expect(previews()).toBe(1);

    await fireEvent.press(screen.getByRole('switch', { name: 'Rappel du jour' }));
    expect(screen.getByText(NONE)).toBeOnTheScreen();
    expect(screen.queryByText(WILL_ASK)).toBeNull();
    expect(finishButton()).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('switch', { name: FRIDAY }));
    expect(screen.getByText(WILL_ASK)).toBeOnTheScreen();
    expect(
      screen.getByText('Un moment pour la sourate Al-Kahf ?', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });

  it('announces nothing when the person has already allowed the notifications', async () => {
    const { onFinished, request } = await renderOnboarding({
      page: REMINDERS_PAGE,
      notifications: createInertNotificationPermissions({ status: 'granted' }),
    });
    await fireEvent.press(await screen.findByRole('button', { name: FINISH }));
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
    expect(buttonNames()).toEqual(['Heure des rappels', 'Heure du vendredi', FINISH]);

    await fireEvent.press(finishButton());
    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
    expect(request).not.toHaveBeenCalled();
  });

  it('still enters the app, without promising an alert, when the system cannot be asked', async () => {
    const notifications: NotificationPermissions = {
      getStatus: () => Promise.reject(new Error('unavailable')),
      request: () => Promise.reject(new Error('unavailable')),
    };
    const { store, onFinished } = await renderOnboarding({ page: REMINDERS_PAGE, notifications });
    await fireEvent.press(finishButton());
    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
    expect(store.getState().settings.onboardingCompleted).toBe(true);
  });

  it('still enters the app when the system fails while it is asked', async () => {
    const notifications: NotificationPermissions = {
      getStatus: async () => 'undetermined',
      request: () => Promise.reject(new Error('unavailable')),
    };
    const { onFinished } = await renderOnboarding({ page: REMINDERS_PAGE, notifications });
    await fireEvent.press(await screen.findByRole('button', { name: FINISH }));
    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
  });

  it('is written in Arabic for a person who reads Arabic', async () => {
    setDeviceConditions({ rightToLeft: true });
    await renderOnboarding({ page: REMINDERS_PAGE, language: 'ar' });
    expect(screen.getByRole('header', { name: 'تذكيراتك.' })).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: 'التذكير اليومي' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'عندما تعطش الحديقة' })).toBeChecked();
    expect(await screen.findByText('سيطلب منك هاتفك بعد ذلك السماح بالإشعارات.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'أنشئ حديقتي' })).toBeOnTheScreen();
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
    expect(screen.queryByText(WILL_ASK)).toBeNull();
    expect(screen.queryByRole('button', { name: FINISH })).toBeNull();
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
