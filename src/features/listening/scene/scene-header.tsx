import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout, listeningShape, spacing, useListeningColors, type IconSymbol } from '@/ui';

import { RoundButton } from './round-button';
import { SceneText } from './scene-text';

export const BACK_SYMBOL: IconSymbol = { ios: 'chevron.backward', android: 'chevron_left' };

export interface SceneHeaderProps {
  readonly title: string;
  /** The sentence under the title, while the screen listens. */
  readonly subtitle?: string;
  readonly backLabel: string;
  readonly onBack: () => void;
}

/**
 * The top of the recognition scene (shazam.png): a round back button at the leading edge, the
 * title centred on the same line, the sentence under it. The title is the screen's heading for
 * screen readers (voiceover.md › Navigation); the back button points the other way in Arabic
 * (right-to-left.md › Controls).
 */
export function SceneHeader({ title, subtitle, backLabel, onBack }: SceneHeaderProps) {
  const colors = useListeningColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
      <View style={styles.bar}>
        <View style={styles.side}>
          <RoundButton
            symbol={BACK_SYMBOL}
            accessibilityLabel={backLabel}
            onPress={onBack}
            background={colors.sceneControl}
            foreground={colors.onScene}
            isDirectional
            testID="listening-back"
          />
        </View>
        <SceneText
          variant="headline"
          color={colors.onScene}
          align="center"
          isHeading
          numberOfLines={2}
          style={styles.title}
        >
          {title}
        </SceneText>
        <View style={styles.side} />
      </View>
      {subtitle === undefined ? null : (
        <SceneText
          variant="subhead"
          color={colors.onSceneSecondary}
          align="center"
          style={styles.subtitle}
        >
          {subtitle}
        </SceneText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: layout.screenMargin - spacing.xs },
  bar: { flexDirection: 'row', alignItems: 'center', minHeight: listeningShape.sceneButtonHit },
  // Both sides as wide as the button, so the title stays centred on the screen.
  side: { width: listeningShape.sceneButtonHit },
  title: { flex: 1 },
  subtitle: { marginTop: spacing.xl, paddingHorizontal: layout.screenMargin },
});
