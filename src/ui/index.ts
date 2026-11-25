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
export { ReaderSearchField, type ReaderSearchFieldProps } from './components/reader-search-field';
export { QuranText, type QuranTextProps, type QuranTextRun } from './components/quran-text';
export { Screen, type ScreenBackground, type ScreenProps } from './components/screen';
export { useReducedMotion } from './device-settings';
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
  emphasisWeight,
  fontFamily,
  layout,
  MINIMUM_FONT_SIZE,
  radius,
  readerShapes,
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
export {
  useColors,
  useReaderPalette,
  useReaderPaletteValues,
  type Colors,
  type ReaderPalette,
} from './use-colors';
