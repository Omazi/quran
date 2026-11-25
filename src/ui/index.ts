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
export { listeningOpacity, listeningShape, useUpcomingInk } from './listening-tokens';
export { getWritingDirection, type WritingDirection } from './direction';
export { appFonts, simpleScriptFont } from './fonts';
// The text styles and field behaviours the Proches tab's own text field is built from.
export { textStyles } from './tokens';
export { TEXT_FIELD_BEHAVIOURS } from './native/text-field-kinds';
export * from './native';
export {
  BarChart,
  niceAxisTop,
  type BarChartBar,
  type BarChartProps,
} from './components/bar-chart';
export {
  avatarColorCount,
  chart,
  emphasisWeight,
  fontFamily,
  launchColors,
  launchMarkWidth,
  layout,
  pieceSizes,
  MINIMUM_FONT_SIZE,
  radius,
  readerShapes,
  spacing,
  stateOpacity,
  storyLayout,
  storyMotion,
  type BackdropName,
  type PaletteRole,
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
  useBackdropGradient,
  useColors,
  useColorValues,
  useElevation,
  type Colors,
  type ColorValues,
} from './use-colors';
export { PageDots, type PageDotsProps } from './components/page-dots';
export { PAGE_DOTS } from './components/page-dots-shape';
export { StarPattern, type StarPatternProps } from './components/star-pattern';
export { SwipePager, type SwipePagerProps } from './components/swipe-pager';
export { SWIPE_PAGING, crossfade, stageLayerOpacity, swapOpacity } from './components/swipe-paging';
export {
  ActionButton,
  type ActionButtonProps,
  type ActionButtonVariant,
} from './components/action-button';
export { ArabicDisplayText, type ArabicDisplayTextProps } from './components/arabic-display-text';
export { Avatar, type AvatarProps } from './components/avatar';
export { Card, type CardProps, type CardTone } from './components/card';
export { DottedProgress, type DottedProgressProps } from './components/dotted-progress';
export { GradientBackdrop, type GradientBackdropProps } from './components/gradient-backdrop';
export { IconTile, type IconTileProps, type IconTileTone } from './components/icon-tile';
export { Pill, type PillProps } from './components/pill';
export { ProgressRing, type ProgressRingProps } from './components/progress-ring';
export { SectionHeader, type SectionHeaderProps } from './components/section-header';
