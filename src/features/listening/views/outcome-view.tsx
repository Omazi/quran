import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText, Button, layout, Screen, spacing } from '@/ui';

import { LISTENING_LAYOUT } from '../config';
import { rosetteFrame } from '../rosette/rosette-geometry';
import { StillRosette } from '../rosette/still-rosette';
import { ResultActions, ScrollEdgeFade } from './result-layout';

export interface OutcomeViewProps {
  readonly title: string;
  readonly description: string;
  /**
   * The next step: listen again, or open the settings. The one prominent button. Absent when no
   * step here can help (a missing voice model): closing is then the one button.
   */
  readonly action?: { readonly label: string; readonly onPress: () => void };
  readonly closeLabel: string;
  readonly onClose: () => void;
  readonly testID: string;
}

/**
 * A listening that ends without a passage. The screen does not turn into another one: it is the
 * listening screen at rest. The rosette stays where it was, at its size, and stops moving; the
 * title takes the place of "À l'écoute…" and says what happened, the sentence under it what to
 * do, without blame (writing.md › Best practices: clear error messages, clear next steps); the
 * buttons sit where "Arrêter" was. The one next step is the prominent button, closing is plain
 * (buttons.md › Style).
 *
 * At the largest text sizes the words scroll under the rosette, and the buttons stay in view
 * (layout.md › Adaptability).
 */
export function OutcomeView({
  title,
  description,
  action,
  closeLabel,
  onClose,
  testID,
}: OutcomeViewProps) {
  // Measured as the listening screen measures itself, so the rosette does not move.
  const window = useWindowDimensions();
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);
  const size = measured ?? window;
  const onLayout = ({ nativeEvent }: LayoutChangeEvent) =>
    setMeasured({ width: nativeEvent.layout.width, height: nativeEvent.layout.height });
  const { cy, radius } = rosetteFrame(size.width, size.height);

  return (
    // No safe-area edge, as on the listening screen: the drawing is placed on the whole screen.
    <Screen background="paper" edges={[]} testID={testID}>
      <View style={styles.stage} onLayout={onLayout}>
        <View style={styles.stage}>
          <ScrollView alwaysBounceVertical={false} style={styles.stage}>
            <View style={{ height: size.height * LISTENING_LAYOUT.titleTop }}>
              <View style={[styles.rosetteLine, { top: cy }]}>
                <StillRosette radius={radius} testID="still-rosette" />
              </View>
            </View>
            <View style={styles.words}>
              <AppText variant="displayTitle" color="ink" align="center">
                {title}
              </AppText>
              <AppText color="inkSecondary" align="center">
                {description}
              </AppText>
            </View>
          </ScrollView>
          <ScrollEdgeFade />
        </View>
        <SafeAreaView edges={{ bottom: 'maximum' }} style={styles.actions}>
          {action === undefined ? (
            <ResultActions
              primary={<Button label={closeLabel} variant="primary" onPress={onClose} />}
              plain={null}
            />
          ) : (
            <ResultActions
              primary={<Button label={action.label} variant="primary" onPress={action.onPress} />}
              plain={<Button label={closeLabel} variant="plain" onPress={onClose} />}
            />
          )}
        </SafeAreaView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1 },
  // A line of no height at the centre of the rosette: the rosette is centred on it.
  rosetteLine: {
    position: 'absolute',
    start: 0,
    end: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  words: {
    paddingHorizontal: layout.screenMargin,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  actions: {
    paddingHorizontal: layout.screenMargin,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
});
