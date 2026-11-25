import { StatusBar } from 'expo-status-bar';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listeningShape, spacing } from '@/ui';

import { SceneBackdrop } from './scene-backdrop';
import { SceneHeader, type SceneHeaderProps } from './scene-header';
import { VOICE_ORB_FIELD, VoiceOrb, type VoiceOrbProps } from './voice-orb';

/** The most height the card may take: from under the rings to the bottom margin. */
const CardRoom = createContext<number>(Number.POSITIVE_INFINITY);

/** The room the stage leaves its card (`ResultCard` reads it). */
export function useCardRoom(): number {
  return useContext(CardRoom);
}

export interface ListeningStageProps {
  readonly header: SceneHeaderProps;
  readonly orb: Omit<VoiceOrbProps, 'testID'>;
  /** The result card. Absent while the screen listens. */
  readonly card?: ReactNode;
  readonly testID: string;
}

/**
 * The recognition scene of shazam.png, the same in every state: the green ground and its
 * lattice, the title, the gold microphone in its rings at the same place, and, once there is a
 * result, the white card at the bottom. The scene never turns into another screen: only the
 * card comes and goes.
 */
export function ListeningStage({ header, orb, card, testID }: ListeningStageProps) {
  const insets = useSafeAreaInsets();
  // The screen fills the window: its size is known before the first layout, so the first frame
  // is already drawn in place. The layout then gives the exact size.
  const window = useWindowDimensions();
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);
  const size = measured ?? window;
  const onLayout = ({ nativeEvent }: LayoutChangeEvent) =>
    setMeasured({ width: nativeEvent.layout.width, height: nativeEvent.layout.height });

  const orbCentre = size.height * listeningShape.orbCentreY;
  const bottom = Math.max(insets.bottom - spacing.sm, listeningShape.cardMargin);
  const cardTopLimit = orbCentre + (listeningShape.ringRadii[0] ?? 0) + spacing.md;
  const cardMaxHeight = Math.max(0, size.height - bottom - cardTopLimit);

  return (
    <View style={styles.stage} onLayout={onLayout} testID={testID}>
      {/* Light symbols in the status bar, on the deep green. */}
      <StatusBar style="light" />
      <SceneBackdrop />
      <View
        style={[styles.orbLine, { top: orbCentre - VOICE_ORB_FIELD / 2 }]}
        pointerEvents="box-none"
      >
        <VoiceOrb {...orb} testID="listening-voice" />
      </View>
      <SceneHeader {...header} />
      {card === undefined ? null : (
        <View style={[styles.card, { bottom }]} pointerEvents="box-none">
          <CardRoom.Provider value={cardMaxHeight}>{card}</CardRoom.Provider>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, overflow: 'hidden' },
  // A full-width line, centred on the microphone: the orb is centred on it in both directions.
  orbLine: { position: 'absolute', start: 0, end: 0, alignItems: 'center' },
  card: {
    position: 'absolute',
    start: listeningShape.cardMargin,
    end: listeningShape.cardMargin,
  },
});
