/**
 * Test support for src/ui and for the features built on it: sets the conditions of the device
 * (platform, appearance, contrast, writing direction, text size) and inspects what was rendered.
 *
 * Call `setDeviceConditions` at the start of a test and `resetDeviceConditions` after each test.
 */

import { act, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import {
  AccessibilityInfo,
  Dimensions,
  I18nManager,
  Platform,
  DynamicColorIOS,
  StyleSheet,
  useColorScheme,
  type ColorValue,
  type StyleProp,
  type TextStyle,
} from 'react-native';

import { NativeImplementation } from '../native/implementation';
import {
  appColors,
  palette,
  highContrastAppColors,
  highContrastPalette,
  type AppColorRole,
  type ColorPair,
  type PaletteRole,
} from '../tokens';

/** A rendered host element, as the testing library returns it. */
export type RenderedElement = typeof screen.container;

export interface DeviceConditions {
  os?: 'ios' | 'android' | 'web';
  scheme?: 'light' | 'dark';
  /**
   * Android's "high contrast text" setting. On iOS the system resolves high contrast inside each
   * dynamic colour, so there is nothing to set.
   */
  highContrast?: boolean;
  /** Reduce Motion on iOS, "remove animations" on Android. */
  reducedMotion?: boolean;
  rightToLeft?: boolean;
  /** Text size multiplier: 1 is the default size. */
  fontScale?: number;
}

/**
 * The largest text size multiplier a device reports to React Native: 3.571 on iOS at the largest
 * accessibility size, AX5 (React Native's own table, RCTAccessibilityManager). Android stops at
 * 2. Text set in an Apple text style does not use this number on iOS: the system scales each
 * style by its own table (typography.md › Specifications).
 */
export const LARGEST_FONT_SCALE = 3.571;

/** The four combinations every component is rendered in. */
export const APPEARANCES_AND_DIRECTIONS = [
  { scheme: 'light', rightToLeft: false },
  { scheme: 'light', rightToLeft: true },
  { scheme: 'dark', rightToLeft: false },
  { scheme: 'dark', rightToLeft: true },
] as const satisfies readonly DeviceConditions[];

const WINDOW = { width: 390, height: 844, scale: 3 };

export function setDeviceConditions({
  os = 'ios',
  scheme = 'light',
  highContrast = false,
  reducedMotion = false,
  rightToLeft = false,
  fontScale = 1,
}: DeviceConditions = {}): void {
  jest.replaceProperty(Platform, 'OS', os);
  // React Native's Jest preset replaces this hook and `AccessibilityInfo` with mock functions,
  // which `jest.restoreAllMocks` leaves as they are: `resetDeviceConditions` puts them back.
  jest.mocked(useColorScheme).mockReturnValue(scheme);
  jest.mocked(AccessibilityInfo.isHighTextContrastEnabled).mockResolvedValue(highContrast);
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(reducedMotion);
  jest.replaceProperty(I18nManager, 'isRTL', rightToLeft);
  jest.spyOn(Dimensions, 'get').mockReturnValue({ ...WINDOW, fontScale });
}

type DeviceSettingEvent =
  | 'highTextContrastChanged'
  | 'reduceMotionChanged'
  | 'reduceTransparencyChanged';

/** Tells the app that a device setting changed, as the device would while the app is open. */
async function changeDeviceSetting(event: DeviceSettingEvent, enabled: boolean): Promise<void> {
  const handlers = jest
    .mocked(AccessibilityInfo.addEventListener)
    .mock.calls.filter(([eventName]) => eventName === event)
    // The mock records the handler of any event; the handlers of these events take one boolean.
    .map(([, handler]) => handler as (enabled: boolean) => void);
  await act(async () => {
    for (const handler of handlers) handler(enabled);
  });
}

/** Simulates the person switching Android's "high contrast text" while the app is open. */
export function changeHighContrast(enabled: boolean): Promise<void> {
  return changeDeviceSetting('highTextContrastChanged', enabled);
}

/** Simulates the person switching the reduce-motion setting while the app is open. */
export function changeReducedMotion(enabled: boolean): Promise<void> {
  return changeDeviceSetting('reduceMotionChanged', enabled);
}

/** Simulates the person switching iOS's Reduce Transparency while the app is open. */
export function changeReducedTransparency(enabled: boolean): Promise<void> {
  return changeDeviceSetting('reduceTransparencyChanged', enabled);
}

/**
 * Puts back the conditions of the Jest preset: iOS, light, standard contrast, motion allowed,
 * left to right. The app remembers the last device settings it was told, so it is told they are
 * off again before the mocks forget who was listening.
 */
export async function resetDeviceConditions(): Promise<void> {
  await changeDeviceSetting('highTextContrastChanged', false);
  await changeDeviceSetting('reduceMotionChanged', false);
  await changeDeviceSetting('reduceTransparencyChanged', false);
  jest.restoreAllMocks();
  jest.mocked(useColorScheme).mockReturnValue('light');
  jest.mocked(AccessibilityInfo.isHighTextContrastEnabled).mockClear().mockResolvedValue(false);
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockClear().mockResolvedValue(false);
  jest.mocked(AccessibilityInfo.addEventListener).mockClear();
}

/**
 * The colour iOS receives for an app role: one dynamic colour that holds the light and dark
 * values and, when the charter gives them, the high-contrast ones.
 */
export function iosAppColor(role: AppColorRole): ColorValue {
  // Widened on purpose: only some roles have high-contrast values.
  const variants: Partial<Record<AppColorRole, ColorPair>> = highContrastAppColors;
  return DynamicColorIOS({
    light: appColors[role].light,
    dark: appColors[role].dark,
    highContrastLight: variants[role]?.light,
    highContrastDark: variants[role]?.dark,
  });
}

/** What `useColors` gives on iOS for a colour of the mockups' palette. */
export function iosPaletteColor(role: PaletteRole): ColorValue {
  // Widened on purpose: only some roles have high-contrast values.
  const variants: Partial<Record<PaletteRole, ColorPair>> = highContrastPalette;
  return DynamicColorIOS({
    light: palette[role].light,
    dark: palette[role].dark,
    highContrastLight: variants[role]?.light,
    highContrastDark: variants[role]?.dark,
  });
}

/** The style of an element as one object. */
export function styleOf(element: RenderedElement): TextStyle {
  // Host elements expose untyped props; a style prop is what React Native puts there.
  return StyleSheet.flatten(element.props.style as StyleProp<TextStyle>) ?? {};
}

/** The element and everything below it. */
export function withDescendants(element: RenderedElement): RenderedElement[] {
  return element.queryAll(() => true, { includeSelf: true });
}

/** The largest minimum height found on the element or below it: its touch target's height. */
export function touchTargetHeight(element: RenderedElement): number {
  const heights = withDescendants(element).map(({ props }) => {
    const { minHeight } = StyleSheet.flatten(props.style as StyleProp<TextStyle>) ?? {};
    return typeof minHeight === 'number' ? minHeight : 0;
  });
  return Math.max(...heights);
}

const PHYSICAL_PAIRS = [
  ['left', 'right'],
  ['marginLeft', 'marginRight'],
  ['paddingLeft', 'paddingRight'],
  ['borderLeftWidth', 'borderRightWidth'],
  ['borderLeftColor', 'borderRightColor'],
  ['borderTopLeftRadius', 'borderTopRightRadius'],
  ['borderBottomLeftRadius', 'borderBottomRightRadius'],
] as const;

/**
 * Lists the styles that would not mirror in a right-to-left interface: a left or right value
 * without its equal on the other side, or a text aligned to a physical side. Rows, logical
 * properties and `start`/`end` mirror by themselves.
 */
export function directionDependentStyles(element: RenderedElement): string[] {
  return withDescendants(element).flatMap((descendant) => {
    const style = styleOf(descendant);
    const sided = PHYSICAL_PAIRS.filter(([left, right]) => style[left] !== style[right]).map(
      ([left, right]) => `${descendant.type}: ${left}/${right}`,
    );
    const aligned =
      style.textAlign === 'left' || style.textAlign === 'right'
        ? [`${descendant.type}: textAlign ${style.textAlign}`]
        : [];
    return [...sided, ...aligned];
  });
}

/** Lists fixed heights, which would cut text at large sizes. Hairlines and dots are not text. */
export function fixedHeightsAroundText(element: RenderedElement): string[] {
  return withDescendants(element)
    .filter((descendant) => typeof styleOf(descendant).height === 'number')
    .filter((descendant) => descendant.queryAll(({ type }) => type === 'Text').length > 0)
    .map((descendant) => `${descendant.type}: height ${styleOf(descendant).height}`);
}

// ---------------------------------------------------------------------------------------------
// What an iPhone would be asked to draw
// ---------------------------------------------------------------------------------------------

/** Under Jest every view of Expo UI is a stub of this type that keeps its props. */
const EXPO_UI_STUB = 'ViewManagerAdapter_ExpoUI';

/** A SwiftUI host: the React Native view that starts a SwiftUI tree. */
export function isSwiftUIHost(element: RenderedElement): boolean {
  return element.type === EXPO_UI_STUB && element.props.layoutDirection !== undefined;
}

/** Expo UI's view that puts React Native content back inside a SwiftUI tree. */
function isReactNativeContent(element: RenderedElement): boolean {
  return element.type === EXPO_UI_STUB && 'expoInternalSizeFromChildren' in element.props;
}

/**
 * Whether something would display this element on an iPhone: going up from it, a SwiftUI host
 * must come before the root and before any React Native content placed inside SwiftUI.
 */
function hasSwiftUIHost(element: RenderedElement): boolean {
  for (let ancestor = element.parent; ancestor !== null; ancestor = ancestor.parent) {
    if (isSwiftUIHost(ancestor)) return true;
    if (isReactNativeContent(ancestor)) return false;
  }
  return false;
}

/** Describes the SwiftUI views that no host would display. Empty when the tree is sound. */
export function swiftUIViewsWithoutHost(root: RenderedElement = screen.container): string[] {
  return withDescendants(root)
    .filter((element) => element.type === EXPO_UI_STUB && !isSwiftUIHost(element))
    .filter((element) => !hasSwiftUIHost(element))
    .map((element) => `SwiftUI view without a host: ${JSON.stringify(element.props)}`);
}

/**
 * Renders a tree the way an iPhone receives it: the controls of `@/ui` use their SwiftUI
 * implementation, which Jest shows as stubs that keep their props. Fails if a SwiftUI view has
 * no host above it, because the screen would then stay empty on an iPhone while the default
 * implementation, the one other tests see, would draw it.
 */
export async function renderOnIOS(tree: ReactElement): Promise<void> {
  await render(<NativeImplementation.Provider value="ios">{tree}</NativeImplementation.Provider>);
  expect(swiftUIViewsWithoutHost()).toEqual([]);
}
