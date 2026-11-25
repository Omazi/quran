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
export { useHighContrast, useReducedMotion } from './device-settings';
export { useSafeInsets } from './safe-insets';
export {
  listeningOpacity,
  listeningShape,
  useListeningColors,
  useUpcomingInk,
  type ListeningColors,
} from './listening-tokens';
export { getWritingDirection, type WritingDirection } from './direction';
export { appFonts } from './fonts';
// The palette of the validated mockups, used by the Proches tab (see visit-palette.ts), with the
// charter's text styles and field behaviours its own components are built from.
export * from './visit-palette';
export { appleTextStyles, textStyles } from './tokens';
export { TEXT_FIELD_BEHAVIOURS } from './native/text-field-kinds';
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
  pieceSizes,
  MINIMUM_FONT_SIZE,
  radius,
  readerShapes,
  spacing,
  stateOpacity,
  type BackdropName,
  type GardenPaletteRole,
  type QuranTextStyleName,
  type AppColorRole,
  type ColorRole,
  type IconColorRole,
  type SpacingToken,
  type SystemColorRole,
  type TextColorRole,
  type TextStyleName,
} from './tokens';
export { useBackdropGradient, useColors, useElevation, type Colors } from './use-colors';
export { ActionButton, type ActionButtonProps } from './components/action-button';
export { ArabicDisplayText, type ArabicDisplayTextProps } from './components/arabic-display-text';
export { Avatar, type AvatarProps } from './components/avatar';
export { Card, type CardProps, type CardTone } from './components/card';
export { DottedProgress, type DottedProgressProps } from './components/dotted-progress';
export { GradientBackdrop, type GradientBackdropProps } from './components/gradient-backdrop';
export { IconTile, type IconTileProps, type IconTileTone } from './components/icon-tile';
export { Pill, type PillProps } from './components/pill';
export { ProgressRing, type ProgressRingProps } from './components/progress-ring';
export { SectionHeader, type SectionHeaderProps } from './components/section-header';
export {
  useColors,
  useReaderPalette,
  useReaderPaletteValues,
  type Colors,
  type ReaderPalette,
} from './use-colors';
