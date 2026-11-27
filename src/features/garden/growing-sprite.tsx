import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet } from 'react-native';

import { useReducedMotion } from '@/ui';

import { GARDEN_PICTURE_SIZE } from './config';
import type { GardenSpriteArt } from './garden-art';
import { pictureRect, pictureStep } from './growth-pose';

export interface GrowingSpriteProps {
  /** The element growing, cut from its garden's pictures (none: nothing is drawn), and how far. */
  sprite: GardenSpriteArt | undefined;
  growth: number;
  /** The size of the scene, once laid out. */
  box: { readonly width: number; readonly height: number };
  anchor: 'bottom' | 'center';
}

/**
 * A step takes this long: an entrance, ease-out (animate skill), the animate skill's strong
 * curve `cubic-bezier(0.23, 1, 0.32, 1)`.
 */
const STEP_MS = 450;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/**
 * The element of the hizb in progress on the picture fallback (no GL), from its first counted
 * page: its sprite, cut from the pictures, drawn over the garden smaller and from its foot while
 * it grows, one step per stage of its growth (`pictureStep`). A step grows into the next; with
 * Reduce Motion it comes at once. Not an element of its own for VoiceOver: the scene says it.
 */
export function GrowingSprite({ sprite, growth, box, anchor }: GrowingSpriteProps) {
  const isMotionReduced = useReducedMotion();
  const step = pictureStep(growth);
  const target = step?.scale ?? 0;
  const [scale] = useState(() => new Animated.Value(target));

  useEffect(() => {
    if (isMotionReduced) {
      scale.setValue(target);
      return undefined;
    }
    const grow = Animated.timing(scale, {
      toValue: target,
      duration: STEP_MS,
      easing: EASE_OUT,
      useNativeDriver: Platform.OS !== 'web',
    });
    grow.start();
    return () => grow.stop();
  }, [target, isMotionReduced, scale]);

  if (sprite === undefined || step === null || box.width === 0) return null;
  const picture = pictureRect(box, GARDEN_PICTURE_SIZE.width / GARDEN_PICTURE_SIZE.height, anchor);
  const k = picture.width / GARDEN_PICTURE_SIZE.width;
  return (
    <Animated.View
      pointerEvents="none"
      testID="garden-growing-sprite"
      style={[
        styles.sprite,
        {
          left: picture.x + sprite.x * k,
          top: picture.y + sprite.y * k,
          width: sprite.width * k,
          height: sprite.height * k,
          // It grows from its foot.
          transformOrigin: [(sprite.footX - sprite.x) * k, (sprite.footY - sprite.y) * k, 0],
          transform: [{ scale }],
        },
      ]}
    >
      <Image
        source={sprite.source}
        style={StyleSheet.absoluteFill}
        contentFit="fill"
        accessible={false}
        cachePolicy="memory"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sprite: { position: 'absolute' },
});
