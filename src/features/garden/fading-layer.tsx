import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet } from 'react-native';

import { GARDEN_PICTURE_POSITION } from './config';

export interface FadingLayerProps {
  /** The picture, or undefined when this layer has nothing to show. */
  asset: number | undefined;
  /** How long a change takes, in milliseconds. 0: at once, with no fade at all. */
  transitionMs: number;
}

/**
 * A layer of the scene that can be there or not: the water, which leaves first when the garden
 * dries (D26). The picture fades out before it is removed, and fades in when it comes back;
 * from one picture to another the image itself dissolves. With no transition time, it appears
 * and disappears at once. The fade is on opacity only: nothing moves.
 */
export function FadingLayer({ asset, transitionMs }: FadingLayerProps) {
  const [opacity] = useState(() => new Animated.Value(asset === undefined ? 0 : 1));
  // The last picture shown, kept on screen while it fades out.
  const [kept, setKept] = useState(asset);
  if (asset !== undefined && asset !== kept) setKept(asset);

  useEffect(() => {
    const target = asset === undefined ? 0 : 1;
    if (transitionMs <= 0) {
      opacity.setValue(target);
      return undefined;
    }
    const fade = Animated.timing(opacity, {
      toValue: target,
      duration: transitionMs,
      useNativeDriver: Platform.OS !== 'web',
    });
    fade.start(({ finished }) => {
      if (finished && asset === undefined) setKept(undefined);
    });
    return () => fade.stop();
  }, [asset, transitionMs, opacity]);

  // Without a fade, a layer that has nothing to show is not drawn at all.
  if (kept === undefined || (asset === undefined && transitionMs <= 0)) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
      <Image
        source={kept}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        contentPosition={GARDEN_PICTURE_POSITION}
        accessible={false}
        transition={transitionMs > 0 ? { duration: transitionMs, effect: 'cross-dissolve' } : null}
        cachePolicy="memory"
      />
    </Animated.View>
  );
}
