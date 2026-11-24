import {
  DynamicColorIOS,
  Platform,
  PlatformColor,
  useColorScheme,
  type ColorValue,
} from 'react-native';

import {
  appColors,
  fallbackSystemColors,
  iosSystemColorNames,
  type ColorPair,
  type ColorRole,
} from './tokens';

/** One colour per role of the charter, ready to be used in a style. */
export type Colors = Readonly<Record<ColorRole, ColorValue>>;

function mapRoles<Role extends string, Input>(
  source: Readonly<Record<Role, Input>>,
  convert: (input: Input) => ColorValue,
): Record<Role, ColorValue> {
  // `Object.entries` and `Object.fromEntries` forget the key type; the keys are those of `source`.
  const entries = Object.entries(source) as [Role, Input][];
  return Object.fromEntries(entries.map(([role, input]) => [role, convert(input)])) as Record<
    Role,
    ColorValue
  >;
}

/**
 * iOS: every role is a dynamic colour. The system resolves it when it draws, so one object
 * serves both appearances and Increase Contrast, and a change of appearance needs no render.
 * Built on first use because these APIs exist on iOS only.
 */
let iosColors: Colors | undefined;

function getIosColors(): Colors {
  iosColors ??= {
    ...mapRoles(iosSystemColorNames, (name) => PlatformColor(name)),
    ...mapRoles(appColors, (pair: ColorPair) =>
      DynamicColorIOS({ light: pair.light, dark: pair.dark }),
    ),
  };
  return iosColors;
}

/** Elsewhere: plain values, chosen from the device theme. */
const fallbackColors: Readonly<Record<keyof ColorPair, Colors>> = {
  light: {
    ...mapRoles(fallbackSystemColors, (pair: ColorPair) => pair.light),
    ...mapRoles(appColors, (pair: ColorPair) => pair.light),
  },
  dark: {
    ...mapRoles(fallbackSystemColors, (pair: ColorPair) => pair.dark),
    ...mapRoles(appColors, (pair: ColorPair) => pair.dark),
  },
};

/**
 * The single way to get a colour. Returns the colour of every role for the current appearance:
 * the system's dynamic colours on iOS, values that follow the device theme elsewhere. There is
 * no appearance setting in the app (dark-mode.md › Best practices).
 */
export function useColors(): Colors {
  const scheme = useColorScheme();
  if (Platform.OS === 'ios') return getIosColors();
  return fallbackColors[scheme === 'dark' ? 'dark' : 'light'];
}
