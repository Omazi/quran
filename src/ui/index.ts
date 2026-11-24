/**
 * Public API of the design system. Features import from here only.
 * Colour values are deliberately absent: a colour is obtained with `useColors()` or by passing a
 * role name to a component.
 */

export { AppText, type AppTextProps, type TextAlignment } from './components/app-text';
export { Placeholder, type PlaceholderProps } from './components/placeholder';
export { Screen, type ScreenBackground, type ScreenProps } from './components/screen';
export { useReducedMotion } from './device-settings';
export { getWritingDirection, type WritingDirection } from './direction';
export { appFonts } from './fonts';
export * from './native';
export {
  fontFamily,
  layout,
  radius,
  spacing,
  stateOpacity,
  type AppColorRole,
  type ColorRole,
  type IconColorRole,
  type SpacingToken,
  type SystemColorRole,
  type TextColorRole,
  type TextStyleName,
} from './tokens';
export { useColors, type Colors } from './use-colors';
