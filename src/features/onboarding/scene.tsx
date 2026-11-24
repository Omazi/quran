import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { Placeholder } from '@/ui';

import type { OnboardingScene } from './pages';

/**
 * Draws the scene of a page in the space it is given. The first-launch screen receives one; the
 * garden module will give its own when the garden can be drawn.
 */
export type SceneRenderer = (scene: OnboardingScene) => ReactNode;

/**
 * The scene while no image exists: a neutral surface named after what it will show, "Jardin au
 * hizb 8" or "Jardin après 6 jours sans lecture". Nothing is drawn in its place (SwiftUI Design,
 * principle 4).
 */
export function PlaceholderScene({ scene }: { scene: OnboardingScene }) {
  const { t } = useTranslation('onboarding');
  return <Placeholder name={sceneName(scene, t)} style={styles.scene} />;
}

/** A garden to show: hizb finished, days missed since, and whether reading resumes today. */
export interface SceneGarden {
  readonly hizbCompleted: number;
  readonly daysWithoutReading: number;
  readonly readsToday: boolean;
}

/**
 * The garden a scene shows, in plain numbers, or null for a scene that is not a garden. A scene
 * renderer hands it to whatever draws gardens; this folder does not know what that is.
 */
export function gardenOfScene(scene: OnboardingScene): SceneGarden | null {
  switch (scene.kind) {
    case 'garden':
      return { hizbCompleted: scene.hizbCompleted, daysWithoutReading: 0, readsToday: false };
    case 'drought':
      return {
        hizbCompleted: scene.hizbCompleted,
        daysWithoutReading: scene.daysWithoutReading,
        readsToday: false,
      };
    case 'revival':
      return {
        hizbCompleted: scene.hizbCompleted,
        daysWithoutReading: scene.daysWithoutReading,
        readsToday: true,
      };
    case 'feature':
      return null;
  }
}

/** The default `SceneRenderer`. */
export const renderPlaceholderScene: SceneRenderer = (scene) => <PlaceholderScene scene={scene} />;

function sceneName(scene: OnboardingScene, t: TFunction<'onboarding'>): string {
  switch (scene.kind) {
    case 'garden':
      return scene.hizbCompleted === 0
        ? t('scenes.bareEarth')
        : t('scenes.garden', { hizb: scene.hizbCompleted });
    case 'drought':
      return t('scenes.drought', { count: scene.daysWithoutReading });
    case 'revival':
      return t('scenes.revival');
    case 'feature':
      return t(`scenes.${scene.feature}`);
  }
}

const styles = StyleSheet.create({
  scene: { flex: 1 },
});
