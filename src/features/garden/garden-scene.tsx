import { Image, type ImageContentPosition } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import type { GardenState } from '@/domain/garden';
import { Placeholder } from '@/ui';

import { FadingLayer } from './fading-layer';
import {
  GARDEN_PICTURE_ASPECT_RATIO,
  GARDEN_PICTURE_POSITION,
  GARDEN_SCENE_BAND_MIN_HEIGHT,
} from './config';
import { baseAsset, SHIPPED_GARDEN_IMAGES, waterAsset } from './garden-images';
import { gardenPicture, pictureNames, type GardenImageNames } from './garden-picture';
import { gardenSceneLabel, gardenSceneName } from './garden-words';
import { GrowingSprite } from './growing-sprite';
import { growingTarget } from './growth-motion';
import { useGardenPictureSequence } from './use-garden-picture';

/**
 * How much room the scene takes. `band`: the width it is given and the height its picture
 * needs, as on the home screen. `fill`: all the space of its parent, as on a page of the
 * first-launch flow; the picture is shown whole inside it, resting on its bottom edge, so that
 * what follows the scene sits right under the garden and the free space, if any, is above it.
 */
export type GardenSceneSize = 'band' | 'fill';

export interface GardenSceneProps {
  /** The garden to show, exactly as the garden module describes it. */
  state: GardenState;
  size: GardenSceneSize;
  /** Where the picture rests in a taller box (`fill`): its bottom edge (default) or the middle. */
  anchor?: 'bottom' | 'center';
  /** Which pictures exist. Only tests give it: the app uses the set that ships with it. */
  images?: GardenImageNames;
}

/** One layer of the picture: a rendered image, as tall and wide as the scene, never cropped. */
function Layer({
  asset,
  transitionMs,
  position,
}: {
  asset: number | undefined;
  transitionMs: number;
  position: ImageContentPosition;
}) {
  if (asset === undefined) return null;
  return (
    <Image
      source={asset}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      contentPosition={position}
      // The garden is described once, by the scene: the layers are not elements of their own.
      accessible={false}
      // A fade between two pictures; none when the picture comes at once.
      transition={transitionMs > 0 ? { duration: transitionMs, effect: 'cross-dissolve' } : null}
      // Local files: nothing to wait for, nothing to keep once the scene is gone.
      cachePolicy="memory"
    />
  );
}

/**
 * The garden on screen, and its only entry point (decision D12). It receives a `GardenState` and
 * a size, nothing else: the day a 3D engine exists, only this component changes.
 *
 * It shows the picture of the level-1 garden that matches the state (`gardenPicture`): the dry
 * garden and the water laid over it. The element of the hizb in progress is drawn over it from
 * its first counted page, smaller while it grows, one step per stage (owner, 25 November 2026,
 * replacing D35's "only when its hizb is complete"; `GrowingSprite`). Only those images are loaded. When the state jumps
 * several steps the pictures in between are shown in order (D26); with "reduce motion" the final
 * one comes at once. When the set lacks a picture the state needs, a neutral named placeholder
 * stands in, never a broken image. The accessibility label says the state in words either way
 * (voiceover.md › Descriptions).
 */
export function GardenScene({
  state,
  size,
  anchor = 'bottom',
  images = SHIPPED_GARDEN_IMAGES,
}: GardenSceneProps) {
  const { t } = useTranslation('garden');
  const target = gardenPicture(state, { images });
  const { picture, transitionMs } = useGardenPictureSequence(target, images);
  const label = gardenSceneLabel(state, t);
  const position = anchor === 'center' ? 'center' : GARDEN_PICTURE_POSITION;
  const [box, setBox] = useState({ width: 0, height: 0 });
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBox({ width, height });
  };
  const growing = growingTarget(state);

  if (picture === null) {
    return (
      <Placeholder
        name={gardenSceneName(state, t)}
        accessibilityLabel={label}
        style={[styles[size], styles.placeholder]}
        testID="garden-scene"
      />
    );
  }

  const names = pictureNames(picture);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={styles[size]}
      onLayout={onLayout}
      testID="garden-scene"
    >
      <Layer asset={baseAsset(names.base)} transitionMs={transitionMs} position={position} />
      <FadingLayer
        asset={names.water === null ? undefined : waterAsset(names.water)}
        transitionMs={transitionMs}
        position={position}
      />
      {
        // Drawn once the pictures show every element before it (not during a walk of steps).
        growing !== null && picture.stage.count === growing.hizb - 1 ? (
          <GrowingSprite hizb={growing.hizb} growth={growing.growth} box={box} anchor={anchor} />
        ) : null
      }
    </View>
  );
}

const styles = StyleSheet.create({
  band: { alignSelf: 'stretch', aspectRatio: GARDEN_PICTURE_ASPECT_RATIO },
  fill: { flex: 1 },
  // A minimum, never a fixed height: the name can wrap at the largest text sizes.
  placeholder: { minHeight: GARDEN_SCENE_BAND_MIN_HEIGHT },
});
