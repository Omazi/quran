/**
 * Public API of the design system. Features import from here only.
 * Colour values are deliberately absent: a colour is obtained with `useColors()` or by passing a
 * role name to a component.
 */

export { AppText, type AppTextProps, type TextAlignment } from './components/app-text';
export {
  confirmAction,
  type ConfirmAction,
  type ConfirmActionOptions,
} from './components/confirm-action';
export { Placeholder, type PlaceholderProps } from './components/placeholder';
export { QrCode, qrCodeModules, type QrCodeProps } from './components/qr-code';
export { QuranText, type QuranTextProps, type QuranTextRun } from './components/quran-text';
export { Screen, type ScreenBackground, type ScreenProps } from './components/screen';
export { useHighContrast, useReducedMotion } from './device-settings';
export {
  listeningOpacity,
  listeningShape,
  useListeningColors,
  useUpcomingInk,
  type ListeningColors,
} from './listening-tokens';
export { getWritingDirection, type WritingDirection } from './direction';
export { appFonts } from './fonts';
export * from './native';
export {
  BarChart,
  niceAxisTop,
  type BarChartBar,
  type BarChartProps,
} from './components/bar-chart';
export {
  chart,
  fontFamily,
  layout,
  radius,
  spacing,
  stateOpacity,
  type QuranTextStyleName,
  type AppColorRole,
  type ColorRole,
  type IconColorRole,
  type SpacingToken,
  type SystemColorRole,
  type TextColorRole,
  type TextStyleName,
} from './tokens';
export { useColors, type Colors } from './use-colors';
