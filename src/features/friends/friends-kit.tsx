/**
 * The visual pieces of the Proches tab, drawn after the validated mockups (docs/design/visite.png,
 * docs/design/accueil.png, docs/design/bienvenue.png): a warm sky, white cards, serif titles,
 * capsule buttons in one green. Owner's rule of 25 November 2026: the mockups are the reference.
 *
 * They are kept in this folder, with the `Friends` prefix, while other screens move to the same
 * look on their own; the pieces will be gathered in src/ui once they are compared. Colours,
 * shapes and sizes all come from src/ui (`visit-palette.ts`, `tokens.ts`).
 */

import { SymbolView, type SymbolWeight } from 'expo-symbols';
import { type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  useWindowDimensions,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import {
  appleTextStyles,
  getWritingDirection,
  layout,
  spacing,
  stateOpacity,
  TEXT_FIELD_BEHAVIOURS,
  textStyles,
  useVisitColors,
  visitShadow,
  visitShape,
  visitTextStyles,
  type IconSymbol,
  type TextFieldRowProps,
  type TextStyleName,
  type VisitColorRole,
  type VisitTextStyleName,
} from '@/ui';

// --- Text ------------------------------------------------------------------------------------

export type FriendsTextVariant = TextStyleName | VisitTextStyleName;

const HEADINGS: ReadonlySet<FriendsTextVariant> = new Set([
  'largeTitle',
  'displayTitle',
  'title2',
  'heading',
]);

interface ResolvedTextStyle {
  readonly fontFamily?: string;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly fontWeight: TextStyle['fontWeight'];
  readonly ramp: NonNullable<TextProps['dynamicTypeRamp']>;
}

function textStyleOf(variant: FriendsTextVariant): ResolvedTextStyle {
  if (variant in visitTextStyles) {
    return visitTextStyles[variant as VisitTextStyleName];
  }
  const style = textStyles[variant as TextStyleName];
  return { ...style, ramp: appleTextStyles[variant as TextStyleName] };
}

export interface FriendsTextProps extends Omit<
  TextProps,
  'allowFontScaling' | 'dynamicTypeRamp' | 'maxFontSizeMultiplier' | 'style'
> {
  variant?: FriendsTextVariant;
  color?: VisitColorRole;
  /** `start` follows the direction of reading. */
  align?: 'start' | 'center';
  /** Layout only: font, size and colour come from the props. */
  style?: StyleProp<TextStyle>;
}

/**
 * A text in the mockups' colours. Its size follows the person's text size, with Apple's ramp of
 * its style (typography.md › Supporting Dynamic Type); titles are headings for VoiceOver.
 */
export function FriendsText({
  variant = 'body',
  color = 'ink',
  align = 'start',
  accessibilityRole,
  style,
  ...rest
}: FriendsTextProps) {
  const colors = useVisitColors();
  const { ramp, ...font } = textStyleOf(variant);
  return (
    <Text
      accessibilityRole={accessibilityRole ?? (HEADINGS.has(variant) ? 'header' : undefined)}
      {...rest}
      dynamicTypeRamp={ramp}
      style={[
        style,
        { fontFamily: undefined },
        font,
        { color: colors[color], textAlign: align === 'start' ? 'auto' : align },
      ]}
    />
  );
}

// --- Symbols ---------------------------------------------------------------------------------

const SYMBOL_WEIGHT: Record<string, SymbolWeight> = {
  '400': 'regular',
  '600': 'semibold',
  '700': 'bold',
};

/**
 * An SF Symbol (Material Symbol off iOS) in a colour of the mockups, at the size and weight of
 * the text beside it (sf-symbols.md › Weights and scales). Decorative unless it has a label.
 */
export function FriendsSymbol({
  symbol,
  color,
  variant = 'body',
  accessibilityLabel,
  mirrored = false,
}: {
  symbol: IconSymbol;
  color: VisitColorRole;
  variant?: FriendsTextVariant;
  accessibilityLabel?: string;
  /** For a symbol that points the way of reading, where the platform does not flip it. */
  mirrored?: boolean;
}) {
  const colors = useVisitColors();
  const { fontScale } = useWindowDimensions();
  const style = textStyleOf(variant);
  const isDecorative = accessibilityLabel === undefined;
  return (
    <SymbolView
      name={{ ios: symbol.ios, android: symbol.android, web: symbol.android }}
      size={style.fontSize * fontScale}
      weight={SYMBOL_WEIGHT[String(style.fontWeight)] ?? 'regular'}
      tintColor={colors[color]}
      accessible={!isDecorative}
      accessibilityRole={isDecorative ? undefined : 'image'}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={isDecorative}
      importantForAccessibility={isDecorative ? 'no-hide-descendants' : 'yes'}
      style={mirrored && getWritingDirection() === 'rtl' ? styles.mirrored : undefined}
    />
  );
}

// --- Surfaces --------------------------------------------------------------------------------

/**
 * `visit`: the sky of the visit, warm at the top, sage at the bottom (visite.png). `page`: the
 * same warm top fading into the page's cream, as under the home screen's cards (accueil.png).
 */
export type FriendsSky = 'visit' | 'page';

export function useSkyStyle(sky: FriendsSky): ViewStyle {
  const colors = useVisitColors();
  const stops =
    sky === 'visit'
      ? `${colors.skyTop} 0%, ${colors.skyMiddle} 50%, ${colors.skyBottom} 100%`
      : `${colors.skyTop} 0%, ${colors.page} 45%, ${colors.page} 100%`;
  return {
    backgroundColor: sky === 'visit' ? colors.skyBottom : colors.page,
    backgroundImage: `linear-gradient(180deg, ${stops})`,
  };
}

export interface FriendsPageProps {
  children: ReactNode;
  sky?: FriendsSky;
  /**
   * True for a page under the navigation bar: the bar keeps the top clear. The root of the tab
   * has no bar and keeps the status bar clear itself (layout.md › Guides and safe areas).
   */
  isUnderBar?: boolean;
  /** Content laid out by the caller, without the page's scroll view. */
  isBare?: boolean;
  testID?: string;
}

/** The ground of every page of the tab: the sky, the safe areas, and a scroll view. */
export function FriendsPage({
  children,
  sky = 'page',
  isUnderBar = false,
  isBare = false,
  testID,
}: FriendsPageProps) {
  const skyStyle = useSkyStyle(sky);
  const edges: readonly Edge[] = isUnderBar ? ['left', 'right'] : ['top', 'left', 'right'];
  return (
    <SafeAreaView edges={edges} style={[styles.page, skyStyle]} testID={testID}>
      {isBare ? (
        children
      ) : (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.pageContent}
        >
          {children}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/** A white card of the mockups, with their soft shadow by day. */
export function FriendsCard({
  children,
  radius = 'card',
  style,
  testID,
}: {
  children: ReactNode;
  radius?: 'card' | 'sheet';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const colors = useVisitColors();
  const appearance = useColorScheme() === 'dark' ? 'dark' : 'light';
  return (
    <View
      testID={testID}
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderRadius: radius === 'sheet' ? visitShape.sheetRadius : visitShape.cardRadius,
          boxShadow: visitShadow.card[appearance],
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** A hairline between two rows of a card. */
export function FriendsSeparator() {
  const colors = useVisitColors();
  return <View style={[styles.separator, { backgroundColor: colors.hairline }]} />;
}

/**
 * The title of a part of the page, in the serif of the mockups ("Jardins voisins"), with an
 * optional trailing text (accueil.png: "Tout voir").
 */
export function FriendsSectionTitle({ title, trailing }: { title: string; trailing?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <FriendsText variant="title2" color="title" style={styles.flexText}>
        {title}
      </FriendsText>
      {trailing}
    </View>
  );
}

/** The small coloured line above a card's title (accueil.png: "Arrosage du jour"). */
export function FriendsEyebrow({ children }: { children: string }) {
  return (
    <FriendsText variant="eyebrow" color="forestText">
      {children}
    </FriendsText>
  );
}

// --- Buttons ---------------------------------------------------------------------------------

/**
 * `primary`: the green capsule, one per screen ("Lire avec elle"); `soft`: the pale green capsule
 * beside it ("Encourager"); `apple`: black by day, white at night ("Continuer avec Apple");
 * `outline`: the white capsule with a thin border ("Continuer avec Google"); `link`: green words
 * ("Continuer avec un e-mail", "Tout voir"); `destructive`: red words, for removing and blocking.
 */
export type FriendsButtonKind = 'primary' | 'soft' | 'apple' | 'outline' | 'link' | 'destructive';

const BUTTON_COLORS: Record<
  FriendsButtonKind,
  { background?: VisitColorRole; label: VisitColorRole; border?: VisitColorRole }
> = {
  primary: { background: 'forest', label: 'onForest' },
  soft: { background: 'forestSoft', label: 'onForestSoft' },
  apple: { background: 'appleButton', label: 'onAppleButton' },
  outline: { background: 'card', label: 'ink', border: 'outline' },
  link: { label: 'forestText' },
  destructive: { label: 'destructive' },
};

export interface FriendsButtonProps {
  label: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  onPress: () => void;
  kind?: FriendsButtonKind;
  symbol?: IconSymbol;
  disabled?: boolean;
  /** Takes the room it is given in a row (flex 1), or the whole width in a column. */
  isWide?: boolean;
  /**
   * A done state ("Encouragé aujourd'hui"): disabled, but drawn at full strength, because its
   * label says what was done. Other disabled buttons are dimmed.
   */
  isDone?: boolean;
  testID?: string;
}

/**
 * A capsule button of the mockups: 50 points high (44 for words alone), its label and symbol
 * centred. Its target is never under 44 points (accessibility.md › Mobility); while pressed it
 * dims a little, while disabled it says so to VoiceOver.
 */
export function FriendsButton({
  label,
  accessibilityLabel,
  accessibilityHint,
  onPress,
  kind = 'primary',
  symbol,
  disabled = false,
  isWide = false,
  isDone = false,
  testID,
}: FriendsButtonProps) {
  const colors = useVisitColors();
  const palette = BUTTON_COLORS[kind];
  const isWords = palette.background === undefined;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || isDone }}
      disabled={disabled || isDone}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        isWords ? styles.wordsButton : styles.capsuleButton,
        palette.background === undefined
          ? undefined
          : { backgroundColor: colors[palette.background] },
        palette.border === undefined
          ? undefined
          : { borderColor: colors[palette.border], borderWidth: layout.outlineWidth },
        isWide && styles.wide,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {symbol === undefined ? null : (
        <FriendsSymbol symbol={symbol} color={palette.label} variant="button" />
      )}
      <FriendsText variant="button" color={palette.label} align="center" style={styles.flexShrink}>
        {label}
      </FriendsText>
    </Pressable>
  );
}

/**
 * Two buttons side by side at the same size, stacked at large text sizes so that their labels
 * keep whole words (buttons.md › Style: style, not size, tells the preferred one;
 * typography.md › Supporting Dynamic Type).
 */
export function FriendsButtonPair({ children }: { children: ReactNode }) {
  const { fontScale } = useWindowDimensions();
  const isSideBySide = fontScale <= layout.sideBySideMaxFontScale;
  return <View style={isSideBySide ? styles.pairRow : styles.pairColumn}>{children}</View>;
}

// --- People ----------------------------------------------------------------------------------

/**
 * A friend's initial in their colour (accueil.png, visite.png). Decorative: the name is always
 * written beside it, so VoiceOver skips it.
 */
export function FriendsAvatar({
  initial,
  color,
  size = 'large',
}: {
  initial: string;
  color: VisitColorRole;
  size?: 'large' | 'small';
}) {
  const colors = useVisitColors();
  const diameter = size === 'large' ? visitShape.avatarLarge : visitShape.avatarSmall;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.avatar,
        {
          minWidth: diameter,
          minHeight: diameter,
          borderRadius: diameter / 2,
          backgroundColor: colors[color],
        },
      ]}
    >
      <FriendsText
        variant={size === 'large' ? 'body' : 'initialSmall'}
        color="onAvatar"
        align="center"
      >
        {initial}
      </FriendsText>
    </View>
  );
}

/**
 * The row of sixty dots of the visit (visite.png): one per hizb, the read ones in the friend's
 * colour. VoiceOver hears a progress bar with its value in words.
 */
export function FriendsHizbDots({
  completed,
  total,
  color,
  label,
  valueText,
  testID,
}: {
  completed: number;
  total: number;
  color: VisitColorRole;
  label: string;
  valueText: string;
  testID?: string;
}) {
  const colors = useVisitColors();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: total, now: completed, text: valueText }}
      style={styles.dots}
      testID={testID}
    >
      {Array.from({ length: total }, (_, index) => (
        <View
          key={index}
          testID={testID === undefined ? undefined : `${testID}-dot-${index}`}
          style={[
            styles.dot,
            { backgroundColor: index < completed ? colors[color] : colors.dotEmpty },
          ]}
        />
      ))}
    </View>
  );
}

// --- Rows ------------------------------------------------------------------------------------

/**
 * A row of a card: an optional leading piece (an avatar), a label and its detail, a trailing
 * value, and a chevron when it opens a page (lists-and-tables.md › Best practices). The chevron
 * follows the direction of reading (right-to-left.md › Flip controls that show progress).
 */
export function FriendsRow({
  label,
  detail,
  value,
  leading,
  trailing,
  onPress,
  accessibilityLabel,
  labelColor = 'ink',
  isHighlighted = false,
  testID,
}: {
  label: string;
  detail?: string;
  value?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  labelColor?: VisitColorRole;
  isHighlighted?: boolean;
  testID?: string;
}) {
  const colors = useVisitColors();
  const content = (
    <>
      {leading}
      <View style={styles.rowWords}>
        <FriendsText variant="body" color={labelColor}>
          {label}
        </FriendsText>
        {detail === undefined ? null : (
          <FriendsText variant="subhead" color="inkSecondary">
            {detail}
          </FriendsText>
        )}
      </View>
      {value === undefined ? null : (
        <FriendsText variant="body" color="inkSecondary" style={styles.rowValue}>
          {value}
        </FriendsText>
      )}
      {trailing}
      {onPress === undefined ? null : (
        <FriendsSymbol symbol={CHEVRON} color="inkSecondary" variant="footnote" mirrored />
      )}
    </>
  );
  const rowStyle = [
    styles.row,
    isHighlighted && [styles.highlighted, { backgroundColor: colors.forestSoft }],
  ];
  if (onPress === undefined) {
    return (
      <View style={rowStyle} testID={testID} accessible={accessibilityLabel !== undefined}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [rowStyle, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const CHEVRON: IconSymbol = { ios: 'chevron.forward', android: 'chevron_right' };
const SEARCH_SYMBOL: IconSymbol = { ios: 'magnifyingglass', android: 'search' };
const CLEAR_SYMBOL: IconSymbol = { ios: 'xmark.circle.fill', android: 'cancel' };

// --- Fields ----------------------------------------------------------------------------------

const KEYBOARD = {
  default: 'default',
  'email-address': 'email-address',
  'number-pad': 'number-pad',
  'web-search': 'web-search',
} as const;

const AUTOFILL = {
  none: 'off',
  name: 'name',
  emailAddress: 'email',
  oneTimeCode: 'one-time-code',
} as const;

const CONTENT_TYPE = {
  none: 'none',
  name: 'name',
  emailAddress: 'emailAddress',
  oneTimeCode: 'oneTimeCode',
} as const;

/**
 * The system text field (UITextField on iOS) in the field shape of the mockups: the page's cream
 * inside a card, rounded, with the keyboard and suggestions of what it asks for
 * (text-fields.md › Best practices). A search field has the search symbol at its leading end and
 * a clear button of 44 points while it has text (search-fields.md).
 */
export function FriendsTextField({
  label,
  placeholder,
  value,
  onChange,
  kind = 'text',
  maxLength,
  onSubmit,
  clearLabel,
  testID,
}: TextFieldRowProps) {
  const colors = useVisitColors();
  const behaviour = TEXT_FIELD_BEHAVIOURS[kind];
  return (
    <View style={[styles.field, { backgroundColor: colors.field }]}>
      {kind === 'search' ? (
        <FriendsSymbol symbol={SEARCH_SYMBOL} color="inkSecondary" variant="body" />
      ) : null}
      <TextInput
        accessibilityLabel={label}
        placeholder={placeholder ?? label}
        placeholderTextColor={colors.inkSecondary}
        value={value}
        onChangeText={onChange}
        maxLength={maxLength}
        onSubmitEditing={onSubmit}
        keyboardType={KEYBOARD[behaviour.keyboard]}
        autoCapitalize={behaviour.capitalization}
        autoCorrect={behaviour.autocorrect}
        autoComplete={AUTOFILL[behaviour.content]}
        textContentType={CONTENT_TYPE[behaviour.content]}
        returnKeyType={behaviour.returnKey}
        selectionColor={colors.forestText}
        testID={testID}
        style={[styles.input, { color: colors.ink }]}
      />
      {kind === 'search' && value !== '' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={clearLabel ?? label}
          onPress={() => onChange('')}
          style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
        >
          <FriendsSymbol symbol={CLEAR_SYMBOL} color="inkSecondary" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  pageContent: {
    flexGrow: 1,
    paddingTop: spacing.md,
    paddingHorizontal: layout.screenMargin,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  card: { padding: visitShape.cardPadding, gap: spacing.md },
  separator: { height: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: -spacing.sm,
  },
  flexText: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  mirrored: { transform: [{ scaleX: -1 }] },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  capsuleButton: {
    minHeight: visitShape.buttonHeight,
    borderRadius: visitShape.buttonRadius,
    paddingHorizontal: visitShape.cardPadding,
    paddingVertical: spacing.sm,
  },
  wordsButton: { minHeight: layout.touchTarget, paddingHorizontal: spacing.sm },
  wide: { flexGrow: 1, flexBasis: 0, paddingHorizontal: spacing.sm },
  pressed: { opacity: stateOpacity.pressed },
  disabled: { opacity: stateOpacity.disabled },
  pairRow: { flexDirection: 'row', gap: layout.controlGap },
  pairColumn: { flexDirection: 'column', gap: layout.controlGap },
  avatar: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs },
  dots: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: spacing.sm,
  },
  dot: { width: visitShape.dot, height: visitShape.dot, borderRadius: visitShape.dot / 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.controlGap,
    minHeight: layout.touchTarget,
    paddingVertical: spacing.sm,
  },
  highlighted: {
    borderRadius: visitShape.tileRadius,
    paddingHorizontal: spacing.sm,
    marginHorizontal: -spacing.sm,
  },
  rowWords: { flex: 1, gap: spacing.xs / 2 },
  rowValue: { flexShrink: 1 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: layout.touchTarget,
    borderRadius: visitShape.tileRadius,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: layout.touchTarget,
    fontSize: textStyles.body.fontSize,
    textAlign: 'auto',
  },
  clear: {
    minWidth: layout.touchTarget,
    minHeight: layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
