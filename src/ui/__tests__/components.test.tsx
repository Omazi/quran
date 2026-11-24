import { render, renderHook, screen } from '@testing-library/react-native';
import { DynamicColorIOS, PlatformColor } from 'react-native';

import { AppText } from '../components/app-text';
import { Placeholder } from '../components/placeholder';
import { Screen } from '../components/screen';
import {
  APPEARANCES_AND_DIRECTIONS,
  directionDependentStyles,
  fixedHeightsAroundText,
  LARGEST_FONT_SCALE,
  resetDeviceConditions,
  setDeviceConditions,
  styleOf,
} from '../test-support/environment';
import {
  appColors,
  appleTextStyles,
  fallbackSystemColors,
  iosSystemColorNames,
  textStyles,
  type TextStyleName,
} from '../tokens';
import { useColors } from '../use-colors';

afterEach(resetDeviceConditions);

describe('useColors', () => {
  it('returns the system dynamic colours on iOS, by name', async () => {
    setDeviceConditions({ os: 'ios' });
    const { result } = await renderHook(() => useColors());
    for (const [role, name] of Object.entries(iosSystemColorNames)) {
      expect(result.current).toHaveProperty(role, PlatformColor(name));
    }
  });

  it('returns the app colours on iOS as dynamic light and dark pairs', async () => {
    setDeviceConditions({ os: 'ios' });
    const { result } = await renderHook(() => useColors());
    for (const [role, pair] of Object.entries(appColors)) {
      expect(result.current).toHaveProperty(role, DynamicColorIOS(pair));
    }
  });

  it('returns the same colours on iOS in both appearances: the system resolves them', async () => {
    setDeviceConditions({ os: 'ios', scheme: 'light' });
    const light = (await renderHook(() => useColors())).result.current;
    setDeviceConditions({ os: 'ios', scheme: 'dark' });
    const dark = (await renderHook(() => useColors())).result.current;
    expect(dark).toBe(light);
  });

  it.each(['light', 'dark'] as const)(
    'follows the device theme outside iOS: %s',
    async (scheme) => {
      setDeviceConditions({ os: 'android', scheme });
      const { result } = await renderHook(() => useColors());
      expect(result.current.background).toBe(fallbackSystemColors.background[scheme]);
      expect(result.current.label).toBe(fallbackSystemColors.label[scheme]);
      expect(result.current.accent).toBe(appColors.accent[scheme]);
      expect(result.current.paper).toBe(appColors.paper[scheme]);
    },
  );

  it('covers every role on both kinds of platform', async () => {
    const roles = [...Object.keys(iosSystemColorNames), ...Object.keys(appColors)].sort();
    setDeviceConditions({ os: 'ios' });
    expect(Object.keys((await renderHook(() => useColors())).result.current).sort()).toEqual(roles);
    setDeviceConditions({ os: 'android' });
    expect(Object.keys((await renderHook(() => useColors())).result.current).sort()).toEqual(roles);
  });
});

describe('AppText', () => {
  const variants = Object.keys(textStyles) as TextStyleName[];

  it.each(variants)('%s uses its text style and its Dynamic Type ramp', async (variant) => {
    setDeviceConditions();
    await render(<AppText variant={variant}>Lis, et l’eau coule.</AppText>);
    const text = screen.getByText('Lis, et l’eau coule.');
    expect(styleOf(text)).toMatchObject(textStyles[variant]);
    expect(text).toHaveProp('dynamicTypeRamp', appleTextStyles[variant]);
  });

  it('is body text in the primary label colour by default', async () => {
    setDeviceConditions();
    await render(<AppText>Texte</AppText>);
    const text = screen.getByText('Texte');
    expect(styleOf(text)).toMatchObject(textStyles.body);
    expect(styleOf(text).color).toEqual(PlatformColor('label'));
  });

  it('never switches off or caps the text size setting', async () => {
    setDeviceConditions({ fontScale: LARGEST_FONT_SCALE });
    await render(<AppText variant="footnote">Note</AppText>);
    const text = screen.getByText('Note');
    expect(text.props.allowFontScaling).not.toBe(false);
    expect(text.props.maxFontSizeMultiplier).toBeUndefined();
    expect(text.props.numberOfLines).toBeUndefined();
  });

  it('aligns with the writing direction by default, never with a physical side', async () => {
    setDeviceConditions({ rightToLeft: true });
    await render(<AppText>بسم الله</AppText>);
    expect(styleOf(screen.getByText('بسم الله')).textAlign).toBe('start');
    expect(directionDependentStyles(screen.container)).toEqual([]);
  });

  it.each(['center', 'end'] as const)('can be aligned to %s', async (align) => {
    setDeviceConditions();
    await render(<AppText align={align}>Texte</AppText>);
    expect(styleOf(screen.getByText('Texte')).textAlign).toBe(align);
  });

  it('announces the two title styles as headings', async () => {
    setDeviceConditions();
    await render(
      <>
        <AppText variant="largeTitle">Jardin</AppText>
        <AppText variant="title2">Ton objectif</AppText>
        <AppText>Texte</AppText>
      </>,
    );
    expect(screen.getAllByRole('header')).toHaveLength(2);
  });

  it('takes its colour from a role, in both themes outside iOS', async () => {
    setDeviceConditions({ os: 'android', scheme: 'dark' });
    await render(<AppText color="secondaryLabel">Texte</AppText>);
    expect(styleOf(screen.getByText('Texte')).color).toBe(fallbackSystemColors.secondaryLabel.dark);
  });

  it('does not let a style override the font, the size or the colour', async () => {
    setDeviceConditions();
    await render(
      <AppText style={{ fontSize: 9, color: 'red', fontFamily: 'Inter', marginTop: 8 }}>
        Texte
      </AppText>,
    );
    const style = styleOf(screen.getByText('Texte'));
    expect(style).toMatchObject({ ...textStyles.body, marginTop: 8 });
    expect(style.color).toEqual(PlatformColor('label'));
    expect(style.fontFamily).toBeUndefined();
  });
});

describe('Screen', () => {
  it.each(APPEARANCES_AND_DIRECTIONS)(
    'fills the window with the system background ($scheme, right to left: $rightToLeft)',
    async (conditions) => {
      setDeviceConditions(conditions);
      await render(
        <Screen testID="screen">
          <AppText>Contenu</AppText>
        </Screen>,
      );
      const style = styleOf(screen.getByTestId('screen'));
      expect(style.flex).toBe(1);
      expect(style.backgroundColor).toEqual(PlatformColor('systemBackground'));
      expect(directionDependentStyles(screen.container)).toEqual([]);
    },
  );

  it('keeps every safe-area edge clear unless told otherwise', async () => {
    setDeviceConditions();
    await render(
      <Screen testID="screen">
        <AppText>Contenu</AppText>
      </Screen>,
    );
    const allEdges = { top: 'additive', right: 'additive', bottom: 'additive', left: 'additive' };
    expect(screen.getByTestId('screen')).toHaveProp('edges', allEdges);
    await screen.rerender(
      <Screen testID="screen" edges={['top']}>
        <AppText>Contenu</AppText>
      </Screen>,
    );
    const topOnly = { top: 'additive', right: 'off', bottom: 'off', left: 'off' };
    expect(screen.getByTestId('screen')).toHaveProp('edges', topOnly);
  });

  it('uses the grouped background for a screen that shows a grouped list', async () => {
    setDeviceConditions();
    await render(
      <Screen testID="screen" background="groupedBackground">
        <AppText>Contenu</AppText>
      </Screen>,
    );
    expect(styleOf(screen.getByTestId('screen')).backgroundColor).toEqual(
      PlatformColor('systemGroupedBackground'),
    );
  });

  it('follows the device theme outside iOS', async () => {
    setDeviceConditions({ os: 'android', scheme: 'dark' });
    await render(
      <Screen testID="screen">
        <AppText>Contenu</AppText>
      </Screen>,
    );
    expect(styleOf(screen.getByTestId('screen')).backgroundColor).toBe(
      fallbackSystemColors.background.dark,
    );
  });

  it('lets its content scroll when asked, so that large text stays reachable', async () => {
    setDeviceConditions({ fontScale: LARGEST_FONT_SCALE });
    await render(
      <Screen scroll>
        <AppText>Contenu</AppText>
      </Screen>,
    );
    const scrollViews = screen.container.queryAll(({ type }) => type === 'RCTScrollView');
    expect(scrollViews).toHaveLength(1);
    expect(fixedHeightsAroundText(screen.container)).toEqual([]);
  });
});

describe('Placeholder', () => {
  it.each(APPEARANCES_AND_DIRECTIONS)(
    'is a named, neutral surface ($scheme, right to left: $rightToLeft)',
    async (conditions) => {
      setDeviceConditions(conditions);
      await render(<Placeholder name="Jardin au hizb 8" testID="garden" />);
      const surface = screen.getByRole('image', { name: 'Jardin au hizb 8' });
      expect(surface).toBe(screen.getByTestId('garden'));
      expect(screen.getByText('Jardin au hizb 8')).toBeOnTheScreen();
      expect(styleOf(surface).backgroundColor).toEqual(PlatformColor('secondarySystemBackground'));
      expect(styleOf(surface).borderColor).toEqual(PlatformColor('separator'));
      expect(directionDependentStyles(screen.container)).toEqual([]);
    },
  );

  it('can say more to a screen reader than it shows', async () => {
    setDeviceConditions();
    await render(
      <Placeholder name="Jardin" accessibilityLabel="Jardin, 24 hizb sur 60, l’eau coule" />,
    );
    expect(screen.getByLabelText('Jardin, 24 hizb sur 60, l’eau coule')).toBeOnTheScreen();
    expect(screen.getByText('Jardin')).toBeOnTheScreen();
  });

  it('draws nothing: one surface and its name', async () => {
    setDeviceConditions();
    await render(<Placeholder name="Jardin" />);
    const types = screen.container.queryAll(() => true).map(({ type }) => type);
    expect(types).toEqual(['View', 'Text']);
  });

  it('grows with its name at the largest text size', async () => {
    setDeviceConditions({ fontScale: LARGEST_FONT_SCALE });
    await render(<Placeholder name="Jardin au hizb 8" />);
    expect(fixedHeightsAroundText(screen.container)).toEqual([]);
    expect(screen.getByText('Jardin au hizb 8').props.allowFontScaling).not.toBe(false);
  });

  it('follows the device theme outside iOS', async () => {
    setDeviceConditions({ os: 'android', scheme: 'dark' });
    await render(<Placeholder name="Jardin" testID="garden" />);
    expect(styleOf(screen.getByTestId('garden')).backgroundColor).toBe(
      fallbackSystemColors.secondaryBackground.dark,
    );
  });
});
