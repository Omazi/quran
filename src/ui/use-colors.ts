import {
  DynamicColorIOS,
  Platform,
  PlatformColor,
  useColorScheme,
  type ColorValue,
} from 'react-native';

import { useAppearanceOverride } from './appearance';
import { useHighContrast } from './device-settings';
import {
  appColors,
  backdropGradients,
  elevation,
  fallbackSystemColors,
  palette,
  highContrastAppColors,
  highContrastPalette,
  iosSystemColorNames,
  type AppColorRole,
  type BackdropName,
  type ColorPair,
  type ColorRole,
  type PaletteRole,
  type GradientStop,
} from './tokens';

/** One colour per role of the charter, ready to be used in a style. */
export type Colors = Readonly<Record<ColorRole, ColorValue>>;

type Appearance = keyof ColorPair;
type Contrast = 'standard' | 'high';

function mapRoles<Role extends string, Input>(
  source: Readonly<Record<Role, Input>>,
  convert: (input: Input, role: Role) => ColorValue,
): Record<Role, ColorValue> {
  // `Object.entries` and `Object.fromEntries` forget the key type; the keys are those of `source`.
  const entries = Object.entries(source) as [Role, Input][];
  return Object.fromEntries(entries.map(([role, input]) => [role, convert(input, role)])) as Record<
    Role,
    ColorValue
  >;
}

/** The high-contrast values of an app colour, when the charter gives some. */
function highContrastOf(role: AppColorRole): ColorPair | undefined {
  // Widened on purpose: only some roles have high-contrast values.
  const variants: Partial<Record<AppColorRole, ColorPair>> = highContrastAppColors;
  return variants[role];
}

/** The high-contrast values of a colour of the mockups' palette, when it has some. */
function highContrastOfPalette(role: PaletteRole): ColorPair | undefined {
  // Widened on purpose: only the words and actions have high-contrast values.
  const variants: Partial<Record<PaletteRole, ColorPair>> = highContrastPalette;
  return variants[role];
}

/**
 * iOS: every role is a dynamic colour. The system resolves it when it draws, so one object
 * serves both appearances and Increase Contrast, and a change of either needs no render.
 * Built on first use because these APIs exist on iOS only.
 */
let iosColors: Colors | undefined;

function getIosColors(): Colors {
  iosColors ??= {
    ...mapRoles(iosSystemColorNames, (name) => PlatformColor(name)),
    ...mapRoles(appColors, (pair: ColorPair, role) =>
      DynamicColorIOS({
        light: pair.light,
        dark: pair.dark,
        highContrastLight: highContrastOf(role)?.light,
        highContrastDark: highContrastOf(role)?.dark,
      }),
    ),
    ...mapRoles(palette, (pair: ColorPair, role) =>
      DynamicColorIOS({
        light: pair.light,
        dark: pair.dark,
        highContrastLight: highContrastOfPalette(role)?.light,
        highContrastDark: highContrastOfPalette(role)?.dark,
      }),
    ),
  };
  return iosColors;
}

/**
 * iOS, under a `ColorAppearance` that fixes the appearance: each app colour is still dynamic, so
 * that Increase Contrast keeps working, but both of its appearances take the fixed one's value.
 * The system's own roles take their fallback values, since a system colour follows the device.
 */
const iosFixedColors: Partial<Record<Appearance, Colors>> = {};

function getIosFixedColors(appearance: Appearance): Colors {
  const fixed = (pair: ColorPair, highContrast: ColorPair | undefined) =>
    DynamicColorIOS({
      light: pair[appearance],
      dark: pair[appearance],
      highContrastLight: highContrast?.[appearance],
      highContrastDark: highContrast?.[appearance],
    });
  iosFixedColors[appearance] ??= {
    ...mapRoles(fallbackSystemColors, (pair: ColorPair) => pair[appearance]),
    ...mapRoles(appColors, (pair: ColorPair, role) => fixed(pair, highContrastOf(role))),
    ...mapRoles(palette, (pair: ColorPair, role) => fixed(pair, highContrastOfPalette(role))),
  };
  return iosFixedColors[appearance];
}

function buildFallbackColors(appearance: Appearance, contrast: Contrast): Colors {
  return {
    ...mapRoles(fallbackSystemColors, (pair: ColorPair) => pair[appearance]),
    ...mapRoles(appColors, (pair: ColorPair, role) => {
      const highContrast = contrast === 'high' ? highContrastOf(role) : undefined;
      return (highContrast ?? pair)[appearance];
    }),
    ...mapRoles(palette, (pair: ColorPair, role) => {
      const highContrast = contrast === 'high' ? highContrastOfPalette(role) : undefined;
      return (highContrast ?? pair)[appearance];
    }),
  };
}

/**
 * Elsewhere: plain values, chosen from the device theme and, where the platform tells, from its
 * contrast setting. The provisional system equivalents have no high-contrast values.
 */
const fallbackColors: Readonly<Record<Contrast, Record<Appearance, Colors>>> = {
  standard: {
    light: buildFallbackColors('light', 'standard'),
    dark: buildFallbackColors('dark', 'standard'),
  },
  high: {
    light: buildFallbackColors('light', 'high'),
    dark: buildFallbackColors('dark', 'high'),
  },
};

/**
 * The single way to get a colour. Returns the colour of every role for the current appearance
 * and contrast: the system's dynamic colours on iOS, values that follow the device settings
 * elsewhere. There is no appearance setting in the app (dark-mode.md › Best practices).
 */
export function useColors(): Colors {
  const scheme = useColorScheme();
  const isHighContrast = useHighContrast();
  const override = useAppearanceOverride();
  if (Platform.OS === 'ios') return override === null ? getIosColors() : getIosFixedColors(override);
  const appearance = override ?? (scheme === 'dark' ? 'dark' : 'light');
  return fallbackColors[isHighContrast ? 'high' : 'standard'][appearance];
}

/**
 * The stops of a gradient behind the garden, for the current appearance. A gradient is drawn by
 * an SVG, which takes plain values: the appearance is read here, and a change of it renders again.
 */
export function useBackdropGradient(name: BackdropName): readonly GradientStop[] {
  const scheme = useColorScheme();
  const override = useAppearanceOverride();
  return backdropGradients[name][override ?? (scheme === 'dark' ? 'dark' : 'light')];
}

/** A soft shadow of the mockups for the current appearance (`elevation`), as a box shadow. */
export function useElevation(level: keyof typeof elevation): string {
  const scheme = useColorScheme();
  const override = useAppearanceOverride();
  return elevation[level][override ?? (scheme === 'dark' ? 'dark' : 'light')];
}

/** Every app colour as a plain value, for the current appearance and contrast. */
export type ColorValues = Readonly<Record<AppColorRole | PaletteRole, string>>;

function buildColorValues(appearance: Appearance, contrast: Contrast): ColorValues {
  const pick = <Role extends string>(
    source: Readonly<Record<Role, ColorPair>>,
    variantOf: (role: Role) => ColorPair | undefined,
  ): Record<Role, string> => {
    const roles = Object.keys(source) as Role[];
    return Object.fromEntries(
      roles.map((role) => {
        const variant = contrast === 'high' ? variantOf(role) : undefined;
        return [role, (variant ?? source[role])[appearance]];
      }),
    ) as Record<Role, string>;
  };
  return { ...pick(appColors, highContrastOf), ...pick(palette, highContrastOfPalette) };
}

const colorValues: Readonly<Record<Contrast, Record<Appearance, ColorValues>>> = {
  standard: {
    light: buildColorValues('light', 'standard'),
    dark: buildColorValues('dark', 'standard'),
  },
  high: { light: buildColorValues('light', 'high'), dark: buildColorValues('dark', 'high') },
};

/**
 * The same colours as `useColors`, as plain values for the device appearance and contrast, for
 * what cannot take a dynamic colour: the strokes and gradients of react-native-svg, CSS gradients
 * and box shadows, a colour animated between two values on the UI thread. A change of appearance
 * renders again. `appearance` fixes the appearance whatever the device's, for a surface that is
 * always dark (the deep green of the first launch's listening page); the contrast still follows
 * the device.
 */
export function useColorValues(appearance?: Appearance): ColorValues {
  const scheme = useColorScheme();
  const isHighContrast = useHighContrast();
  const override = useAppearanceOverride();
  const resolved = appearance ?? override ?? (scheme === 'dark' ? 'dark' : 'light');
  return colorValues[isHighContrast ? 'high' : 'standard'][resolved];
}

/** The plain colours of an appearance at standard contrast: for code that holds no hook (tests). */
export function colorValuesFor(appearance: Appearance): ColorValues {
  return colorValues.standard[appearance];
}
