import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { quranStructure } from '@/data/quran';
import type { SpeechEngine } from '@/domain/listening';
import type { VerseIndex } from '@/domain/recognition';
import {
  reactNativeViewsInsideSwiftUI,
  SCREEN_CONDITIONS,
  showLanguage,
  type ScreenConditions,
} from '@/features/garden/test-support/screen-conditions';
import { listeningPalette } from '@/ui/listening-tokens';
import { appColors } from '@/ui/tokens';
import {
  directionDependentStyles,
  renderOnIOS,
  resetDeviceConditions,
  setDeviceConditions,
  styleOf,
  touchTargetHeight,
  withDescendants,
  type RenderedElement,
} from '@/ui/test-support/environment';

import { ListeningScreen } from '../listening-screen';
import { createScenarioEngine, type ScenarioName } from '../simulated/scenarios';
import { loadQuranVerseIndex, loadQuranVerseText } from '../verse-index-source';

// A mock factory runs before imports: `require` is the only way to load the stand-in here.
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('react-native-reanimated', () => require('../test-support/reanimated-stand-in'));

let index: VerseIndex;
beforeAll(async () => {
  index = await loadQuranVerseIndex();
});

afterEach(async () => {
  jest.useRealTimers();
  await resetDeviceConditions();
});

const actions = { onClose: jest.fn(), onOpenPage: jest.fn(), onOpenSettings: jest.fn() };
beforeEach(() => {
  for (const action of Object.values(actions)) action.mockClear();
});

/** The safe area of an iPhone with a notch, as the mockups are drawn. */
const IPHONE_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function screenFor(engine: SpeechEngine) {
  return (
    <SafeAreaProvider initialMetrics={IPHONE_METRICS}>
      <ListeningScreen
        engine={engine}
        loadVerseIndex={() => Promise.resolve(index)}
        structure={quranStructure}
        loadVerseText={loadQuranVerseText}
        {...actions}
      />
    </SafeAreaProvider>
  );
}

/** Moves the clock on and lets every promise settle. */
async function wait(milliseconds: number) {
  await act(async () => {
    for (let elapsed = 0; elapsed < milliseconds; elapsed += 100) {
      jest.advanceTimersByTime(100);
      await Promise.resolve();
      await Promise.resolve();
    }
  });
}

/** Time for every scenario to reach its end. */
const WHOLE_SCENARIO_MS = 20000;

/** Renders the screen with a scenario until it has reached its state. */
async function showScenario(
  scenario: ScenarioName,
  conditions: ScreenConditions & { reducedMotion?: boolean },
  milliseconds = WHOLE_SCENARIO_MS,
) {
  const { language, ...device } = conditions;
  setDeviceConditions(device);
  await showLanguage(language);
  jest.useFakeTimers();
  await render(screenFor(createScenarioEngine(scenario)));
  await wait(milliseconds);
}

/** The rings and the ground are hidden from screen readers: the queries must ask for them. */
const HIDDEN = { includeHiddenElements: true };

const MOTION = [false, true] as const;
const MATRIX = SCREEN_CONDITIONS.flatMap((conditions) =>
  MOTION.map((reducedMotion) => ({ ...conditions, reducedMotion })),
);
const label = ({ language, scheme, reducedMotion }: (typeof MATRIX)[number]) =>
  `${language}, ${scheme}, ${reducedMotion ? 'reduced motion' : 'motion'}`;

const TEXT = {
  fr: {
    title: 'Reconnaître un passage',
    prompt: 'Récite ou fais écouter un passage',
    stop: 'Arrêter l’écoute',
    again: 'Écouter à nouveau',
    back: 'Retour',
    open: 'Ouvrir dans le mushaf',
  },
  ar: {
    title: 'التعرّف على مقطع',
    prompt: 'اتلُ مقطعًا أو أسمِعه',
    stop: 'أوقف الاستماع',
    again: 'استمع مجددًا',
    back: 'رجوع',
    open: 'افتح في المصحف',
  },
} as const;

function language(conditions: ScreenConditions): 'fr' | 'ar' {
  return conditions.language === 'ar' ? 'ar' : 'fr';
}

describe.each(MATRIX)(
  'listening ($language, $scheme, reduced motion: $reducedMotion)',
  (conditions) => {
    const text = TEXT[language(conditions)];

    it(`${label(conditions)}: the title, the sentence, the gold microphone in its rings, no card`, async () => {
      await showScenario('listening', conditions, 3000);
      expect(screen.getByRole('header', { name: text.title })).toBeOnTheScreen();
      expect(screen.getByText(text.prompt)).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: text.back })).toBeOnTheScreen();
      // The microphone is the one gesture: while the screen listens, it stops.
      expect(screen.getByRole('button', { name: text.stop })).toBeOnTheScreen();
      expect(screen.getByTestId('listening-rings', HIDDEN)).toBeOnTheScreen();
      expect(screen.getByTestId('listening-scene', HIDDEN)).toBeOnTheScreen();
      // Reduced motion: no ripple leaves (motion.md; D29).
      expect(screen.queryByTestId('listening-ripples', HIDDEN) === null).toBe(
        conditions.reducedMotion,
      );
      expect(screen.queryByTestId('listening-found')).toBeNull();
    });

    it(`${label(conditions)}: the title is a headline, the sentence a subhead, in the mockup's colours`, async () => {
      await showScenario('listening', conditions, 500);
      const appearance = conditions.scheme === 'dark' ? 'dark' : 'light';
      const title = screen.getByRole('header', { name: text.title });
      expect(styleOf(title)).toMatchObject({
        fontSize: 17,
        fontWeight: '600',
        color: listeningPalette.onScene[appearance],
      });
      expect(title.props.dynamicTypeRamp).toBe('headline');
      expect(styleOf(screen.getByText(text.prompt))).toMatchObject({
        fontSize: 15,
        color: listeningPalette.onSceneSecondary[appearance],
      });
    });
  },
);

describe('listening, for everyone', () => {
  it('the ground and the rings are ornaments: screen readers never reach them', async () => {
    await showScenario('listening', SCREEN_CONDITIONS[0] ?? { language: 'fr' }, 500);
    for (const testID of ['listening-scene', 'listening-rings']) {
      const ornament = screen.getByTestId(testID, HIDDEN);
      expect(ornament.props.importantForAccessibility).toBe('no-hide-descendants');
      expect(ornament.props.accessibilityElementsHidden).toBe(true);
    }
  });

  it('announces that it listens, then the passage it found', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await showScenario('found', { language: 'fr' });
    expect(announce).toHaveBeenCalledWith('À l’écoute');
    expect(announce).toHaveBeenLastCalledWith('Passage reconnu : Sourate Al-Kahf, Verset 10');
  });

  it('every control is a 44-point target, and nothing is placed by a physical side', async () => {
    await showScenario('listening', { language: 'ar', rightToLeft: true }, 500);
    expect(touchTargetHeight(screen.getByTestId('listening-orb'))).toBeGreaterThanOrEqual(44);
    expect(touchTargetHeight(screen.getByTestId('listening-back'))).toBeGreaterThanOrEqual(44);
    expect(directionDependentStyles(screen.getByTestId('listening'))).toEqual([]);
  });

  it('closes the screen when the person stops before a word, or goes back', async () => {
    await showScenario('listening', { language: 'fr' }, 500);
    await fireEvent.press(screen.getByRole('button', { name: 'Arrêter l’écoute' }));
    await wait(100);
    expect(actions.onClose).toHaveBeenCalledTimes(1);
  });

  it('the back button leaves the screen', async () => {
    await showScenario('listening', { language: 'fr' }, 500);
    await fireEvent.press(screen.getByRole('button', { name: 'Retour' }));
    expect(actions.onClose).toHaveBeenCalledTimes(1);
  });
});

/** A surah's name as the card prints it: the data's, with a typographic apostrophe. */
function printedName(surah: number, isArabic: boolean): string {
  const info = quranStructure.surah(surah);
  return isArabic ? info.nameArabic : info.nameTransliterated.replace(/'/g, '\u2019');
}

describe.each(MATRIX)(
  'passage found ($language, $scheme, reduced motion: $reducedMotion)',
  (conditions) => {
    it(`${label(conditions)}: the card names the place, the page, and opens the reader`, async () => {
      await showScenario('found', conditions);
      const isArabic = conditions.language === 'ar';
      const text = TEXT[language(conditions)];
      const appearance = conditions.scheme === 'dark' ? 'dark' : 'light';
      const place = isArabic ? `${printedName(18, true)}، الآية 10` : 'Al-Kahf, verset 10';
      const title = screen.getByRole('header', { name: place });
      expect(styleOf(title)).toMatchObject({
        fontSize: 20,
        fontWeight: '700',
        color: listeningPalette.cardTitle[appearance],
      });
      expect(
        screen.getByText(isArabic ? 'تم التعرّف على المقطع' : 'Passage reconnu'),
      ).toBeOnTheScreen();
      const page = quranStructure.pageOfVerse({ surah: 18, verse: 10 });
      expect(page).toBe(294);
      expect(screen.getByText(isArabic ? `الصفحة ${page}` : `Page ${page}`)).toBeOnTheScreen();
      const open = screen.getByRole('button', { name: text.open });
      expect(touchTargetHeight(open)).toBeGreaterThanOrEqual(44);
      expect(styleOf(open).backgroundColor).toBe(listeningPalette.cardAction[appearance]);
      await fireEvent.press(open);
      expect(actions.onOpenPage).toHaveBeenCalledWith(page);
      expect(styleOf(screen.getByTestId('listening-found')).backgroundColor).toBe(
        listeningPalette.card[appearance],
      );
      // The scene stays: the microphone now listens again, and its ripples have stopped.
      expect(screen.getByRole('button', { name: text.again })).toBeOnTheScreen();
      expect(screen.queryByTestId('listening-ripples', HIDDEN)).toBeNull();
      expect(screen.getByTestId('listening-rings', HIDDEN)).toBeOnTheScreen();
    });
  },
);

describe('passage found, the verse', () => {
  it('is shown exactly as the data layer gives it, in the Quran font, on paper', async () => {
    await showScenario('found', { language: 'fr' });
    const verse = await loadQuranVerseText({ surah: 18, verse: 10 });
    const block = screen.getByTestId('listening-verses');
    // The paper of the mushaf (on iOS, its dynamic colour: day and night values).
    expect(JSON.stringify(styleOf(block).backgroundColor)).toContain(appColors.paper.light);
    const quran = withDescendants(block).find(
      (element) => element.type === 'Text' && styleOf(element).fontFamily === 'KFGQPCHafsUthmanic',
    );
    expect(quran).toBeDefined();
    const runs = withDescendants(quran as RenderedElement)
      .filter((element) => element.type === 'Text' && typeof element.props.children === 'string')
      .map((element) => element.props.children as string);
    expect(runs).toEqual([verse, ' ١٠']);
    expect(quran?.props.accessibilityLanguage).toBe('ar');
  });

  it('listening again from the microphone starts a new listening', async () => {
    await showScenario('found', { language: 'fr' });
    await fireEvent.press(screen.getByRole('button', { name: 'Écouter à nouveau' }));
    await wait(200);
    expect(screen.queryByTestId('listening-found')).toBeNull();
    expect(screen.getByText('Récite ou fais écouter un passage')).toBeOnTheScreen();
  });
});

describe.each(MATRIX)(
  'several passages ($language, $scheme, reduced motion: $reducedMotion)',
  (conditions) => {
    it(`${label(conditions)}: every place, in the order of the mushaf, each opening its page`, async () => {
      await showScenario('several', conditions);
      const isArabic = conditions.language === 'ar';
      expect(
        screen.getByRole('header', { name: isArabic ? 'أيّها كنت تتلو؟' : 'Lequel récitais-tu ?' }),
      ).toBeOnTheScreen();
      expect(screen.getByText(isArabic ? 'عدة مقاطع' : 'Plusieurs passages')).toBeOnTheScreen();
      const names = [1, 6, 10, 37, 39, 40].map((surah) => printedName(surah, isArabic));
      const rows = screen
        .getAllByRole('button')
        .filter((button) =>
          names.some((name) => (button.props.accessibilityLabel ?? '').startsWith(name)),
        );
      expect(rows).toHaveLength(6);
      const firstPage = quranStructure.pageOfVerse({ surah: 1, verse: 2 });
      await fireEvent.press(rows[0] as RenderedElement);
      expect(actions.onOpenPage).toHaveBeenCalledWith(firstPage);
      // Choosing a place is the next step: no capsule button in the card.
      expect(screen.queryByTestId('listening-open-page')).toBeNull();
    });
  },
);

describe('several passages, the rows', () => {
  it('begin with the opening words of their verse, whole words as the data gives them', async () => {
    await showScenario('several', { language: 'fr' });
    const verse = await loadQuranVerseText({ surah: 6, verse: 45 });
    const row = screen.getByTestId('listening-place-6-45');
    const opening = verse.split(' ').slice(0, 6).join(' ');
    expect(hasText(row, opening)).toBe(true);
    expect(row.props.accessibilityLabel).toBe('Al-An’am, verset 45, Page 133');
    expect(touchTargetHeight(row)).toBeGreaterThanOrEqual(44);
  });
});

function hasText(element: RenderedElement, text: string): boolean {
  return withDescendants(element).some(
    (descendant) => descendant.type === 'Text' && descendant.props.children === text,
  );
}

const OUTCOMES = [
  {
    scenario: 'nothing',
    fr: 'Aucun passage trouvé',
    ar: 'لم يُعثر على مقطع',
    action: { fr: 'Écouter à nouveau', ar: 'استمع مجددًا' },
  },
  {
    scenario: 'silence',
    fr: 'Rien entendu',
    ar: 'لم يُسمع شيء',
    action: { fr: 'Écouter à nouveau', ar: 'استمع مجددًا' },
  },
  {
    scenario: 'denied',
    fr: 'Accès au micro désactivé',
    ar: 'الوصول إلى الميكروفون معطّل',
    action: { fr: 'Ouvrir les réglages', ar: 'افتح الإعدادات' },
  },
  {
    scenario: 'failed',
    fr: 'L’écoute s’est arrêtée',
    ar: 'توقف الاستماع',
    action: { fr: 'Écouter à nouveau', ar: 'استمع مجددًا' },
  },
] as const;

describe.each(OUTCOMES)('$scenario', (outcome) => {
  it.each(MATRIX)('%#: says what happened and what to do, without blame', async (conditions) => {
    await showScenario(outcome.scenario, conditions);
    const lang = language(conditions);
    const appearance = conditions.scheme === 'dark' ? 'dark' : 'light';
    // The scene at rest, with the card where a result would be.
    const title = screen.getByRole('header', { name: outcome[lang] });
    expect(styleOf(title)).toMatchObject({ fontSize: 20, fontWeight: '700' });
    expect(screen.getByRole('header', { name: TEXT[lang].title })).toBeOnTheScreen();
    expect(screen.queryByTestId('listening-ripples', HIDDEN)).toBeNull();
    const card = screen.getByTestId(`listening-${testIDOf(outcome.scenario)}`);
    expect(styleOf(card).backgroundColor).toBe(listeningPalette.card[appearance]);
    // The next step is the card's capsule, and the microphone does the same.
    const buttons = screen.getAllByRole('button', { name: outcome.action[lang] });
    expect(buttons).toHaveLength(2);
    for (const button of buttons) expect(touchTargetHeight(button)).toBeGreaterThanOrEqual(44);
    await fireEvent.press(buttons[buttons.length - 1] as RenderedElement);
    if (outcome.scenario === 'denied') expect(actions.onOpenSettings).toHaveBeenCalledTimes(1);
  });
});

function testIDOf(scenario: (typeof OUTCOMES)[number]['scenario']): string {
  switch (scenario) {
    case 'denied':
      return 'microphone-denied';
    case 'failed':
      return 'failed';
    default:
      return 'not-found';
  }
}

describe('listen again', () => {
  it('after nothing found, listens again from nothing', async () => {
    await showScenario('nothing', { language: 'fr' });
    await fireEvent.press(screen.getByTestId('listening-not-found-action'));
    await wait(200);
    expect(screen.getByText('Récite ou fais écouter un passage')).toBeOnTheScreen();
    expect(screen.queryByTestId('listening-not-found')).toBeNull();
  });
});

describe('on an iPhone', () => {
  it.each(['listening', 'found', 'several', 'nothing', 'denied', 'failed'] as const)(
    '%s: no React Native view is left inside SwiftUI',
    async (scenario) => {
      setDeviceConditions({ os: 'ios' });
      await showLanguage('fr');
      jest.useFakeTimers();
      await renderOnIOS(screenFor(createScenarioEngine(scenario)));
      await wait(scenario === 'listening' ? 500 : WHOLE_SCENARIO_MS);
      expect(reactNativeViewsInsideSwiftUI()).toEqual([]);
    },
  );
});
