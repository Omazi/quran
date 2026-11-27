import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { GardenState } from '@/domain/garden';
import type { GardenStyleId } from '@/domain/levels';
import { baseAsset, GARDEN_PICTURE_ASPECT_RATIO, GardenScene } from '@/features/garden';
import { useColorValues } from '@/ui';

import { useGardenArt } from './use-garden-art';

/**
 * A garden of a style, as a picture inside something that already says what it is (a badge, a
 * card, a step of the path): hidden from VoiceOver, the container carries the words.
 */
export function GardenThumb({
  styleId,
  state,
  style,
  appearance,
}: {
  styleId: GardenStyleId;
  state: GardenState;
  style?: StyleProp<ViewStyle>;
  /** Fixes the appearance whatever the device's: for a picture that is always light. */
  appearance?: 'light' | 'dark';
}) {
  const { art, tint } = useGardenArt(styleId, { appearance });
  return (
    <View
      style={style}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <GardenScene state={state} size="band" anchor="center" art={art} tint={tint} />
    </View>
  );
}

/**
 * A garden to come: the shape of a bare plot in one quiet colour. It tells nothing of the garden
 * (the surprise of D46), only that a place is waiting.
 */
export function GardenSilhouette({ style }: { style?: StyleProp<ViewStyle> }) {
  const colors = useColorValues();
  return (
    <View
      style={[styles.silhouette, style]}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Image
        source={baseAsset('h00-f0')}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        tintColor={colors.dotEmpty}
        accessible={false}
        cachePolicy="memory"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  silhouette: { width: '100%', aspectRatio: GARDEN_PICTURE_ASPECT_RATIO },
});
