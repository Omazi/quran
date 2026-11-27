import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { LocalDate } from '@/domain/shared/local-date';
import {
  GardenView3D,
  gardenLifeOf,
  mixHex,
  type GardenControls,
  type LivingGarden,
} from '@/features/garden';
import {
  AppearanceScope,
  ScrollEdgeVeil,
  SkyGradient,
  layout,
  spacing,
  useReducedMotion,
} from '@/ui';

import { HOME_MOTION } from './config';
import { playFeedback } from './feedback-events';
import { StatePreviewSection } from './state-preview';
import { FriendsChip } from './friends-chip';
import { GardenPanel } from './garden-panel';
import { HomeHeader } from './home-header';
import type { HomeActions, HomeReadyModel } from './home-model';
import type { NeighbourGardens } from './neighbours';
import { useSkyChrome, type SkyChrome } from './use-sky-chrome';

export interface LivingHomeProps {
  model: HomeReadyModel;
  actions: HomeActions;
  today: LocalDate;
  neighbours: NeighbourGardens;
  avatarInitial: string | null;
  /** The screen is in front: the garden lives, and its growth plays, only then. */
  isFocused: boolean;
  /** Tests give a sky; the app follows the real local hour. */
  chrome?: SkyChrome;
}

/**
 * The home screen as the owner validated it (docs/design/maquette-wow, 27 November 2026): the
 * garden itself, full screen under the sky of the real hour, edge to edge under the status bar,
 * and no word on it (charter, section 1: the garden is the signature). What the person needs
 * floats over it on glass (liquid-glass.md › Where the material belongs): at the top the day,
 * the title, the streak, the profile and a friend's news; at the bottom the panel of what grows,
 * the day's watering and the two actions. The tab bar stays, the system's.
 *
 * Back from reading, when the garden grew, the camera glides to the plant, which grows one step
 * with a ripple of light, then comes back (`GardenSurface`); the top steps aside meanwhile. Any
 * touch stops it (motion.md › Let people cancel motion).
 */
export function LivingHome({
  model,
  actions,
  today,
  neighbours,
  avatarInitial,
  isFocused,
  chrome: givenChrome,
}: LivingHomeProps) {
  const skyChrome = useSkyChrome();
  const chrome = givenChrome ?? skyChrome;
  const { sky, appearance } = chrome;
  const isMotionReduced = useReducedMotion();
  const visibleElements = model.garden.visibleElements;
  const life = useMemo(
    () => gardenLifeOf(visibleElements, { isLowPower: false, isMotionReduced }),
    [visibleElements, isMotionReduced],
  );

  const controls = useRef<GardenControls | null>(null);
  const onControlsReady = useCallback((next: GardenControls | null) => {
    controls.current = next;
  }, []);
  const away = useSharedValue(0);
  const onGlideChange = useCallback(
    (isGliding: boolean) => {
      away.value = withTiming(isGliding ? 1 : 0, {
        duration: isGliding ? HOME_MOTION.topOutMs : HOME_MOTION.topInMs,
      });
    },
    [away],
  );
  const onGrow = useCallback(() => playFeedback('grow'), []);
  const living = useMemo<LivingGarden>(
    () => ({ sky, life, onGrow, onGlideChange, onControlsReady }),
    [sky, life, onGrow, onGlideChange, onControlsReady],
  );
  const topStyle = useAnimatedStyle(() => ({
    opacity: 1 - away.value,
    transform: [{ translateY: -HOME_MOTION.topShift * away.value }],
  }));

  return (
    <View style={styles.screen} testID="home">
      <SkyGradient
        top={sky.top}
        mid={sky.mid}
        low={sky.low}
        bottom={mixHex(sky.low, sky.mid, 0.25)}
      />
      <View style={StyleSheet.absoluteFill} testID="home-garden-layer">
        <GardenView3D
          state={model.garden}
          playsGrowth
          isActive={isFocused}
          living={living}
          hintPlacement="none"
          testID="home-garden-3d"
        />
      </View>
      <AppearanceScope appearance={appearance}>
        {isFocused ? <StatusBar style={appearance === 'dark' ? 'light' : 'dark'} /> : null}
        <ScrollEdgeVeil appearance={appearance} opacity={chrome.headerVeil} style={styles.veil} />
        <SafeAreaView
          edges={['top', 'bottom', 'left', 'right']}
          style={StyleSheet.absoluteFill}
          pointerEvents="box-none"
          onTouchStart={() => controls.current?.interrupt()}
          testID="home-overlay"
        >
          <Animated.View style={[styles.top, topStyle]} pointerEvents="box-none">
            <HomeHeader
              today={today}
              streakDays={model.streakDays}
              avatarInitial={avatarInitial}
              onOpenProfile={actions.openProfile}
              glass={{ appearance, veil: chrome.chipVeil }}
            />
            <View style={styles.friends} pointerEvents="box-none">
              <FriendsChip
                neighbours={neighbours}
                appearance={appearance}
                veil={chrome.chipVeil}
                onOpenFriend={actions.openFriend}
              />
            </View>
          </Animated.View>
          {/* The garden shows through here: nothing is laid over it. */}
          <View style={styles.room} pointerEvents="none" />
          <ScrollView
            style={styles.panelScroll}
            contentContainerStyle={styles.panelContent}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            <GardenPanel
              model={model}
              appearance={appearance}
              veil={chrome.panelVeil}
              onRead={actions.readAndWater}
              onRecognize={actions.recognize}
              onLookAtGrowth={() => controls.current?.lookAtGrowth()}
            />
            {/* Development and test builds only: the preview of the garden's states. */}
            {StatePreviewSection === null ? null : <StatePreviewSection />}
          </ScrollView>
        </SafeAreaView>
      </AppearanceScope>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  veil: { position: 'absolute', top: 0, start: 0, end: 0, height: layout.homeHeaderVeil },
  top: { rowGap: spacing.md },
  friends: { paddingHorizontal: layout.screenMargin },
  room: { flex: 1, minHeight: spacing.none },
  panelScroll: { flexGrow: 0, flexShrink: 1 },
  panelContent: { paddingHorizontal: spacing.sm + spacing.xs, paddingVertical: spacing.sm },
});
