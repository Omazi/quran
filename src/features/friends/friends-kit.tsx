/**
 * The pieces of the Proches tab that the shared design system does not have: the page under its
 * sky, a row of a card, a pair of buttons that stacks at large text sizes, and the text field in
 * the field shape of the mockups (docs/design/visite.png, accueil.png, bienvenue.png). Cards,
 * buttons, avatars, rows of dots, text and symbols are the shared components of src/ui, in the
 * one palette (tokens `palette`, D39).
 */

import { type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import {
  AppText,
  getWritingDirection,
  Icon,
  layout,
  radius,
  spacing,
  stateOpacity,
  TEXT_FIELD_BEHAVIOURS,
  textStyles,
  useBackdropGradient,
  useColors,
  useColorValues,
  type IconSymbol,
  type TextColorRole,
  type TextFieldRowProps,
} from '@/ui';

// --- Surfaces --------------------------------------------------------------------------------

/**
 * `visit`: the sky of the visit, warm at the top, sage at the bottom: the home screen's garden
 * gradient (`backdropGradients.growing`, visite.png). `page`: the same warm top fading into the
 * canvas, as under the home screen's cards (accueil.png).
 */
export type FriendsSky = 'visit' | 'page';

export function useSkyStyle(sky: FriendsSky): ViewStyle {
  const colors = useColorValues();
  const growing = useBackdropGradient('growing');
  if (sky === 'visit') {
    const stops = growing.map(([offset, color]) => `${color} ${offset * 100}%`).join(', ');
    const [, bottom] = growing[growing.length - 1] ?? [1, colors.canvas];
    return { backgroundColor: bottom, backgroundImage: `linear-gradient(180deg, ${stops})` };
  }
  return {
    backgroundColor: colors.canvas,
    backgroundImage: `linear-gradient(180deg, ${colors.skyTop} 0%, ${colors.canvas} 45%, ${colors.canvas} 100%)`,
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

/** A hairline between two rows of a card. */
export function FriendsSeparator() {
  const colors = useColors();
  return <View style={[styles.separator, { backgroundColor: colors.divider }]} />;
}

// --- Buttons ---------------------------------------------------------------------------------

/**
 * Two buttons side by side at the same size (`ActionButton` with `grows`), stacked at large text
 * sizes so that their labels keep whole words (buttons.md › Style: style, not size, tells the
 * preferred one; typography.md › Supporting Dynamic Type).
 */
export function FriendsButtonPair({ children }: { children: ReactNode }) {
  const { fontScale } = useWindowDimensions();
  const isSideBySide = fontScale <= layout.sideBySideMaxFontScale;
  return <View style={isSideBySide ? styles.pairRow : styles.pairColumn}>{children}</View>;
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
  labelColor = 'label',
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
  labelColor?: TextColorRole;
  isHighlighted?: boolean;
  testID?: string;
}) {
  const colors = useColors();
  const isMirrored = getWritingDirection() === 'rtl';
  const content = (
    <>
      {leading}
      <View style={styles.rowWords}>
        <AppText color={labelColor}>{label}</AppText>
        {detail === undefined ? null : (
          <AppText variant="subhead" color="muted">
            {detail}
          </AppText>
        )}
      </View>
      {value === undefined ? null : (
        <AppText color="muted" style={styles.rowValue}>
          {value}
        </AppText>
      )}
      {trailing}
      {onPress === undefined ? null : (
        // The chevron points the way of reading (right-to-left.md › Flip controls that show
        // progress).
        <View style={isMirrored ? styles.mirrored : undefined}>
          <Icon symbol={CHEVRON} textStyle="footnote" color="muted" />
        </View>
      )}
    </>
  );
  const rowStyle = [
    styles.row,
    isHighlighted && [styles.highlighted, { backgroundColor: colors.actionTonal }],
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
  const colors = useColors();
  const behaviour = TEXT_FIELD_BEHAVIOURS[kind];
  return (
    <View style={[styles.field, { backgroundColor: colors.field }]}>
      {kind === 'search' ? <Icon symbol={SEARCH_SYMBOL} color="muted" /> : null}
      <TextInput
        accessibilityLabel={label}
        placeholder={placeholder ?? label}
        placeholderTextColor={colors.muted}
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
        selectionColor={colors.actionTint}
        testID={testID}
        style={[styles.input, { color: colors.label }]}
      />
      {kind === 'search' && value !== '' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={clearLabel ?? label}
          onPress={() => onChange('')}
          style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
        >
          <Icon symbol={CLEAR_SYMBOL} color="muted" />
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
  separator: { height: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  mirrored: { transform: [{ scaleX: -1 }] },
  pressed: { opacity: stateOpacity.pressed },
  pairRow: { flexDirection: 'row', gap: layout.controlGap },
  pairColumn: { flexDirection: 'column', gap: layout.controlGap },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.controlGap,
    minHeight: layout.touchTarget,
    paddingVertical: spacing.sm,
  },
  highlighted: {
    borderRadius: radius.md,
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
    borderRadius: radius.md,
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
