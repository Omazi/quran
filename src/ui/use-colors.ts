import {
  DynamicColorIOS,
  Platform,
  PlatformColor,
  useColorScheme,
  type ColorValue,
} from 'react-native';

import { useHighContrast } from './device-settings';
import {
  appColors,
  backdropGradients,
  elevation,
  fallbackSystemColors,
  gardenPalette,
  highContrastAppColors,
  highContrastGardenPalette,
  iosSystemColorNames,
  type AppColorRole,
  type BackdropName,
  type ColorPair,
  type ColorRole,
  type GardenPaletteRole,
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
function highContrastOfPalette(role: GardenPaletteRole): ColorPair | undefined {
  // Widened on purpose: only the words and actions have high-contrast values.
  const variants: Partial<Record<GardenPaletteRole, ColorPair>> = highContrastGardenPalette;
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
    ...mapRoles(gardenPalette, (pair: ColorPair, role) =>
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

function buildFallbackColors(appearance: Appearance, contrast: Contrast): Colors {
  return {
    ...mapRoles(fallbackSystemColors, (pair: ColorPair) => pair[appearance]),
    ...mapRoles(appColors, (pair: ColorPair, role) => {
      const highContrast = contrast === 'high' ? highContrastOf(role) : undefined;
      return (highContrast ?? pair)[appearance];
    }),
    ...mapRoles(gardenPalette, (pair: ColorPair, role) => {
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
  if (Platform.OS === 'ios') return getIosColors();
  return fallbackColors[isHighContrast ? 'high' : 'standard'][scheme === 'dark' ? 'dark' : 'light'];
}

/**
 * The stops of a gradient behind the garden, for the current appearance. A gradient is drawn by
 * an SVG, which takes plain values: the appearance is read here, and a change of it renders again.
 */
export function useBackdropGradient(name: BackdropName): readonly GradientStop[] {
  const scheme = useColorScheme();
  return backdropGradients[name][scheme === 'dark' ? 'dark' : 'light'];
}

/** A soft shadow of the mockups for the current appearance (`elevation`), as a box shadow. */
export function useElevation(level: keyof typeof elevation): string {
  const scheme = useColorScheme();
  return elevation[level][scheme === 'dark' ? 'dark' : 'light'];
}
