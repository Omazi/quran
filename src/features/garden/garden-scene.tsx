import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import type { GardenState } from '@/domain/garden';
import { Placeholder } from '@/ui';

import { GARDEN_SCENE_BAND_MIN_HEIGHT } from './config';
import { gardenSceneLabel, gardenSceneName } from './garden-words';

/**
 * How much room the scene takes. `band`: the width it is given and a band of height, as on the
 * home screen. `fill`: all the space of its parent, as on a page of the first-launch flow.
 */
export type GardenSceneSize = 'band' | 'fill';

export interface GardenSceneProps {
  /** The garden to show, exactly as the garden module describes it. */
  state: GardenState;
  size: GardenSceneSize;
}

/**
 * The garden on screen, and its only entry point (decision D12). It receives a `GardenState` and
 * a size, nothing else: the day real 3D models exist, only this component changes.
 *
 * In lot 1 nothing is drawn: a neutral, named placeholder stands for the image (SwiftUI Design,
 * principle 4), and its accessibility label says the state in words (voiceover.md ›
 * Descriptions). The state already holds what a renderer needs: continuous health, growth of the
 * next element, visible elements, variant.
 */
export function GardenScene({ state, size }: GardenSceneProps) {
  const { t } = useTranslation('garden');
  return (
    <Placeholder
      name={gardenSceneName(state, t)}
      accessibilityLabel={gardenSceneLabel(state, t)}
      style={styles[size]}
      testID="garden-scene"
    />
  );
}

const styles = StyleSheet.create({
  band: { alignSelf: 'stretch', minHeight: GARDEN_SCENE_BAND_MIN_HEIGHT },
  fill: { flex: 1 },
});
