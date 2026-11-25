import { render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, DynamicColorIOS, PlatformColor } from 'react-native';

import { AppText } from '../components/app-text';
import { Placeholder } from '../components/placeholder';
import { QrCode, qrCodeModules } from '../components/qr-code';
import { Screen } from '../components/screen';
import {
  APPEARANCES_AND_DIRECTIONS,
  changeHighContrast,
  changeReducedMotion,
  directionDependentStyles,
  fixedHeightsAroundText,
  iosAppColor,
  LARGEST_FONT_SCALE,
  resetDeviceConditions,
  setDeviceConditions,
  styleOf,
} from '../test-support/environment';
import {
  appColors,
  palette,
  appleTextStyles,
  fallbackSystemColors,
  highContrastAppColors,
  iosSystemColorNames,
  textStyles,
  type TextStyleName,
} from '../tokens';
import { useReducedMotion } from '../device-settings';
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

  it('returns the app colours on iOS as dynamic colours with the values of the charter', async () => {
    setDeviceConditions({ os: 'ios' });
    const { result } = await renderHook(() => useColors());
    expect(result.current.accent).toEqual(
      DynamicColorIOS({
        light: '#0E6B78',
        dark: '#5CC8D6',
        highContrastLight: '#0A4F59',
        highContrastDark: '#8FE0EA',
      }),
    );
    expect(result.current.growth).toEqual(
      DynamicColorIOS({
        light: '#1F6B4A',
        dark: '#63C794',
        highContrastLight: '#164F36',
        highContrastDark: '#8FE0B4',
      }),
    );
    expect(result.current.ornament).toEqual(
      DynamicColorIOS({
        light: '#8F611A',
        dark: '#D9A441',
        highContrastLight: '#6A470F',
        highContrastDark: '#EBC272',
      }),
    );
  });

  it('gives iOS no high-contrast value for the colours the charter does not list', async () => {
    setDeviceConditions({ os: 'ios' });
    const { result } = await renderHook(() => useColors());
    for (const role of ['onAccent', 'paper', 'ink'] as const) {
      expect(result.current[role]).toEqual(DynamicColorIOS(appColors[role]));
      expect(result.current[role]).toEqual(iosAppColor(role));
    }
  });

  it('leaves high contrast to the system on iOS: it never asks the device', async () => {
    setDeviceConditions({ os: 'ios', highContrast: true });
    const { result } = await renderHook(() => useColors());
    expect(result.current.accent).toEqual(iosAppColor('accent'));
    expect(AccessibilityInfo.isHighTextContrastEnabled).not.toHaveBeenCalled();
    expect(AccessibilityInfo.addEventListener).not.toHaveBeenCalled();
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

  it.each(['light', 'dark'] as const)(
    'takes the high-contrast values on Android when high contrast text is on: %s',
    async (scheme) => {
      setDeviceConditions({ os: 'android', scheme, highContrast: true });
      const { result } = await renderHook(() => useColors());
      await waitFor(() => {
        expect(result.current.accent).toBe(highContrastAppColors.accent[scheme]);
      });
      expect(result.current.growth).toBe(highContrastAppColors.growth[scheme]);
      expect(result.current.ornament).toBe(highContrastAppColors.ornament[scheme]);
      // The colours without a high-contrast value, and the system equivalents, do not change.
      expect(result.current.onAccent).toBe(appColors.onAccent[scheme]);
      expect(result.current.paper).toBe(appColors.paper[scheme]);
      expect(result.current.label).toBe(fallbackSystemColors.label[scheme]);
    },
  );

  it('follows the setting on Android when it changes while the app is open', async () => {
    setDeviceConditions({ os: 'android' });
    const { result } = await renderHook(() => useColors());
    expect(result.current.accent).toBe(appColors.accent.light);
    await changeHighContrast(true);
    expect(result.current.accent).toBe(highContrastAppColors.accent.light);
    await changeHighContrast(false);
    expect(result.current.accent).toBe(appColors.accent.light);
  });

  it('asks Android once, however many components read the colours, and stops when none does', async () => {
    setDeviceConditions({ os: 'android' });
    await render(
      <>
        <AppText>Un</AppText>
        <AppText>Deux</AppText>
        <Placeholder name="Trois" />
      </>,
    );
    expect(AccessibilityInfo.isHighTextContrastEnabled).toHaveBeenCalledTimes(1);
    expect(AccessibilityInfo.addEventListener).toHaveBeenCalledTimes(1);
    const subscription = jest.mocked(AccessibilityInfo.addEventListener).mock.results[0]?.value;
    await screen.unmount();
    expect(subscription?.remove).toHaveBeenCalledTimes(1);
  });

  it('keeps the standard colours on Android when the device cannot tell its contrast', async () => {
    setDeviceConditions({ os: 'android' });
    jest
      .mocked(AccessibilityInfo.isHighTextContrastEnabled)
      .mockRejectedValue(new Error('not available'));
    const { result } = await renderHook(() => useColors());
    expect(result.current.accent).toBe(appColors.accent.light);
  });

  it('keeps the standard colours on the web, where React Native exposes no contrast setting', async () => {
    setDeviceConditions({ os: 'web', scheme: 'dark', highContrast: true });
    const { result } = await renderHook(() => useColors());
    expect(result.current.accent).toBe(appColors.accent.dark);
    expect(AccessibilityInfo.isHighTextContrastEnabled).not.toHaveBeenCalled();
  });

  it('gives iOS the ornament line with the high-contrast values of the ornament', async () => {
    setDeviceConditions({ os: 'ios' });
    const { result } = await renderHook(() => useColors());
    expect(result.current.ornamentLine).toEqual(
      DynamicColorIOS({
        light: '#CE9A3C',
        dark: '#D9A441',
        highContrastLight: '#6A470F',
        highContrastDark: '#EBC272',
      }),
    );
  });

  it('gives iOS the strong water, the high-contrast water in every mode', async () => {
    setDeviceConditions({ os: 'ios' });
    const { result } = await renderHook(() => useColors());
    expect(result.current.accentStrong).toEqual(
      DynamicColorIOS({ light: '#0A4F59', dark: '#8FE0EA' }),
    );
    expect(result.current.accentStrong).toEqual(iosAppColor('accentStrong'));
  });

  it.each(['light', 'dark'] as const)(
    'gives Android the ornament line and the strong water: %s',
    async (scheme) => {
      setDeviceConditions({ os: 'android', scheme });
      const { result } = await renderHook(() => useColors());
      expect(result.current.ornamentLine).toBe(appColors.ornamentLine[scheme]);
      expect(result.current.accentStrong).toBe(highContrastAppColors.accent[scheme]);
    },
  );

  it.each(['light', 'dark'] as const)(
    'takes the high-contrast ornament line on Android, and keeps the strong water: %s',
    async (scheme) => {
      setDeviceConditions({ os: 'android', scheme, highContrast: true });
      const { result } = await renderHook(() => useColors());
      await waitFor(() => {
        expect(result.current.ornamentLine).toBe(highContrastAppColors.ornamentLine[scheme]);
      });
      expect(result.current.accentStrong).toBe(highContrastAppColors.accent[scheme]);
    },
  );

  it('covers every role on both kinds of platform', async () => {
    const roles = [
      ...Object.keys(iosSystemColorNames),
      ...Object.keys(appColors),
      ...Object.keys(palette),
    ].sort();
    setDeviceConditions({ os: 'ios' });
    expect(Object.keys((await renderHook(() => useColors())).result.current).sort()).toEqual(roles);
    setDeviceConditions({ os: 'android' });
    expect(Object.keys((await renderHook(() => useColors())).result.current).sort()).toEqual(roles);
  });
});

describe('useReducedMotion', () => {
  it.each(['ios', 'android', 'web'] as const)('is off by default on %s', async (os) => {
    setDeviceConditions({ os });
    const { result } = await renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it.each(['ios', 'android', 'web'] as const)(
    'is on when the device asks to reduce motion on %s',
    async (os) => {
      setDeviceConditions({ os, reducedMotion: true });
      const { result } = await renderHook(() => useReducedMotion());
      await waitFor(() => {
        expect(result.current).toBe(true);
      });
    },
  );

  it('follows the setting when it changes while the app is open', async () => {
    setDeviceConditions();
    const { result } = await renderHook(() => useReducedMotion());
    await changeReducedMotion(true);
    expect(result.current).toBe(true);
    await changeReducedMotion(false);
    expect(result.current).toBe(false);
  });

  it('asks the device once for several readers and stops listening after the last one', async () => {
    setDeviceConditions();
    function Reader() {
      useReducedMotion();
      return null;
    }
    await render(
      <>
        <Reader />
        <Reader />
      </>,
    );
    expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalledTimes(1);
    const subscription = jest.mocked(AccessibilityInfo.addEventListener).mock.results[0]?.value;
    await screen.unmount();
    expect(subscription?.remove).toHaveBeenCalledTimes(1);
  });

  it('keeps the last known answer while nothing listens, instead of going back to off', async () => {
    setDeviceConditions({ reducedMotion: true });
    const first = await renderHook(() => useReducedMotion());
    await waitFor(() => {
      expect(first.result.current).toBe(true);
    });
    await first.unmount();
    // The device now takes its time to answer again.
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockReturnValue(new Promise(() => {}));
    const second = await renderHook(() => useReducedMotion());
    expect(second.result.current).toBe(true);
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

  it('sets the display title at 36 points in regular weight, scaling like a large title', async () => {
    setDeviceConditions();
    await render(<AppText variant="displayTitle">À l’écoute…</AppText>);
    const text = screen.getByText('À l’écoute…');
    expect(styleOf(text)).toMatchObject({ fontSize: 36, fontWeight: '400' });
    expect(text).toHaveProp('dynamicTypeRamp', 'largeTitle');
  });

  it('announces the three title styles as headings', async () => {
    setDeviceConditions();
    await render(
      <>
        <AppText variant="largeTitle">Jardin</AppText>
        <AppText variant="displayTitle">À l’écoute…</AppText>
        <AppText variant="title2">Ton objectif</AppText>
        <AppText>Texte</AppText>
      </>,
    );
    expect(screen.getAllByRole('header')).toHaveLength(3);
  });

  it('takes its colour from a role, in both themes outside iOS', async () => {
    setDeviceConditions({ os: 'android', scheme: 'dark' });
    await render(<AppText color="secondaryLabel">Texte</AppText>);
    expect(styleOf(screen.getByText('Texte')).color).toBe(fallbackSystemColors.secondaryLabel.dark);
  });

  it('accepts the roles meant for text, and only those', async () => {
    setDeviceConditions();
    await render(
      <>
        <AppText color="secondaryLabel">Secondaire</AppText>
        <AppText color="accent">Accent</AppText>
        <AppText color="destructive">Destructif</AppText>
        <AppText color="ink">Encre</AppText>
        {/* @ts-expect-error A background is not a colour for text. */}
        <AppText color="background">Fond</AppText>
        {/* @ts-expect-error A separator is not a colour for text. */}
        <AppText color="separator">Séparateur</AppText>
        {/* @ts-expect-error A fill is not a colour for text. */}
        <AppText color="fill">Remplissage</AppText>
        {/* @ts-expect-error Paper is a surface. */}
        <AppText color="paper">Papier</AppText>
        {/* @ts-expect-error Orange colours an icon, never a word. */}
        <AppText color="warning">Soif</AppText>
        {/* @ts-expect-error The ornament line is a line, never a word. */}
        <AppText color="ornamentLine">Filet</AppText>
      </>,
    );
    expect(styleOf(screen.getByText('Destructif')).color).toEqual(PlatformColor('systemRed'));
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

  it('lets a scrolling screen pass under the bars on iOS, which insets it by itself', async () => {
    setDeviceConditions({ os: 'ios' });
    await render(
      <Screen scroll testID="screen">
        <AppText>Contenu</AppText>
      </Screen>,
    );
    const sidesOnly = { top: 'off', right: 'additive', bottom: 'off', left: 'additive' };
    expect(screen.getByTestId('screen')).toHaveProp('edges', sidesOnly);
    const [scrollView] = screen.container.queryAll(({ type }) => type === 'RCTScrollView');
    expect(scrollView).toHaveProp('contentInsetAdjustmentBehavior', 'automatic');
  });

  it('keeps every edge of a scrolling screen clear elsewhere, where nothing insets it', async () => {
    setDeviceConditions({ os: 'android' });
    await render(
      <Screen scroll testID="screen">
        <AppText>Contenu</AppText>
      </Screen>,
    );
    const allEdges = { top: 'additive', right: 'additive', bottom: 'additive', left: 'additive' };
    expect(screen.getByTestId('screen')).toHaveProp('edges', allEdges);
  });

  it('lets the caller choose the edges of a scrolling screen', async () => {
    setDeviceConditions({ os: 'ios' });
    await render(
      <Screen scroll edges={['top', 'left', 'right']} testID="screen">
        <AppText>Contenu</AppText>
      </Screen>,
    );
    const chosen = { top: 'additive', right: 'additive', bottom: 'off', left: 'additive' };
    expect(screen.getByTestId('screen')).toHaveProp('edges', chosen);
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

describe('QrCode', () => {
  const LINK = 'quranapp://invite/ABCDEFGH';

  it('encodes the text with a quiet zone of four light modules on every side', () => {
    const modules = qrCodeModules(LINK);
    expect(modules.length).toBeGreaterThan(21 + 8);
    for (const row of modules) expect(row).toHaveLength(modules.length);
    const lightBand = (index: number) =>
      modules[index]?.every((isDark) => !isDark) === true &&
      modules.every((row) => row[index] === false);
    for (const index of [0, 1, 2, 3, modules.length - 1, modules.length - 4]) {
      expect(lightBand(index)).toBe(true);
    }
    // The finder pattern starts right after the quiet zone.
    expect(modules[4]?.[4]).toBe(true);
  });

  it('is one image for screen readers, labelled by its purpose, dark on light in both appearances', async () => {
    for (const scheme of ['light', 'dark'] as const) {
      setDeviceConditions({ scheme });
      await render(<QrCode value={LINK} accessibilityLabel="QR code de mon invitation" />);
      expect(screen.getByRole('image', { name: 'QR code de mon invitation' })).toBeOnTheScreen();
      const [ground] = screen.container.queryAll(({ type }) => type === 'RNSVGRect');
      const [path] = screen.container.queryAll(({ type }) => type === 'RNSVGPath');
      // react-native-svg passes colours as ARGB numbers: opaque white, opaque black.
      expect(ground?.props.fill).toMatchObject({ payload: 0xffffffff });
      expect(path?.props.fill).toMatchObject({ payload: 0xff000000 });
    }
  });
});
