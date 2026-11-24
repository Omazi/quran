import { render, renderHook, screen } from '@testing-library/react-native';

import {
  DEFAULT_GARDEN_CONFIG,
  GARDEN_CATALOG,
  TREE_SPECIES_CYCLE,
  type GardenPhase,
  type GardenState,
  type WaterState,
} from '@/domain/garden';
import { GroupedList, ListSection, useColors } from '@/ui';
import {
  directionDependentStyles,
  fixedHeightsAroundText,
  LARGEST_FONT_SCALE,
  renderOnIOS,
  resetDeviceConditions,
  setDeviceConditions,
  styleOf,
  withDescendants,
} from '@/ui/test-support/environment';

import arGarden from '../../../i18n/locales/ar/garden.json';
import enGarden from '../../../i18n/locales/en/garden.json';
import frGarden from '../../../i18n/locales/fr/garden.json';
import { GARDEN_SCENE_BAND_MIN_HEIGHT } from '../config';
import { previewGardenState } from '../garden-preview';
import { GardenElementsSection, GardenStateSection, GardenWaterRow } from '../garden-readout';
import { GardenScene } from '../garden-scene';
import {
  reactNativeViewsInsideSwiftUI,
  SCREEN_CONDITIONS,
  showLanguage,
} from '../test-support/screen-conditions';

afterEach(resetDeviceConditions);

const { thirstyMinDroughtDays, wiltingMinDroughtDays, dyingMinDroughtDays, droughtDaysToDeath } =
  DEFAULT_GARDEN_CONFIG;

const thriving = previewGardenState({ hizbCompleted: 24 });
const bare = previewGardenState({ hizbCompleted: 0 });
const complete = previewGardenState({ hizbCompleted: 60 });
const after = (daysWithoutReading: number): GardenState =>
  previewGardenState({ hizbCompleted: 24, daysWithoutReading });

function Readout({ state }: { state: GardenState }) {
  return (
    <GroupedList>
      <ListSection>
        <GardenWaterRow state={state} />
      </ListSection>
      <GardenStateSection state={state} />
      <GardenElementsSection state={state} />
    </GroupedList>
  );
}

describe('GardenScene', () => {
  it('is a named placeholder whose label says the state in words', async () => {
    await showLanguage('fr');
    await render(<GardenScene state={thriving} size="band" />);
    const scene = screen.getByRole('image', { name: 'Jardin, 24 hizb sur 60, l’eau coule' });
    expect(scene).toBeOnTheScreen();
    expect(screen.getByText('Jardin au hizb 24')).toBeOnTheScreen();
  });

  const frenchScenes: readonly (readonly [string, GardenState, string, string])[] = [
    ['bare earth', bare, 'Terre nue', 'Terre nue, aucun hizb terminé'],
    [
      'thirsty',
      after(thirstyMinDroughtDays),
      'Jardin au hizb 24, assoiffé',
      'Jardin assoiffé, 24 hizb sur 60, l’eau est à sec',
    ],
    [
      'wilting',
      after(wiltingMinDroughtDays),
      'Jardin au hizb 24, fané',
      'Jardin fané, 24 hizb sur 60, l’eau est à sec',
    ],
    [
      'dying',
      after(dyingMinDroughtDays),
      'Jardin au hizb 24, mourant',
      'Jardin mourant, 24 hizb sur 60, l’eau est à sec',
    ],
    [
      'dead',
      after(droughtDaysToDeath),
      'Terre morte',
      'Terre morte, 24 hizb sur 60 acquis, l’eau est à sec',
    ],
    ['complete', complete, 'Jardin complet', 'Jardin complet, 60 hizb sur 60, l’eau coule'],
  ];

  it.each(frenchScenes)('names the %s garden', async (_, state, name, label) => {
    await showLanguage('fr');
    await render(<GardenScene state={state} size="band" />);
    expect(screen.getByRole('image', { name: label })).toBeOnTheScreen();
    expect(screen.getByText(name)).toBeOnTheScreen();
  });

  it('names a complete garden that dries by its phase, not as complete', async () => {
    await showLanguage('fr');
    // Written by hand: the wording must hold whatever the garden module decides for 60 hizb.
    const state: GardenState = {
      ...complete,
      phase: 'thirsty',
      water: 'dry',
      daysSinceLastWatered: 4,
    };
    await render(<GardenScene state={state} size="fill" />);
    expect(screen.getByText('Jardin au hizb 60, assoiffé')).toBeOnTheScreen();
  });

  it('takes a band of minimum height, or all the space of its parent', async () => {
    await showLanguage('fr');
    const band = await render(<GardenScene state={thriving} size="band" />);
    expect(styleOf(screen.getByTestId('garden-scene'))).toMatchObject({
      alignSelf: 'stretch',
      minHeight: GARDEN_SCENE_BAND_MIN_HEIGHT,
    });
    // A minimum, never a fixed height: the name can wrap at the largest text sizes.
    expect(styleOf(screen.getByTestId('garden-scene')).height).toBeUndefined();
    await band.unmount();
    await render(<GardenScene state={thriving} size="fill" />);
    expect(styleOf(screen.getByTestId('garden-scene'))).toMatchObject({ flex: 1 });
  });

  it('draws nothing: one named surface, no image and no drawing', async () => {
    await showLanguage('fr');
    await render(<GardenScene state={thriving} size="band" />);
    const scene = screen.getByTestId('garden-scene');
    const drawn = scene.queryAll(
      ({ type }) => typeof type === 'string' && /image|svg|path|canvas/i.test(type),
    );
    expect(drawn).toHaveLength(0);
  });
});

describe('the garden in words', () => {
  it.each(SCREEN_CONDITIONS)(
    'shows the rules of a thirsty garden ($scheme, $language)',
    async ({ language, ...device }) => {
      setDeviceConditions(device);
      const i18n = await showLanguage(language);
      const t = i18n.getFixedT(language, 'garden');
      const state = after(thirstyMinDroughtDays);
      await render(<Readout state={state} />);

      // Water: a symbol and words. Hizb and health: gauges with their value in words.
      expect(screen.getByText(t('water.status.dry'))).toBeOnTheScreen();
      const hizb = screen.getByRole('progressbar', { name: t('readout.hizb.label') });
      expect(hizb).toHaveAccessibilityValue({
        text: t('readout.hizb.value', { hizb: 24, total: 60 }),
      });
      const health = screen.getByRole('progressbar', { name: t('readout.health.label') });
      expect(health).toHaveAccessibilityValue({
        text: t('readout.health.value', { state: t('states.thirsty'), percent: 79 }),
      });
      // Next element and its growth, last element earned.
      expect(screen.getByTestId('garden-next-element')).toHaveTextContent(
        new RegExp(t('kinds.orange')),
      );
      expect(screen.getByTestId('garden-last-element')).toHaveTextContent(
        new RegExp(t('kinds.springs')),
      );
      expect(directionDependentStyles(screen.container)).toEqual([]);
      expect(fixedHeightsAroundText(screen.container)).toEqual([]);
    },
  );

  const waterWords: readonly (readonly [WaterState, GardenState, string])[] = [
    ['flowing', thriving, 'L’eau coule'],
    ['still', after(1), 'L’eau est immobile'],
    ['dry', after(thirstyMinDroughtDays), 'L’eau est à sec'],
  ];

  it.each(waterWords)('says in words that the water is %s', async (water, state, words) => {
    await showLanguage('fr');
    expect(state.water).toBe(water);
    await render(<Readout state={state} />);
    expect(screen.getByTestId('garden-water')).toHaveTextContent(words);
  });

  it('does not call the bare earth dry: there is no water yet, and no health to show', async () => {
    await showLanguage('fr');
    await render(<Readout state={bare} />);
    expect(screen.getByTestId('garden-water')).toHaveTextContent('Pas encore d’eau');
    expect(screen.queryByRole('progressbar', { name: 'Santé' })).toBeNull();
    expect(screen.getByRole('progressbar', { name: 'Hizb terminés' })).toHaveAccessibilityValue({
      text: '0 hizb sur 60',
    });
    expect(screen.getByTestId('garden-next-element')).toHaveTextContent(/Canaux, 0\s%/);
    expect(screen.queryByTestId('garden-last-element')).toBeNull();
  });

  const healthWords: readonly (readonly [GardenPhase, GardenState, string])[] = [
    ['thriving', thriving, 'Florissant, 100\u00a0%'],
    ['thirsty', after(thirstyMinDroughtDays), 'Assoiffé, 79\u00a0%'],
    ['wilting', after(wiltingMinDroughtDays), 'Fané, 57\u00a0%'],
    ['dying', after(dyingMinDroughtDays), 'Mourant, 29\u00a0%'],
    ['dead', after(droughtDaysToDeath), 'Terre morte, 0\u00a0%'],
  ];

  it.each(healthWords)('writes the %s phase beside the health gauge', async (_, state, words) => {
    await showLanguage('fr');
    await render(<Readout state={state} />);
    expect(screen.getByRole('progressbar', { name: 'Santé' })).toHaveAccessibilityValue({
      text: words,
    });
  });

  it('names a drought day that was watered by the water that came back, not by the drought', async () => {
    await showLanguage('fr');
    const revived = previewGardenState({
      hizbCompleted: 24,
      daysWithoutReading: droughtDaysToDeath,
      readsToday: true,
    });
    // The garden module still counts a drought that day; the words do not call it dying.
    expect(revived.phase).toBe('dying');
    await render(
      <>
        <GardenScene state={revived} size="band" />
        <Readout state={revived} />
      </>,
    );
    expect(screen.getByText('Jardin au hizb 24, ranimé')).toBeOnTheScreen();
    expect(
      screen.getByRole('image', { name: 'Jardin ranimé, 24 hizb sur 60, l’eau coule' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('progressbar', { name: 'Santé' })).toHaveAccessibilityValue({
      text: 'Ranimé, 21\u00a0%',
    });
    expect(screen.queryByText(/mourant/i)).toBeNull();
  });

  it('gives each gauge its own colour: green for what grew, water or thirst for health', async () => {
    setDeviceConditions({ os: 'android' });
    await showLanguage('fr');
    const { result: colors } = await renderHook(() => useColors());
    const fillOf = (name: string) =>
      withDescendants(screen.getByRole('progressbar', { name })).map(
        (element) => styleOf(element).backgroundColor,
      );
    const fine = await render(<Readout state={thriving} />);
    expect(fillOf('Hizb terminés')).toContain(colors.current.growth);
    expect(fillOf('Santé')).toContain(colors.current.accent);
    expect(fillOf('Santé')).not.toContain(colors.current.growth);
    await fine.unmount();
    await render(<Readout state={after(thirstyMinDroughtDays)} />);
    expect(fillOf('Hizb terminés')).toContain(colors.current.growth);
    expect(fillOf('Santé')).toContain(colors.current.warning);
  });

  it('says how many elements a dying garden still shows, and only then', async () => {
    await showLanguage('fr');
    const dying = await render(<Readout state={after(dyingMinDroughtDays)} />);
    expect(screen.getByTestId('garden-visible-elements')).toHaveTextContent(/20 sur 24/);
    await dying.unmount();
    await render(<Readout state={after(wiltingMinDroughtDays)} />);
    expect(screen.queryByTestId('garden-visible-elements')).toBeNull();
  });

  it('shows the last element of a complete garden and no next element', async () => {
    await showLanguage('fr');
    await render(<Readout state={complete} />);
    expect(screen.queryByTestId('garden-next-element')).toBeNull();
    expect(screen.getByTestId('garden-last-element')).toHaveTextContent(/Pleine floraison/);
  });

  it('shows a verse only when the garden module says it may be displayed', async () => {
    await showLanguage('fr');
    // Today no verse is validated: the element earned at hizb 24 has one, and it stays hidden.
    expect(thriving.lastUnlocked?.verse?.validatedByTeacher).toBe(false);
    const hidden = await render(<Readout state={thriving} />);
    expect(screen.queryByTestId('garden-verse')).toBeNull();
    await hidden.unmount();

    const lastUnlocked = thriving.lastUnlocked;
    if (lastUnlocked?.verse === undefined)
      throw new Error('The test needs an element with a verse.');
    const validated: GardenState = {
      ...thriving,
      lastUnlocked: { ...lastUnlocked, verse: { ...lastUnlocked.verse, validatedByTeacher: true } },
    };
    await render(<Readout state={validated} />);
    expect(screen.getByTestId('garden-verse')).toHaveTextContent(/Sourate 55, verset 66/);
  });

  it('says when the garden is paused today', async () => {
    await showLanguage('fr');
    await render(<Readout state={{ ...thriving, isPausedToday: true }} />);
    expect(screen.getByTestId('garden-pause')).toHaveTextContent(/En pause aujourd’hui/);
  });

  it('keeps its words whole at the largest text size', async () => {
    setDeviceConditions({ fontScale: LARGEST_FONT_SCALE });
    await showLanguage('fr');
    await render(<Readout state={after(dyingMinDroughtDays)} />);
    expect(fixedHeightsAroundText(screen.container)).toEqual([]);
    const cutTexts = screen.container.queryAll(
      ({ type, props }) => type === 'Text' && props.numberOfLines !== undefined,
    );
    expect(cutTexts).toHaveLength(0);
  });

  it('is made of system components an iPhone can display', async () => {
    await showLanguage('fr');
    await renderOnIOS(<Readout state={after(dyingMinDroughtDays)} />);
    expect(reactNativeViewsInsideSwiftUI()).toEqual([]);
  });
});

describe('the garden locale files', () => {
  const locales = { fr: frGarden, en: enGarden, ar: arGarden };

  function keysOf(value: unknown, prefix = ''): string[] {
    if (typeof value !== 'object' || value === null) return [prefix];
    return Object.entries(value).flatMap(([key, child]) =>
      keysOf(child, prefix === '' ? key : `${prefix}.${key}`),
    );
  }

  it('have the same keys in French, English and Arabic', () => {
    expect(keysOf(locales.en)).toEqual(keysOf(locales.fr));
    expect(keysOf(locales.ar)).toEqual(keysOf(locales.fr));
  });

  it.each(Object.entries(locales))('name every kind of element in %s', (_, locale) => {
    const kinds = new Set([
      ...GARDEN_CATALOG.map((element) => element.kind),
      ...TREE_SPECIES_CYCLE,
    ]);
    const names: Record<string, string> = locale.kinds;
    for (const kind of kinds) expect(names[kind]).toEqual(expect.stringMatching(/\S/));
    // Kinds are translated, never the 60 ids.
    expect(Object.keys(names).sort()).toEqual([...kinds].sort());
  });

  it.each(Object.entries(locales))('leave no text empty in %s', (_, locale) => {
    const texts = JSON.stringify(locale).match(/:"[^"]*"/g) ?? [];
    expect(texts.filter((text) => text === ':""')).toEqual([]);
  });
});
