import { StyleSheet, View } from 'react-native';

import type { GardenState } from '@/domain/garden';
import { GardenView3D } from '@/features/garden';
import { useGardenArt, useProgression } from '@/features/gardens';
import { spacing } from '@/ui';

export interface GardenStageProps {
  garden: GardenState;
  /** The home screen is in front (not under the reader): the growth plays when it is. */
  isActive?: boolean;
}

/**
 * The garden, edge to edge on its gradient (the signature of the screen; charter, section 1), in
 * 3D: it turns under the finger and zooms with a pinch (D40), the garden of the person's level
 * (D46). Nothing is laid over it: what grows
 * is said on the line under it (`GardenProgress`; maquettes 2026-11-26, 1A, chosen by the owner).
 * The garden itself is never mirrored (right-to-left.md › Images).
 */
export function GardenStage({ garden, isActive = true }: GardenStageProps) {
  // The garden of the person's level (D46): its own once downloaded, the placeholder until then.
  const progression = useProgression();
  const { art, tint } = useGardenArt(progression?.styleId ?? null);
  return (
    <View style={styles.stage} testID="home-garden-stage">
      <GardenView3D
        state={garden}
        playsGrowth
        isActive={isActive}
        art={art}
        tint={tint}
        testID="home-garden-3d"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { alignSelf: 'stretch', marginTop: spacing.md },
});
