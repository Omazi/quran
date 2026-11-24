import { fireEvent, render, renderHook, screen } from '@testing-library/react-native';

import { quranStructure } from '@/data/quran';
import { recordPageRead } from '@/domain/khatm';
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
import {
  buildReadingHistory,
  READING_HISTORY_CONFIG,
  type ReadingHistoryName,
} from '../test-support/reading-histories';
import {
  buildHomeModel,
  type HomeActions,
  type HomeModel,
  type HomeNotice,
  type HomeReadyModel,
} from '../home-model';
import { HomeScreen } from '../home-screen';

afterEach(resetDeviceConditions);

const TODAY = parseLocalDate('2026-11-24');
const RANGES = quranStructure.hizbPageRanges();

function modelOf(preset: ReadingHistoryName): HomeReadyModel {
  return buildHomeModel({
    ...buildReadingHistory(preset, TODAY, RANGES),
    today: TODAY,
    hizbPageRanges: RANGES,
  });
}

/** A dead garden on the day the person reads one page again. */
function recoveringModel(): HomeReadyModel {
  const source = buildReadingHistory('dead', TODAY, RANGES);
  const nextPage = modelOf('dead').reading.nextPage;
  return buildHomeModel({
    ...source,
    journal: recordPageRead(source.journal, { page: nextPage, date: TODAY }),
    today: TODAY,
    hizbPageRanges: RANGES,
  });
}

interface HomeStateCase {
  readonly name: string;
  readonly model: HomeReadyModel;
  readonly notice: HomeNotice | null;
}

/** Every state of the home screen (docs/specs/ui-lot1.md, B.3), built once. */
const STATES: readonly HomeStateCase[] = [
  { name: 'bare earth', model: modelOf('bare-earth'), notice: 'bare' },
  { name: 'thriving', model: modelOf('thriving'), notice: null },
  { name: 'thirsty', model: modelOf('thirsty'), notice: 'thirsty' },
  { name: 'wilting', model: modelOf('wilting'), notice: 'wilting' },
  { name: 'dying', model: modelOf('dying'), notice: 'dying' },
  { name: 'dead', model: modelOf('dead'), notice: 'dead' },
  { name: 'recovering', model: recoveringModel(), notice: 'recovering' },
  { name: 'khatma complete', model: modelOf('khatma-complete'), notice: 'complete' },
];

const UNAVAILABLE: HomeModel = { status: 'unavailable' };

function actionsSpy(): HomeActions & { readAndWater: jest.Mock } {
  return { readAndWater: jest.fn() };
}

describe.each(STATES)('HomeScreen, $name', ({ model, notice }) => {
  it.each(SCREEN_CONDITIONS)(
    'shows the garden and what to read ($scheme, $language)',
    async ({ language, ...device }) => {
      setDeviceConditions(device);
      const i18n = await showLanguage(language);
      const t = i18n.getFixedT(language, 'home');
      const tGarden = i18n.getFixedT(language, 'garden');
      const { result: colors } = await renderHook(() => useColors());
      const actions = actionsSpy();
      await render(<HomeScreen model={model} actions={actions} />);

      // Title, scene, and the state in words for screen readers.
      expect(screen.getByRole('header', { name: t('title') })).toBeOnTheScreen();
      expect(
        screen.getByRole('image', { name: gardenSceneLabel(model.garden, tGarden) }),
      ).toBeOnTheScreen();
      expect(screen.getByTestId('garden-water')).toBeOnTheScreen();
      expect(
        screen.getByRole('progressbar', { name: tGarden('readout.hizb.label') }),
      ).toBeOnTheScreen();

      // The message of the day: words beside a symbol, or nothing while the garden thrives.
      if (notice === null) {
        expect(screen.queryByTestId(/^home-notice-/)).toBeNull();
      } else {
        const banner = screen.getByTestId(`home-notice-${notice}`);
        expect(banner).toHaveTextContent(new RegExp(t(`notice.${notice}.title`)));
        expect(banner).toHaveTextContent(new RegExp(t(`notice.${notice}.text`)));
      }

      // Today: pages read out of the goal, the page to read, the estimated end.
      expect(screen.getByRole('header', { name: t('today.title') })).toBeOnTheScreen();
      expect(screen.getByTestId('home-today-pages')).toHaveTextContent(
        new RegExp(`${model.today.pagesRead}\\D+${model.today.goalPages}`),
      );
      expect(screen.getByTestId('home-next-page')).toHaveTextContent(
        new RegExp(t('today.page.value', { page: model.reading.nextPage })),
      );
      expect(screen.getByTestId('home-finish')).toBeOnTheScreen();

      // One button, named by what it does, large enough to touch, and it calls the action.
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(1);
      const read = screen.getByRole('button', { name: t('actions.read') });
      expect(touchTargetHeight(read)).toBeGreaterThanOrEqual(layout.touchTarget);
      expect(touchTargetHeight(read)).toBeGreaterThanOrEqual(44);
      await fireEvent.press(read);
      expect(actions.readAndWater).toHaveBeenCalledTimes(1);

      // Mirrors in Arabic, cuts no text, and takes its colours from the roles of this appearance.
      expect(directionDependentStyles(screen.container)).toEqual([]);
      expect(fixedHeightsAroundText(screen.container)).toEqual([]);
      const title = screen.getByRole('header', { name: t('title') });
      expect(styleOf(title).color).toBe(colors.current.label);
      // Orange never colours a word: it stays on symbols and gauges.
      const orangeTexts = screen.container.queryAll(
        (element) => element.type === 'Text' && styleOf(element).color === colors.current.warning,
      );
      expect(orangeTexts).toHaveLength(0);
    },
  );

  it('keeps every word whole and reachable at the largest text size', async () => {
    setDeviceConditions({ fontScale: LARGEST_FONT_SCALE });
    await showLanguage('fr');
    await render(<HomeScreen model={model} actions={actionsSpy()} />);
    expect(fixedHeightsAroundText(screen.container)).toEqual([]);
    const limitedTexts = screen.container.queryAll(
      ({ type, props }) =>
        type === 'Text' &&
        (props.numberOfLines !== undefined ||
          props.allowFontScaling === false ||
          props.maxFontSizeMultiplier !== undefined),
    );
    expect(limitedTexts).toHaveLength(0);
    // What is above the list gives way and scrolls; the list keeps room for a few rows.
    expect(styleOf(screen.getByTestId('home-top'))).toMatchObject({ flexGrow: 0, flexShrink: 1 });
    const list = screen.getByTestId('home-list').parent;
    expect(list === null ? {} : styleOf(list)).toMatchObject({
      flex: 1,
      minHeight: layout.touchTarget * 3,
    });
  });

  it('is made of system components an iPhone can display', async () => {
    await showLanguage('fr');
    await renderOnIOS(<HomeScreen model={model} actions={actionsSpy()} />);
    expect(reactNativeViewsInsideSwiftUI()).toEqual([]);
  });
});

describe('HomeScreen, the words of each state in French', () => {
  const frenchNotices: readonly (readonly [string, HomeReadyModel, string, string])[] = [
    [
      'bare earth',
      modelOf('bare-earth'),
      'Une terre nue',
      'Ton premier hizb fera naître ton jardin.',
    ],
    [
      'thirsty',
      modelOf('thirsty'),
      'Ton jardin a soif',
      'Une page suffit pour faire revenir l’eau.',
    ],
    [
      'wilting',
      modelOf('wilting'),
      'Ton jardin fane',
      'Une page aujourd’hui, et il reprend des forces.',
    ],
    ['dying', modelOf('dying'), 'Ton jardin dépérit', 'Une page fait déjà revenir des éléments.'],
    [
      'dead',
      modelOf('dead'),
      'Rien n’est perdu',
      'Tes hizb lus restent acquis. Une page fait revenir l’eau.',
    ],
    [
      'recovering',
      recoveringModel(),
      'L’eau est revenue',
      'Ton jardin reprend des forces. Continue demain.',
    ],
    [
      'khatma complete',
      modelOf('khatma-complete'),
      'Khatma terminée',
      'Ton jardin est complet. Lis une page pour commencer la suivante : un nouveau jardin t’attend.',
    ],
  ];

  it.each(frenchNotices)('%s', async (_, model, title, text) => {
    await showLanguage('fr');
    await render(<HomeScreen model={model} actions={actionsSpy()} />);
    expect(screen.getByText(title)).toBeOnTheScreen();
    expect(screen.getByText(text)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Lire et arroser' })).toBeOnTheScreen();
  });

  it('thriving at hizb 24: streak, pages of the day, where to resume, estimated end', async () => {
    await showLanguage('fr');
    const model = modelOf('thriving');
    await render(<HomeScreen model={model} actions={actionsSpy()} />);
    expect(screen.getByTestId('home-streak')).toHaveTextContent(
      `${model.streakDays} jours de suite`,
    );
    expect(screen.getByTestId('home-today-pages')).toHaveTextContent('Pages lues3 sur 5');
    expect(screen.getByTestId('home-next-page')).toHaveTextContent(
      `ReprendrePage ${model.reading.nextPage}`,
    );
    expect(screen.getByTestId('home-finish')).toHaveTextContent(
      /^Fin estimée de la khatma\d{1,2} \S+ 202\d$/,
    );
    expect(
      screen.getByText('Estimation au rythme de ton objectif : 5 pages par jour.'),
    ).toBeOnTheScreen();
  });

  it('new user: the page is to start, not to resume, and no streak is shown as a zero', async () => {
    await showLanguage('fr');
    await render(<HomeScreen model={modelOf('bare-earth')} actions={actionsSpy()} />);
    expect(screen.getByTestId('home-next-page')).toHaveTextContent('CommencerPage 1');
    expect(screen.getByTestId('home-today-pages')).toHaveTextContent('Pages lues0 sur 5');
    expect(screen.queryByTestId('home-streak')).toBeNull();
  });

  it('khatma complete: the page and the estimate are those of the next khatma', async () => {
    await showLanguage('fr');
    await render(<HomeScreen model={modelOf('khatma-complete')} actions={actionsSpy()} />);
    expect(screen.getByTestId('home-next-page')).toHaveTextContent('CommencerPage 1');
    expect(screen.getByTestId('home-finish')).toHaveTextContent(
      /^Fin estimée de la prochaine khatma/,
    );
  });

  it('says when the goal of the day is reached, and when the khatma ends today', async () => {
    await showLanguage('fr');
    const thriving = modelOf('thriving');
    const model: HomeReadyModel = {
      ...thriving,
      today: { ...thriving.today, pagesRead: 5, pagesRemaining: 0, goalReached: true },
      reading: { ...thriving.reading, estimatedFinishDate: TODAY, finishesToday: true },
    };
    await render(<HomeScreen model={model} actions={actionsSpy()} />);
    expect(screen.getByTestId('home-today-pages')).toHaveTextContent(
      'Pages lues5 sur 5, objectif atteint',
    );
    expect(screen.getByTestId('home-finish')).toHaveTextContent(
      'Fin estimée de la khatmaAujourd’hui',
    );
  });

  it('writes the estimated end in the language of the interface', async () => {
    const thriving = modelOf('thriving');
    const model: HomeReadyModel = {
      ...thriving,
      reading: { ...thriving.reading, estimatedFinishDate: parseLocalDate('2027-03-12') },
    };
    await showLanguage('en');
    const english = await render(<HomeScreen model={model} actions={actionsSpy()} />);
    expect(screen.getByTestId('home-finish')).toHaveTextContent(/March 12, 2027$/);
    expect(screen.getByRole('button', { name: 'Read and Water' })).toBeOnTheScreen();
    await english.unmount();
    await showLanguage('fr');
    await render(<HomeScreen model={model} actions={actionsSpy()} />);
    expect(screen.getByTestId('home-finish')).toHaveTextContent(/12 mars 2027$/);
  });
});

describe('HomeScreen, unavailable', () => {
  it.each(SCREEN_CONDITIONS)(
    'says what happened and what to do ($scheme, $language)',
    async ({ language, ...device }) => {
      setDeviceConditions(device);
      const i18n = await showLanguage(language);
      const t = i18n.getFixedT(language, 'home');
      await render(<HomeScreen model={UNAVAILABLE} actions={actionsSpy()} />);
      expect(screen.getByRole('header', { name: t('title') })).toBeOnTheScreen();
      expect(screen.getByText(t('unavailable.title'))).toBeOnTheScreen();
      expect(screen.getByText(t('unavailable.description'))).toBeOnTheScreen();
      // No garden and no numbers are made up, and there is nothing to press.
      expect(screen.queryByTestId('garden-scene')).toBeNull();
      expect(screen.queryByRole('button')).toBeNull();
      expect(directionDependentStyles(screen.container)).toEqual([]);
      expect(fixedHeightsAroundText(screen.container)).toEqual([]);
    },
  );

  it('is made of system components an iPhone can display', async () => {
    await showLanguage('fr');
    await renderOnIOS(<HomeScreen model={UNAVAILABLE} actions={actionsSpy()} />);
    expect(reactNativeViewsInsideSwiftUI()).toEqual([]);
  });
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

  it('have the same keys in French, English and Arabic', () => {
    expect(uniqueKeys(enHome)).toEqual(uniqueKeys(frHome));
    expect(uniqueKeys(arHome)).toEqual(uniqueKeys(frHome));
  });

  it('give Arabic its six plural forms', async () => {
    const i18n = await showLanguage('ar');
    const t = i18n.getFixedT('ar', 'home');
    const streaks = [1, 2, 3, 11, 100].map((count) => t('streak', { count }));
    expect(new Set(streaks).size).toBe(streaks.length);
    for (const count of [1, 2, 3, 11, 100, READING_HISTORY_CONFIG.dailyGoalPages]) {
      expect(t('today.footer', { count })).not.toContain('today.footer');
      expect(t('streak', { count })).not.toContain('streak');
    }
  });
});
