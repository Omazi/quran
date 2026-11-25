import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Pressable, StyleSheet, View, type AccessibilityActionEvent } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { layout } from '../tokens';
import { useColorValues, useElevation } from '../use-colors';
import { PAGE_DOTS, pageDotShape } from './page-dots-shape';

export interface PageDotsProps {
  count: number;
  /** Zero-based index of the page shown. */
  index: number;
  /** The position of the pager (`SwipePager`): the dots follow it as the pages pass. */
  position: SharedValue<number>;
  /** Shows the page before or after; the pager slides to it. */
  onChange: (index: number) => void;
  /**
   * From 0 to 1, how much the page under the dots is the deep green of the listening page: the
   * dots and their capsule then take their light values, as the prototype's do (`.app.dark`).
   */
  onDeep?: SharedValue<number>;
  /** Names the control for screen readers ("Présentation"). */
  accessibilityLabel: string;
  /** The position as people hear it ("Page 3 sur 15"). */
  accessibilityValue: string;
  testID?: string;
}

/**
 * Whether the system's Liquid Glass can be drawn: iOS 26 and later. It falls back on its own to an
 * opaque look when the person reduces transparency (liquid-glass.md › Which variant).
 */
function systemGlassIsAvailable(): boolean {
  try {
    return isLiquidGlassAvailable();
  } catch {
    // No native module (tests, a platform without it): the drawn capsule.
    return false;
  }
}

/**
 * The page control of the first launch, drawn as the validated prototype draws it
 * (docs/design/premier-lancement-prototype.html, `.pc`): equidistant dots, the current page a
 * longer dot in the ink colour, the others the same ink, faint; the dots far from the current page
 * shrink and then disappear (page-controls.md › Mobile). It always shows its capsule, the style
 * for a page control that is the main navigation of a screen (page-controls.md › Mobile,
 * "Prominent"): on iOS 26 the system's glass, since the control floats over the content
 * (liquid-glass.md › Where the material belongs); elsewhere a translucent capsule with a bright
 * edge. Centred at the bottom (page-controls.md › Best practices); never coloured.
 *
 * A tap on the leading or the trailing side of the current dot shows the page before or after
 * (page-controls.md › Mobile). Screen readers get one adjustable element, which says where the
 * person is and turns the pages without a swipe (gestures.md › Best practices).
 */
export function PageDots({
  count,
  index,
  position,
  onChange,
  onDeep,
  accessibilityLabel,
  accessibilityValue,
  testID,
}: PageDotsProps) {
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    throw new RangeError(`There is no page ${index} among ${count} dots.`);
  }
  const palette = useColorValues();
  const deep = useColorValues('dark');
  const shadow = useElevation('card');
  const hasGlass = systemGlassIsAvailable();
  const hasPrevious = index > 0;
  const hasNext = index < count - 1;
  const showPrevious = () => {
    if (hasPrevious) onChange(index - 1);
  };
  const showNext = () => {
    if (hasNext) onChange(index + 1);
  };
  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment') showNext();
    if (event.nativeEvent.actionName === 'decrement') showPrevious();
  };

  const capsuleLook = useAnimatedStyle(() => {
    const amount = onDeep?.value ?? 0;
    return {
      backgroundColor: interpolateColor(
        amount,
        [0, 1],
        [palette.pageDotsSurface, deep.pageDotsSurface],
      ),
      borderColor: interpolateColor(amount, [0, 1], [palette.pageDotsEdge, deep.pageDotsEdge]),
    };
  });

  return (
    <View style={styles.frame} pointerEvents="box-none">
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ text: accessibilityValue }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onAccessibilityAction}
        testID={testID}
        style={styles.control}
      >
        {hasGlass ? (
          <GlassView glassEffectStyle="regular" style={[StyleSheet.absoluteFill, styles.capsule]} />
        ) : (
          // The soft shadow of the prototype, by day only (`elevation.card`).
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.capsule,
              styles.drawnCapsule,
              { boxShadow: shadow },
              capsuleLook,
            ]}
          />
        )}
        <View style={styles.dots}>
          {Array.from({ length: count }, (_, dot) => (
            <Dot
              key={dot}
              dot={dot}
              position={position}
              onDeep={onDeep}
              colors={{
                dot: palette.pageDot,
                current: palette.pageDotCurrent,
                deepDot: deep.pageDot,
                deepCurrent: deep.pageDotCurrent,
              }}
            />
          ))}
        </View>
        <Pressable
          accessible={false}
          disabled={!hasPrevious}
          onPress={showPrevious}
          style={[styles.half, styles.leadingHalf]}
          testID={testID === undefined ? undefined : `${testID}-previous`}
        />
        <Pressable
          accessible={false}
          disabled={!hasNext}
          onPress={showNext}
          style={[styles.half, styles.trailingHalf]}
          testID={testID === undefined ? undefined : `${testID}-next`}
        />
      </View>
    </View>
  );
}

interface DotProps {
  dot: number;
  position: SharedValue<number>;
  onDeep?: SharedValue<number>;
  colors: { dot: string; current: string; deepDot: string; deepCurrent: string };
}

function Dot({ dot, position, onDeep, colors }: DotProps) {
  const look = useAnimatedStyle(() => {
    const shape = pageDotShape(dot - position.value);
    const amount = onDeep?.value ?? 0;
    const normal = interpolateColor(shape.emphasis, [0, 1], [colors.dot, colors.current]);
    const overDeep = interpolateColor(shape.emphasis, [0, 1], [colors.deepDot, colors.deepCurrent]);
    return {
      width: shape.width,
      height: shape.height,
      borderRadius: shape.height / 2,
      // Equal on both sides, so the same in both writing directions. (`marginHorizontal` set from
      // the UI thread does not reach the web's styles.)
      marginLeft: shape.spacing / 2,
      marginRight: shape.spacing / 2,
      backgroundColor: interpolateColor(amount, [0, 1], [normal, overDeep]),
    };
  });
  return <Animated.View style={look} />;
}

const styles = StyleSheet.create({
  frame: { alignItems: 'center' },
  // Taller than the capsule: each half is a full touch target (accessibility.md › Mobility).
  control: {
    minHeight: layout.touchTarget,
    justifyContent: 'center',
    paddingHorizontal: PAGE_DOTS.capsulePadding - PAGE_DOTS.gap / 2,
  },
  capsule: {
    top: (layout.touchTarget - PAGE_DOTS.capsuleHeight) / 2,
    bottom: (layout.touchTarget - PAGE_DOTS.capsuleHeight) / 2,
    borderRadius: PAGE_DOTS.capsuleHeight / 2,
  },
  drawnCapsule: { borderWidth: StyleSheet.hairlineWidth },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    height: PAGE_DOTS.capsuleHeight,
  },
  half: { position: 'absolute', top: 0, bottom: 0, width: '50%' },
  leadingHalf: { start: 0 },
  trailingHalf: { end: 0 },
});
