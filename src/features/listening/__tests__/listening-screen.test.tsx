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
import { appColors, highContrastAppColors } from '@/ui/tokens';
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
import { loadQuranVerseIndex } from '../verse-index-source';

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

    it(`${label(conditions)}: drawn on paper with the app's colours, the heart in high-contrast water`, async () => {
      await showScenario('listening', conditions, 500);
      const { scheme } = conditions;
      const appearance = scheme === 'dark' ? 'dark' : 'light';
      expect(styleOf(screen.getByTestId('listening')).backgroundColor).toBe(
        appColors.paper[appearance],
      );
      expect(strokeOf('rosette-heart')).toEqual(brush(highContrastAppColors.accent[appearance]));
      expect(strokeOf('rosette-outer')).toEqual(brush(appColors.accent[appearance]));
      expect(strokeOf('rosette-inside')).toEqual(brush(appColors.ornament[appearance]));
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

describe.each(MATRIX)(
  'passage found ($language, $scheme, reduced motion: $reducedMotion)',
  (conditions) => {
    it(`${label(conditions)}: the surah, the verse, the page, and the reader one press away`, async () => {
      await showScenario('found', conditions);
      const isArabic = conditions.language === 'ar';
      const title = isArabic ? 'تم التعرّف على المقطع' : 'Passage reconnu';
      expect(screen.getByRole('header', { name: title })).toBeOnTheScreen();
      // The surah's name as the data layer gives it.
      const surah = quranStructure.surah(2);
      expect(
        screen.getByText(
          isArabic ? `سورة ${surah.nameArabic}` : `Sourate ${surah.nameTransliterated}`,
        ),
      ).toBeOnTheScreen();
      expect(screen.getByText(isArabic ? 'الآية 255' : 'Verset 255')).toBeOnTheScreen();
      const page = quranStructure.pageOfVerse({ surah: 2, verse: 255 });
      await fireEvent.press(
        screen.getByRole('button', {
          name: isArabic ? `افتح الصفحة ${page}` : `Ouvrir à la page ${page}`,
        }),
      );
      expect(actions.onOpenPage).toHaveBeenCalledWith(page);
      expect(screen.queryByTestId('rosette', HIDDEN)).toBeNull();
    });
  },
);

describe.each(MATRIX)(
  'several passages ($language, $scheme, reduced motion: $reducedMotion)',
  (conditions) => {
    it(`${label(conditions)}: every place, in the order of the mushaf, each opening its page`, async () => {
      await showScenario('several', conditions);
      const isArabic = conditions.language === 'ar';
      expect(
        screen.getByRole('header', { name: isArabic ? 'عدة مقاطع' : 'Plusieurs passages' }),
      ).toBeOnTheScreen();
      const surahs = [1, 6, 10, 37, 39, 40].map((surah) => quranStructure.surah(surah));
      const names = surahs.map((surah) =>
        isArabic ? `سورة ${surah.nameArabic}` : `Sourate ${surah.nameTransliterated}`,
      );
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
      expect(
        screen.getByRole('button', { name: TEXT[language(conditions)].again }),
      ).toBeOnTheScreen();
    });
  },
);

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
    fr: 'Le micro est coupé',
    ar: 'الميكروفون مغلق',
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
    expect(screen.getByText(outcome[lang])).toBeOnTheScreen();
    const action = screen.getByRole('button', { name: outcome.action[lang] });
    expect(screen.getByRole('button', { name: TEXT[lang].close })).toBeOnTheScreen();
    expect(touchTargetHeight(action)).toBeGreaterThanOrEqual(44);
    await fireEvent.press(action);
    if (outcome.scenario === 'denied') expect(actions.onOpenSettings).toHaveBeenCalledTimes(1);
  });
});

describe('listen again', () => {
  it('after nothing found, listens again from nothing', async () => {
    await showScenario('nothing', { language: 'fr' });
    await fireEvent.press(screen.getByRole('button', { name: 'Écouter à nouveau' }));
    await wait(200);
    expect(screen.getByRole('header', { name: 'À l’écoute…' })).toBeOnTheScreen();
  });
});

describe('on an iPhone', () => {
  it.each(['listening', 'found', 'several', 'nothing', 'denied'] as const)(
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
