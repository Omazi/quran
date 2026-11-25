import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Unsubscribe } from '@/domain/listening';
import { AppText, Button, layout, Screen, spacing } from '@/ui';

import { LISTENING_LAYOUT } from '../config';
import { Rosette } from '../rosette/rosette';

export interface ListeningViewProps {
  readonly subscribeToLevel: (listener: (level: number) => void) => Unsubscribe;
  readonly onStop: () => void;
  readonly reducedMotion: boolean;
}

/**
 * "Listening" (validated, D27 and D29): the whole screen listens. The rosette in the upper part,
 * the title below it, one button at the bottom. On the paper of the mushaf, light or dark as the
 * phone is (deviation 27).
 */
export function ListeningView({ subscribeToLevel, onStop, reducedMotion }: ListeningViewProps) {
  const { t } = useTranslation('listening');
  // The screen fills the window: its size is known before the first layout, so the first frame
  // is already drawn. The layout then gives the exact size.
  const window = useWindowDimensions();
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);
  const size = measured ?? window;
  const onLayout = ({ nativeEvent }: LayoutChangeEvent) =>
    setMeasured({ width: nativeEvent.layout.width, height: nativeEvent.layout.height });

  return (
    // The prototype measures the drawing on the whole screen, safe areas included: no edge here,
    // the button alone keeps clear of the home indicator.
    <Screen background="paper" edges={[]} testID="listening">
      <View style={styles.stage} onLayout={onLayout}>
        <Rosette
          width={size.width}
          height={size.height}
          subscribeToLevel={subscribeToLevel}
          reducedMotion={reducedMotion}
          testID="rosette"
        />
        <View style={[styles.title, { top: size.height * LISTENING_LAYOUT.titleTop }]}>
          <AppText variant="displayTitle" color="ink" align="center">
            {t('listening.title')}
          </AppText>
        </View>
        {/* The bottom inset (34 points on an iPhone without a home button, where the prototype
            puts the button), or a margin where there is none. */}
        <SafeAreaView edges={{ bottom: 'maximum' }} style={styles.action}>
          <Button
            label={t('listening.stop')}
            variant="secondary"
            onPress={onStop}
            testID="listening-stop"
          />
        </SafeAreaView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1 },
  title: { position: 'absolute', start: layout.screenMargin, end: layout.screenMargin },
  action: {
    position: 'absolute',
    bottom: 0,
    start: 0,
    end: 0,
    alignItems: 'center',
    paddingBottom: spacing.md,
  },
});
