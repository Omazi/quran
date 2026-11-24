/**
 * Test support for src/ui and for the features built on it: sets the conditions of the device
 * (platform, appearance, writing direction, text size) and inspects what was rendered.
 *
 * Call `setDeviceConditions` at the start of a test and `resetDeviceConditions` after each test.
 */

import { screen } from '@testing-library/react-native';
import {
  Dimensions,
  I18nManager,
  Platform,
  StyleSheet,
  useColorScheme,
  type StyleProp,
  type TextStyle,
} from 'react-native';

/** A rendered host element, as the testing library returns it. */
export type RenderedElement = typeof screen.container;

export interface DeviceConditions {
  os?: 'ios' | 'android';
  scheme?: 'light' | 'dark';
  rightToLeft?: boolean;
  /** Text size multiplier: 1 is the default size. */
  fontScale?: number;
}

/**
 * The multiplier of the largest accessibility text size (AX5) for body text: 53 points instead
 * of 17 (typography.md › Specifications).
 */
export const LARGEST_FONT_SCALE = 53 / 17;

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
  rightToLeft = false,
  fontScale = 1,
}: DeviceConditions = {}): void {
  jest.replaceProperty(Platform, 'OS', os);
  // React Native's Jest preset replaces this hook with a mock function that returns 'light'.
  jest.mocked(useColorScheme).mockReturnValue(scheme);
  jest.replaceProperty(I18nManager, 'isRTL', rightToLeft);
  jest.spyOn(Dimensions, 'get').mockReturnValue({ ...WINDOW, fontScale });
}

/** Puts back the conditions of the Jest preset: iOS, light, left to right. */
export function resetDeviceConditions(): void {
  jest.restoreAllMocks();
  jest.mocked(useColorScheme).mockReturnValue('light');
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
