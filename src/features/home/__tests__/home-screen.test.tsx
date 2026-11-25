import { fireEvent, render, renderHook, screen } from '@testing-library/react-native';

import { quranStructure } from '@/data/quran';
import { parseLocalDate } from '@/domain/shared/local-date';
import { gardenSceneLabel } from '@/features/garden/garden-words';
import {
  reactNativeViewsInsideSwiftUI,
  SCREEN_CONDITIONS,
  showLanguage,
} from '@/features/garden/test-support/screen-conditions';
import { layout, useColors } from '@/ui';
import {
  directionDependentStyles,
  fixedHeightsAroundText,
  LARGEST_FONT_SCALE,
  renderOnIOS,
  resetDeviceConditions,
  setDeviceConditions,
  styleOf,
  touchTargetHeight,
} from '@/ui/test-support/environment';

import arHome from '../../../i18n/locales/ar/home.json';
import enHome from '../../../i18n/locales/en/home.json';
import frHome from '../../../i18n/locales/fr/home.json';
import { newArrival } from '../arrival';
import { formatHeaderDate } from '../format-date';
import {
  buildReadingHistory,
  READING_HISTORY_CONFIG,
  type ReadingHistoryName,
} from '../dev-preview/reading-histories';
import {
  buildHomeModel,
  type HomeActions,
  type HomeModel,
  type HomeReadyModel,
} from '../home-model';
import { HomeScreen, type HomeScreenProps } from '../home-screen';
import type { NeighbourGardens } from '../neighbours';

afterEach(resetDeviceConditions);

const TODAY = parseLocalDate('2026-11-24');
const RANGES = quranStructure.hizbPageRanges();

function modelOf(history: ReadingHistoryName): HomeReadyModel {
  return buildHomeModel({
    ...buildReadingHistory(history, TODAY, RANGES),
    today: TODAY,
    hizbPageRanges: RANGES,
  });
}

const MODELS: Readonly<Record<ReadingHistoryName, HomeReadyModel>> = {
  'bare-earth': modelOf('bare-earth'),
  thriving: modelOf('thriving'),
  thirsty: modelOf('thirsty'),
  wilting: modelOf('wilting'),
  dying: modelOf('dying'),
  dead: modelOf('dead'),
  recovering: modelOf('recovering'),
  'khatma-complete': modelOf('khatma-complete'),
};
const HISTORIES = Object.keys(MODELS) as ReadingHistoryName[];

type ActionsSpy = { [Key in keyof HomeActions]: jest.Mock } & HomeActions;

function actionsSpy(): ActionsSpy {
  return {
    readAndWater: jest.fn(),
    retry: jest.fn(),
    openProfile: jest.fn(),
    openFriends: jest.fn(),
    openFriend: jest.fn(),
    startNewKhatma: jest.fn(),
    share: jest.fn(),
    dismissArrival: jest.fn(),
  };
}

const SIGNED_OUT: NeighbourGardens = { status: 'signed-out' };

function propsOf(model: HomeModel, overrides: Partial<HomeScreenProps> = {}): HomeScreenProps {
  return {
    model,
    actions: actionsSpy(),
    today: TODAY,
    neighbours: SIGNED_OUT,
    avatarInitial: null,
    arrival: null,
    ...overrides,
  };
}

/** The name of the main button of each layout, in French. */
const MAIN_ACTION: Readonly<Record<HomeReadyModel['layout'], string>> = {
  growing: 'Lire et arroser',
  thirsty: 'Arroser maintenant',
  dead: 'Lire une page',
  complete: 'Nouvelle khatma',
};

describe.each(HISTORIES)('HomeScreen, %s', (history) => {
  const model = MODELS[history];

  it.each(SCREEN_CONDITIONS)(
    'shows the garden and what to read ($scheme, $language)',
    async ({ language, ...device }) => {
      setDeviceConditions(device);
      const i18n = await showLanguage(language);
      const t = i18n.getFixedT(language, 'home');
      const tGarden = i18n.getFixedT(language, 'garden');
      const { result: colors } = await renderHook(() => useColors());
      await render(<HomeScreen {...propsOf(model)} />);

      // The garden, described in words for screen readers.
      expect(
        screen.getByRole('image', { name: gardenSceneLabel(model.garden, tGarden) }),
      ).toBeOnTheScreen();
      // The title, in the heading colour of the mockups (the completed khatma has its own).
      const title = screen.getByRole('header', {
        name: t(model.layout === 'complete' ? 'complete.title' : 'title'),
      });
      expect(styleOf(title).color).toBe(colors.current.heading);

      // Mirrors in Arabic, cuts no text.
      expect(directionDependentStyles(screen.container)).toEqual([]);
      expect(fixedHeightsAroundText(screen.container)).toEqual([]);
      // Orange never colours a word: it stays on symbols.
      const orangeTexts = screen.container.queryAll(
        (element) => element.type === 'Text' && styleOf(element).color === colors.current.warning,
      );
      expect(orangeTexts).toHaveLength(0);
    },
  );

  it('has one main button, named by what it does, large enough to touch', async () => {
    await showLanguage('fr');
    const props = propsOf(model);
    await render(<HomeScreen {...props} />);
    const main = screen.getByRole('button', { name: MAIN_ACTION[model.layout] });
    expect(touchTargetHeight(main)).toBeGreaterThanOrEqual(layout.touchTarget);
    await fireEvent.press(main);
    if (model.layout === 'complete') {
      expect(props.actions.startNewKhatma).toHaveBeenCalledWith(1);
    } else {
      expect(props.actions.readAndWater).toHaveBeenCalledTimes(1);
    }
  });

  it('keeps every word whole and reachable at the largest text size', async () => {
    setDeviceConditions({ fontScale: LARGEST_FONT_SCALE });
    await showLanguage('fr');
    await render(<HomeScreen {...propsOf(model)} />);
    expect(fixedHeightsAroundText(screen.container)).toEqual([]);
    // The initial in an avatar is a shape, hidden from screen readers: the only text kept at its size.
    const limitedTexts = screen.container.queryAll(
      ({ type, props }) =>
        type === 'Text' &&
        (props.numberOfLines !== undefined ||
          props.allowFontScaling === false ||
          props.maxFontSizeMultiplier !== undefined),
    );
    expect(limitedTexts).toHaveLength(0);
  });

  it('renders on an iPhone: no React Native view inside a SwiftUI host', async () => {
    await showLanguage('fr');
    await renderOnIOS(<HomeScreen {...propsOf(model)} />);
    expect(reactNativeViewsInsideSwiftUI()).toEqual([]);
  });
});

describe('HomeScreen, the validated home (accueil.png) at hizb 24', () => {
  const model = MODELS.thriving;

  it('has the date, the title, the streak and the avatar that opens the profile', async () => {
    await showLanguage('fr');
    const props = propsOf(model, { avatarInitial: 'O' });
    await render(<HomeScreen {...props} />);
    expect(screen.getByText(formatHeaderDate(TODAY, 'fr'))).toBeOnTheScreen();
    expect(formatHeaderDate(TODAY, 'fr')).toBe('Mardi 24 novembre');
    expect(screen.getByLabelText(`${model.streakDays} jours de suite`)).toHaveTextContent(
      String(model.streakDays),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Profil' }));
    expect(props.actions.openProfile).toHaveBeenCalledTimes(1);
  });

  it('labels the element growing over the garden, with how much of its hizb is read', async () => {
    await showLanguage('fr');
    await render(<HomeScreen {...propsOf(model)} />);
    const next = model.garden.nextElement;
    if (next === null) throw new Error('hizb 24 has a next element');
    const percent = Math.round(next.growth * 100);
    expect(screen.getByTestId('home-growing')).toHaveProp(
      'accessibilityLabel',
      expect.stringMatching(new RegExp(`^Hizb 25, .+ pousse, ${percent}\\s% du hizb lu$`)),
    );
  });

  it('counts the hizb in words and in sixty dots, and how long the water has run', async () => {
    await showLanguage('fr');
    await render(<HomeScreen {...propsOf(model)} />);
    expect(screen.getByLabelText('24 hizb sur 60')).toBeOnTheScreen();
    expect(screen.getByRole('progressbar', { name: 'Hizb terminés' })).toHaveAccessibilityValue({
      min: 0,
      max: 60,
      now: 24,
    });
    expect(screen.getByTestId('home-water')).toHaveTextContent(
      `Arrosé depuis ${model.streakDays} j`,
    );
    expect(screen.getByLabelText(`Arrosé depuis ${model.streakDays} jours`)).toBeOnTheScreen();
  });

  it('says the pages of the day and what is left of the hizb, then where to resume', async () => {
    await showLanguage('fr');
    await render(<HomeScreen {...propsOf(model)} />);
    expect(screen.getByTestId('home-today-pages')).toHaveProp(
      'accessibilityLabel',
      `Arrosage du jour, 3 pages sur 5, Encore ${model.hizb.pagesLeft} pages pour finir le hizb 25`,
    );
    expect(screen.getByTestId('home-resume')).toHaveTextContent(
      new RegExp(`^Yusuf.*page ${model.reading.nextPage}يوسف$`),
    );
  });

  it('names the last element added, without its verse while none is validated', async () => {
    await showLanguage('fr');
    await render(<HomeScreen {...propsOf(model)} />);
    expect(screen.getByLabelText('Ajouté au hizb 24, Sources')).toBeOnTheScreen();
    // No verse text: the associations wait for a teacher (catalog.ts, displayableVerse).
    expect(screen.queryByText(/verset/)).toBeNull();
  });

  it('signed out, "Jardins voisins" says how to see friends\' gardens and leads to Proches', async () => {
    await showLanguage('fr');
    const props = propsOf(model);
    await render(<HomeScreen {...props} />);
    expect(screen.getByRole('header', { name: 'Jardins voisins' })).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole('button', { name: /^Connecte-toi dans Proches pour voir ici/ }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Tout voir' }));
    expect(props.actions.openFriends).toHaveBeenCalledTimes(2);
  });

  it("signed in, shows each friend's garden as a card that opens the friend", async () => {
    await showLanguage('fr');
    const friendGarden = MODELS.thriving.garden;
    const neighbours: NeighbourGardens = {
      status: 'ready',
      gardens: [
        {
          userId: 'u1',
          name: 'Imane',
          initial: 'I',
          colorIndex: 0,
          garden: friendGarden,
          detail: { kind: 'watered', hizb: 38, days: 21 },
        },
        {
          userId: 'u2',
          name: 'Bilal',
          initial: 'B',
          colorIndex: 1,
          garden: MODELS.thirsty.garden,
          detail: { kind: 'thirsty', hizb: 14, days: 2 },
        },
      ],
    };
    const props = propsOf(model, { neighbours });
    await render(<HomeScreen {...props} />);
    expect(
      screen.getByRole('button', { name: 'Imane, 38 hizb, arrosé depuis 21 j' }),
    ).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Bilal, 14 hizb, a soif depuis 2 j' }),
    );
    expect(props.actions.openFriend).toHaveBeenCalledWith('u2');
  });

  it('a friend list still loading leaves the section out rather than flashing an empty state', async () => {
    await showLanguage('fr');
    await render(<HomeScreen {...propsOf(model, { neighbours: { status: 'loading' } })} />);
    expect(screen.queryByRole('header', { name: 'Jardins voisins' })).toBeNull();
  });
});

describe('HomeScreen, a thirsty garden (soif.png)', () => {
  it.each<[ReadingHistoryName, string, string]>([
    [
      'thirsty',
      'Ton jardin a soif',
      '3 jours sans lecture : l’eau s’est arrêtée et l’herbe jaunit. Dans 3 jours, les arbres perdent leurs feuilles.',
    ],
    [
      'wilting',
      'Ton jardin fane',
      '6 jours sans lecture : les arbres perdent leurs feuilles. Dans 4 jours, des éléments commencent à disparaître.',
    ],
    [
      'dying',
      'Ton jardin se dessèche',
      '10 jours sans lecture : des éléments du jardin disparaissent. Dans 4 jours, il ne restera qu’une terre sèche.',
    ],
  ])(
    '%s: the banner says the days, what they did and what comes next',
    async (history, title, text) => {
      await showLanguage('fr');
      await render(<HomeScreen {...propsOf(MODELS[history])} />);
      const banner = screen.getByTestId(`home-notice-${history}`);
      // The matcher reads every kind of space, non-breaking ones included, as one space.
      expect(banner).toHaveTextContent(`${title}${text}`);
      expect(screen.getByTestId('home-water')).toHaveTextContent(/^À sec depuis \d+ j$/);
      expect(screen.getByTestId('home-today-pages')).toHaveTextContent(
        /Une page suffit pour que l’eau revienne/,
      );
      // No element to celebrate while the garden suffers.
      expect(screen.queryByTestId('home-added')).toBeNull();
      expect(screen.queryByTestId('home-growing')).toBeNull();
    },
  );
});

describe('HomeScreen, a dead garden (mort.png)', () => {
  it('says what happened, that the hizb stay counted, and offers one page', async () => {
    await showLanguage('fr');
    await render(<HomeScreen {...propsOf(MODELS.dead)} />);
    expect(screen.getByRole('header', { name: 'Ton jardin s’est desséché' })).toBeOnTheScreen();
    expect(
      screen.getByText('14 jours sans lecture. Il ne reste qu’une terre sèche.'),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('home-notice-dead')).toHaveTextContent(
      'Tes 24 hizb restent comptés. Dès que tu reprends, l’eau revient, puis ton jardin repousse, élément par élément.',
    );
    // Only what brings the garden back: no card of the day, no neighbours.
    expect(screen.queryByTestId('home-today')).toBeNull();
    expect(screen.queryByTestId('home-neighbours')).toBeNull();
  });
});

describe('HomeScreen, the completed khatma (khatm.png)', () => {
  const model = MODELS['khatma-complete'];

  it('gives the figures of the khatma, a blessing, and two buttons', async () => {
    await showLanguage('fr');
    const props = propsOf(model);
    await render(<HomeScreen {...props} />);
    const days = model.completedKhatma?.days ?? Number.NaN;
    expect(screen.getByText('60 hizb sur 60')).toBeOnTheScreen();
    expect(screen.getByText('تقبّل الله منك')).toBeOnTheScreen();
    expect(screen.getByText('Qu’Allah l’accepte de toi.')).toBeOnTheScreen();
    expect(screen.getByLabelText(`60 hizb, 604 pages, en ${days} jours`)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Partager' }));
    expect(props.actions.share).toHaveBeenCalledWith(
      `J’ai terminé une khatma en ${days} jours. Mon jardin est complet.`,
    );
  });

  it('in Arabic, the blessing is not translated into itself', async () => {
    await showLanguage('ar');
    await render(<HomeScreen {...propsOf(model)} />);
    expect(screen.getByText('تقبّل الله منك')).toBeOnTheScreen();
    expect(screen.queryByText('Qu’Allah l’accepte de toi.')).toBeNull();
  });
});

describe('HomeScreen, a hizb just finished (nouveau.png)', () => {
  const garden = MODELS.thriving.garden;
  const arrival = newArrival({ ...garden, hizbCompleted: 23 }, garden);

  it('opens a sheet with the element, its sentence and the next one', async () => {
    if (arrival === null) throw new Error('an arrival is expected');
    await showLanguage('fr');
    const props = propsOf(MODELS.thriving, { arrival });
    await render(<HomeScreen {...props} />);
    const sheet = screen.getByTestId('home-arrival');
    expect(sheet).toHaveTextContent(/Hizb 24 terminé/);
    expect(sheet).toHaveTextContent(/Des sources jaillissent dans ton jardin/);
    expect(sheet).toHaveTextContent(/Prochain élément, au hizb 25/);
    await fireEvent.press(screen.getByRole('button', { name: 'Voir dans mon jardin' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));
    expect(props.actions.dismissArrival).toHaveBeenCalledTimes(2);
    await fireEvent.press(screen.getByRole('button', { name: 'Partager' }));
    expect(props.actions.share).toHaveBeenCalledTimes(1);
  });

  it('is not shown over a garden that suffers', async () => {
    if (arrival === null) throw new Error('an arrival is expected');
    await showLanguage('fr');
    await render(<HomeScreen {...propsOf(MODELS.thirsty, { arrival })} />);
    expect(screen.queryByTestId('home-arrival')).toBeNull();
  });
});

describe('HomeScreen, unavailable', () => {
  it.each(SCREEN_CONDITIONS)(
    'says what happened and offers to try again ($scheme, $language)',
    async ({ language, ...device }) => {
      setDeviceConditions(device);
      const i18n = await showLanguage(language);
      const t = i18n.getFixedT(language, 'home');
      const props = propsOf({ status: 'unavailable' });
      await render(<HomeScreen {...props} />);
      expect(screen.getByTestId('home-unavailable')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: t('unavailable.retry') }));
      expect(props.actions.retry).toHaveBeenCalledTimes(1);
      expect(directionDependentStyles(screen.container)).toEqual([]);
    },
  );
});

describe('the home locale files', () => {
  /** Plural forms differ by language: "streak_one" and "streak_few" are both the key "streak". */
  function keysOf(value: unknown, prefix = ''): string[] {
    if (typeof value !== 'object' || value === null) {
      return [prefix.replace(/_(zero|one|two|few|many|other)$/, '')];
    }
    return Object.entries(value).flatMap(([key, child]) =>
      keysOf(child, prefix === '' ? key : `${prefix}.${key}`),
    );
  }
  const uniqueKeys = (locale: unknown) => [...new Set(keysOf(locale))].sort();
  const textsOf = (locale: unknown): string[] =>
    typeof locale === 'string'
      ? [locale]
      : typeof locale === 'object' && locale !== null
        ? Object.values(locale).flatMap(textsOf)
        : [];

  it('have the same keys in French, English and Arabic', () => {
    expect(uniqueKeys(enHome)).toEqual(uniqueKeys(frHome));
    expect(uniqueKeys(arHome)).toEqual(uniqueKeys(frHome));
  });

  it('French never lets a colon start a line: the space before it does not break', () => {
    expect(textsOf(frHome).filter((text) => / :/.test(text))).toEqual([]);
    expect(textsOf(frHome).filter((text) => / :/.test(text)).length).toBeGreaterThan(0);
  });

  it('English titles are capitalised like the other titles', () => {
    const titles = [
      enHome.title,
      ...Object.values(enHome.thirst.title),
      enHome.dead.title,
      enHome.complete.title,
      enHome.notice.recovering.title,
    ];
    const lowercaseWords = titles.flatMap((title) =>
      title.split(' ').filter((word) => /^[a-z]/.test(word)),
    );
    expect(lowercaseWords).toEqual([]);
  });

  it('give Arabic its six plural forms', async () => {
    const i18n = await showLanguage('ar');
    const t = i18n.getFixedT('ar', 'home');
    const pages = [1, 2, 3, 11, 100].map((count) => t('today.pages', { count, goal: 5 }));
    expect(new Set(pages).size).toBe(pages.length);
    for (const count of [0, 1, 2, 3, 11, 100, READING_HISTORY_CONFIG.dailyGoalPages]) {
      for (const key of ['streak', 'today.hizbLeft', 'dead.text', 'thirst.text.thirsty']) {
        expect(t(key, { count, hizb: 25 })).not.toContain(key);
      }
    }
  });
});
