import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  AppText,
  Icon,
  useColors,
  useColorValues,
  useElevation,
  voiceStoryLayout as L,
  type IconSymbol,
  type TextStyleName,
} from '@/ui';

import { STORY_MOTION } from '../config';

/** The strong ease-out of the prototype (`--ease-out`), for the settings' own small motions. */
const EASE_OUT = Easing.bezier(...STORY_MOTION.easeOutCurve);

/**
 * A button that behaves like a toggle, in a group of choices (toggles.md › Mobile (iOS, iPadOS):
 * "Outside of a list, use a button that behaves like a toggle, not a switch"): white, or filled
 * with the action green once chosen, its label and symbol white then (`.opt`). It scales down a
 * little under the finger (`:active`, 97 %, the press feedback of the session skill `animate`).
 */
export function ChoiceButton({
  label,
  symbol,
  isSelected,
  onPress,
  isSmall = false,
  testID,
}: {
  label: string;
  symbol?: IconSymbol;
  isSelected: boolean;
  onPress: () => void;
  isSmall?: boolean;
  testID?: string;
}) {
  const colors = useColors();
  const shadow = useElevation('card');
  const pressed = useSharedValue(0);
  const press = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - (1 - STORY_MOTION.pressScale) * pressed.get() }],
  }));
  const ease = (to: number) =>
    pressed.set(withTiming(to, { duration: STORY_MOTION.pressMs, easing: EASE_OUT }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => ease(1)}
      onPressOut={() => ease(0)}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={label}
      style={styles.choiceSlot}
      testID={testID}
    >
      <Animated.View
        style={[
          styles.choice,
          {
            minHeight: isSmall ? L.choiceSmallHeight : L.choiceHeight,
            backgroundColor: isSelected ? colors.action : colors.surface,
            boxShadow: shadow,
          },
          press,
        ]}
      >
        {symbol === undefined ? null : (
          <Icon symbol={symbol} color={isSelected ? 'onAction' : 'heading'} textStyle="subhead" />
        )}
        <AppText
          variant={(isSmall ? 'subheadEmphasized' : 'callout') satisfies TextStyleName}
          color={isSelected ? 'onAction' : 'heading'}
          numberOfLines={2}
          align="center"
        >
          {label}
        </AppText>
      </Animated.View>
    </Pressable>
  );
}

/** Two columns of choices (`.grid`), named for screen readers as one group. */
export function ChoiceGrid({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {children}
    </View>
  );
}

/** A white card of the settings (`.res`, `.list`). */
export function SettingsCard({
  children,
  isRow = false,
}: {
  children: ReactNode;
  isRow?: boolean;
}) {
  const colors = useColors();
  const shadow = useElevation('card');
  return (
    <View
      style={[
        styles.card,
        isRow && styles.cardRow,
        { backgroundColor: colors.surface, boxShadow: shadow },
      ]}
    >
      {children}
    </View>
  );
}

/**
 * A row with a switch, in a list card: the system's switch (`Switch`, UISwitch on iOS) in a list
 * row (toggles.md › Mobile: "Use the switch toggle style only in a list row"), filled with the
 * app's action green as the prototype draws it (toggles.md allows the app's accent).
 */
export function SwitchLine({
  label,
  value,
  onChange,
  isFirst,
  testID,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  isFirst: boolean;
  testID?: string;
}) {
  const colors = useColorValues();
  return (
    <View
      style={[
        styles.row,
        !isFirst && { borderTopColor: colors.divider, borderTopWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <AppText variant="body" color="heading" style={styles.rowLabel}>
        {label}
      </AppText>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.action, false: colors.track }}
        accessibilityLabel={label}
        testID={testID}
      />
    </View>
  );
}

/**
 * A figure that rolls when it changes (`.roll`): the old words leave upwards while the new ones
 * come from below, 260 ms with the strong ease-out; downwards when the figure decreases. With
 * "reduce motion" the words change in place.
 */
export function RollingText({
  text,
  direction,
  reducedMotion,
  children,
}: {
  /** What identifies the words: a change of it rolls them. */
  text: string;
  /** 1: up (the figure grew), -1: down. */
  direction: 1 | -1;
  reducedMotion: boolean;
  children: ReactNode;
}) {
  const [items, setItems] = useState<readonly { key: string; node: ReactNode }[]>([
    { key: text, node: children },
  ]);
  // A new figure: the one shown leaves while the new one comes (React's "adjusting state when a
  // prop changes", during render, rather than in an effect).
  const latest = items[items.length - 1];
  if (latest?.key !== text) {
    const entering = { key: text, node: children };
    setItems(reducedMotion || latest === undefined ? [entering] : [latest, entering]);
  }
  useEffect(() => {
    if (items.length < 2) return undefined;
    const timer = setTimeout(() => setItems((current) => current.slice(-1)), STORY_MOTION.rollMs);
    return () => clearTimeout(timer);
  }, [items]);
  return (
    <View style={styles.roll}>
      {items.map((item, index) => (
        <Rolling
          key={item.key}
          isLeaving={index < items.length - 1}
          isNew={items.length > 1 && index === items.length - 1}
          direction={direction}
        >
          {/* The figure shown now always takes the latest words; the leaving one keeps its own. */}
          {item.key === text ? children : item.node}
        </Rolling>
      ))}
    </View>
  );
}

function Rolling({
  isLeaving,
  isNew,
  direction,
  children,
}: {
  isLeaving: boolean;
  isNew: boolean;
  direction: 1 | -1;
  children: ReactNode;
}) {
  const progress = useSharedValue(isNew ? 0 : 1);
  useEffect(() => {
    if (isLeaving) progress.set(withTiming(2, { duration: STORY_MOTION.rollMs, easing: EASE_OUT }));
    else if (isNew)
      progress.set(withTiming(1, { duration: STORY_MOTION.rollMs, easing: EASE_OUT }));
  }, [isLeaving, isNew, progress]);
  const style = useAnimatedStyle(() => {
    const p = progress.get();
    const offset =
      p <= 1 ? (1 - p) * L.rollTravel * direction : -(p - 1) * L.rollTravel * direction;
    return { opacity: p <= 1 ? p : 2 - p, transform: [{ translateY: offset }] };
  });
  return <Animated.View style={[styles.rolling, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: L.choiceGap },
  choiceSlot: { flexBasis: '47%', flexGrow: 1 },
  choice: {
    borderRadius: L.choiceRadius,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: L.choiceIconGap,
    paddingHorizontal: L.choicePadding,
  },
  card: { borderRadius: L.cardRadius, paddingHorizontal: L.cardPadding },
  cardRow: { flexDirection: 'row', paddingVertical: L.cardPadding },
  row: { flexDirection: 'row', alignItems: 'center', gap: L.choiceGap, minHeight: L.rowMinHeight },
  rowLabel: { flex: 1 },
  roll: { minHeight: L.rollHeight, marginTop: L.rollGap, overflow: 'hidden' },
  rolling: { position: 'absolute', start: 0, top: 0, flexDirection: 'row', alignItems: 'baseline' },
});
