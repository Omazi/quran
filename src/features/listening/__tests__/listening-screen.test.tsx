import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, processColor } from 'react-native';

import { quranStructure } from '@/data/quran';
import type { SpeechEngine } from '@/domain/listening';
import type { VerseIndex } from '@/domain/recognition';
import {
  reactNativeViewsInsideSwiftUI,
  SCREEN_CONDITIONS,
  showLanguage,
  type ScreenConditions,
} from '@/features/garden/test-support/screen-conditions';
import { appColors, palette } from '@/ui/tokens';
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

function screenFor(engine: SpeechEngine) {
  return (
    <ListeningScreen
      engine={engine}
      loadVerseIndex={() => Promise.resolve(index)}
      structure={quranStructure}
      loadVerseText={loadQuranVerseText}
      {...actions}
    />
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

/** The rosette is hidden from screen readers: the queries must ask for it. */
const HIDDEN = { includeHiddenElements: true };

const MOTION = [false, true] as const;
const MATRIX = SCREEN_CONDITIONS.flatMap((conditions) =>
  MOTION.map((reducedMotion) => ({ ...conditions, reducedMotion })),
);
const label = ({ language, scheme, reducedMotion }: (typeof MATRIX)[number]) =>
  `${language}, ${scheme}, ${reducedMotion ? 'reduced motion' : 'motion'}`;

const TEXT = {
  fr: { title: 'À l’écoute…', stop: 'Arrêter', again: 'Écouter à nouveau', close: 'Fermer' },
  ar: { title: 'جارٍ الاستماع…', stop: 'إيقاف', again: 'استمع مجددًا', close: 'إغلاق' },
} as const;

/** A colour as react-native-svg hands it to the native side. */
function brush(color: string) {
  return { type: 0, payload: processColor(color) };
}

function strokeOf(testID: string): unknown {
  const path = withDescendants(screen.getByTestId(testID, HIDDEN)).find(
    (element) => element.props.stroke !== undefined,
  );
  return path?.props.stroke;
}

function language(conditions: ScreenConditions): 'fr' | 'ar' {
  return conditions.language === 'ar' ? 'ar' : 'fr';
}

describe.each(MATRIX)(
  'listening ($language, $scheme, reduced motion: $reducedMotion)',
  (conditions) => {
    const text = TEXT[language(conditions)];

    it(`${label(conditions)}: the rosette, the title and one button to stop`, async () => {
      await showScenario('listening', conditions, 3000);
      expect(screen.getByRole('header', { name: text.title })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: text.stop })).toBeOnTheScreen();
      expect(screen.getByTestId('rosette-heart', HIDDEN)).toBeOnTheScreen();
      expect(screen.getByTestId('rosette-outer', HIDDEN)).toBeOnTheScreen();
      expect(screen.getByTestId('rosette-inside', HIDDEN)).toBeOnTheScreen();
      // Reduced motion: no petal leaves (D29).
      expect(screen.queryByTestId('rosette-petals', HIDDEN) === null).toBe(
        conditions.reducedMotion,
      );
      // The light on the lines and the points at the tips belong to the night only.
      const isNight = conditions.scheme === 'dark';
      expect(screen.queryByTestId('rosette-glow', HIDDEN) !== null).toBe(isNight);
      expect(screen.queryByTestId('rosette-nodes', HIDDEN) !== null).toBe(isNight);
    });

    it(`${label(conditions)}: the title is the display title, 36 points, regular, as a heading`, async () => {
      await showScenario('listening', conditions, 500);
      const title = screen.getByRole('header');
      expect(styleOf(title)).toMatchObject({ fontSize: 36, fontWeight: '400' });
      expect(title.props.dynamicTypeRamp).toBe('largeTitle');
    });

    it(`${label(conditions)}: drawn on paper with the app's colours, the heart in high-contrast water`, async () => {
      await showScenario('listening', conditions, 500);
      const { scheme } = conditions;
      const appearance = scheme === 'dark' ? 'dark' : 'light';
      expect(styleOf(screen.getByTestId('listening')).backgroundColor).toBe(
        appColors.paper[appearance],
      );
      expect(strokeOf('rosette-heart')).toEqual(brush(appColors.accentStrong[appearance]));
      expect(strokeOf('rosette-outer')).toEqual(brush(appColors.accent[appearance]));
      expect(strokeOf('rosette-inside')).toEqual(brush(appColors.ornamentLine[appearance]));
    });
  },
);

describe('listening, for everyone', () => {
  it('the rosette is an ornament: screen readers never reach it', async () => {
    await showScenario('listening', SCREEN_CONDITIONS[0] ?? { language: 'fr' }, 500);
    const rosette = screen.getByTestId('rosette', HIDDEN);
    expect(rosette.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(rosette.props.accessibilityElementsHidden).toBe(true);
  });

  it('announces that it listens, then the passage it found', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await showScenario('found', { language: 'fr' });
    expect(announce).toHaveBeenCalledWith('À l’écoute');
    expect(announce).toHaveBeenLastCalledWith('Passage reconnu : Sourate Al-Baqarah, Verset 255');
  });

  it('the stop button is a 44-point target, and nothing is placed by a physical side', async () => {
    await showScenario('listening', { language: 'ar', rightToLeft: true }, 500);
    expect(touchTargetHeight(screen.getByTestId('listening-stop'))).toBeGreaterThanOrEqual(44);
    expect(directionDependentStyles(screen.getByTestId('listening'))).toEqual([]);
  });

  it('closes the screen when the person stops before a word', async () => {
    await showScenario('listening', { language: 'fr' }, 500);
    await fireEvent.press(screen.getByRole('button', { name: 'Arrêter' }));
    await wait(100);
    expect(actions.onClose).toHaveBeenCalledTimes(1);
  });
});

/** A surah's name as the screen prints it: the data's, with a typographic apostrophe. */
function printedName(surah: number, isArabic: boolean): string {
  const info = quranStructure.surah(surah);
  return isArabic
    ? `سورة ${info.nameArabic}`
    : `Sourate ${info.nameTransliterated.replace(/'/g, '\u2019')}`;
}

/** Whether a button is the prominent one: its label is drawn on the accent. */
function isProminent(name: string, conditions: ScreenConditions): boolean {
  const appearance = conditions.scheme === 'dark' ? 'dark' : 'light';
  return styleOf(screen.getByText(name)).color === palette.onAction[appearance];
}

describe.each(MATRIX)(
  'passage found ($language, $scheme, reduced motion: $reducedMotion)',
  (conditions) => {
    it(`${label(conditions)}: the surah, the verse, the page, and the reader one press away`, async () => {
      await showScenario('found', conditions);
      const isArabic = conditions.language === 'ar';
      // The surah's name is the title, in the language of the interface.
      expect(screen.getByRole('header', { name: printedName(2, isArabic) })).toBeOnTheScreen();
      const page = quranStructure.pageOfVerse({ surah: 2, verse: 255 });
      expect(
        screen.getByText(isArabic ? `الآية 255 · الصفحة ${page}` : `Verset 255 · Page ${page}`),
      ).toBeOnTheScreen();
      const open = isArabic ? `افتح الصفحة ${page}` : `Ouvrir à la page ${page}`;
      await fireEvent.press(screen.getByRole('button', { name: open }));
      expect(actions.onOpenPage).toHaveBeenCalledWith(page);
      // The listening rosette has stopped; the still one stays, on the same paper.
      expect(screen.queryByTestId('rosette', HIDDEN)).toBeNull();
      expect(screen.getByTestId('still-rosette', HIDDEN)).toBeOnTheScreen();
      const appearance = conditions.scheme === 'dark' ? 'dark' : 'light';
      expect(styleOf(screen.getByTestId('listening-found')).backgroundColor).toBe(
        appColors.paper[appearance],
      );
      // One prominent button: opening the page. Listening again and closing are plain.
      const text = TEXT[language(conditions)];
      expect(isProminent(open, conditions)).toBe(true);
      expect(isProminent(text.again, conditions)).toBe(false);
      expect(isProminent(text.close, conditions)).toBe(false);
      // The content fades into the band of buttons instead of being sliced by it, and the fade
      // never takes a touch nor a screen reader's attention.
      const fade = screen.getByTestId('scroll-edge-fade', HIDDEN);
      expect(fade.props.pointerEvents).toBe('none');
    });
  },
);

describe('passage found, the verse', () => {
  it('is shown exactly as the data layer gives it, in the Quran font, with its verse mark', async () => {
    await showScenario('found', { language: 'fr' });
    const verse = await loadQuranVerseText({ surah: 2, verse: 255 });
    const block = screen.getByTestId('listening-verses');
    const quran = withDescendants(block).find(
      (element) => element.type === 'Text' && styleOf(element).fontFamily === 'KFGQPCHafsUthmanic',
    );
    expect(quran).toBeDefined();
    const runs = withDescendants(quran as RenderedElement)
      .filter((element) => element.type === 'Text' && typeof element.props.children === 'string')
      .map((element) => element.props.children as string);
    expect(runs).toEqual([verse, ' ٢٥٥']);
    expect(quran?.props.accessibilityLanguage).toBe('ar');
  });

  it('in Arabic, the surah is named once, in the Quran’s script, as a heading', async () => {
    await showScenario('found', { language: 'ar', rightToLeft: true });
    const heading = screen.getByRole('header', { name: printedName(2, true) });
    expect(styleOf(heading).fontFamily).toBe('Amiri_700Bold');
    expect(screen.getAllByText(printedName(2, true))).toHaveLength(1);
  });

  it('in French, the Arabic name stands above the display title', async () => {
    await showScenario('found', { language: 'fr' });
    expect(styleOf(screen.getByTestId('listening-surah-arabic')).fontFamily).toBe('Amiri_700Bold');
    const title = screen.getByRole('header', { name: printedName(2, false) });
    expect(styleOf(title)).toMatchObject({ fontSize: 36, fontWeight: '400' });
  });
});

describe.each(MATRIX)(
  'several passages ($language, $scheme, reduced motion: $reducedMotion)',
  (conditions) => {
    it(`${label(conditions)}: every place, in the order of the mushaf, each opening its page`, async () => {
      await showScenario('several', conditions);
      const isArabic = conditions.language === 'ar';
      expect(
        screen.getByRole('header', { name: isArabic ? 'عدة مقاطع' : 'Plusieurs passages' }),
      ).toBeOnTheScreen();
      const names = [1, 6, 10, 37, 39, 40].map((surah) => printedName(surah, isArabic));
      const rows = screen
        .getAllByRole('button')
        .filter((button) =>
          names.some(
            (name) =>
              (button.props.accessibilityLabel ?? '').includes(name) || hasText(button, name),
          ),
        );
      expect(rows).toHaveLength(6);
      const firstPage = quranStructure.pageOfVerse({ surah: 1, verse: 2 });
      await fireEvent.press(rows[0] as RenderedElement);
      expect(actions.onOpenPage).toHaveBeenCalledWith(firstPage);
      // Choosing a place is the next step: no prominent button.
      const text = TEXT[language(conditions)];
      expect(isProminent(text.again, conditions)).toBe(false);
      expect(isProminent(text.close, conditions)).toBe(false);
      expect(screen.getByTestId('still-rosette', HIDDEN)).toBeOnTheScreen();
      expect(screen.getByTestId('scroll-edge-fade', HIDDEN)).toBeOnTheScreen();
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
    expect(row.props.accessibilityLabel).toBe('Sourate Al-An’am, Verset 45 · Page 133');
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
    // The listening screen at rest: its paper, its rosette, still, and its display title.
    const title = screen.getByRole('header', { name: outcome[lang] });
    expect(styleOf(title)).toMatchObject({ fontSize: 36, fontWeight: '400' });
    expect(screen.getByTestId('still-rosette', HIDDEN)).toBeOnTheScreen();
    expect(screen.queryByTestId('rosette', HIDDEN)).toBeNull();
    const appearance = conditions.scheme === 'dark' ? 'dark' : 'light';
    expect(
      styleOf(screen.getByTestId(`listening-${testIDOf(outcome.scenario)}`)).backgroundColor,
    ).toBe(appColors.paper[appearance]);
    const action = screen.getByRole('button', { name: outcome.action[lang] });
    expect(screen.getByRole('button', { name: TEXT[lang].close })).toBeOnTheScreen();
    // The one next step is prominent, closing is plain.
    expect(isProminent(outcome.action[lang], conditions)).toBe(true);
    expect(isProminent(TEXT[lang].close, conditions)).toBe(false);
    expect(touchTargetHeight(action)).toBeGreaterThanOrEqual(44);
    await fireEvent.press(action);
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
    await fireEvent.press(screen.getByRole('button', { name: 'Écouter à nouveau' }));
    await wait(200);
    expect(screen.getByRole('header', { name: 'À l’écoute…' })).toBeOnTheScreen();
  });
});

describe('on an iPhone', () => {
  it.each(['listening', 'found', 'several', 'nothing', 'denied', 'failed'] as const)(
    '%s: every system view has a host, and no React Native view is left inside SwiftUI',
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
