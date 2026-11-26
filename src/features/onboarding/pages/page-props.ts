import type { SharedValue } from 'react-native-reanimated';

import type { OnboardingPage } from '../pages';
import type { StageLayout } from '../stage-layout';
import type { OnboardingActions, OnboardingModel } from '../use-onboarding';

/** What each page receives: itself, where the pager is, the layout, the flow's model. */
export interface PageProps {
  readonly page: OnboardingPage;
  readonly index: number;
  readonly position: SharedValue<number>;
  readonly layout: StageLayout;
  readonly reducedMotion: boolean;
  readonly introMs: SharedValue<number>;
  /** The scene of the page in words, for screen readers. */
  readonly sceneLabel: string;
  readonly model: OnboardingModel;
  readonly actions: OnboardingActions;
}
