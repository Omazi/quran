import type { OnboardingPage } from '../pages';
import type { SceneRenderer } from '../scene';
import type { OnboardingActions, OnboardingModel } from '../use-onboarding';

/** What every page component receives. Each one uses what it needs. */
export interface OnboardingPageProps {
  page: OnboardingPage;
  model: OnboardingModel;
  actions: OnboardingActions;
  renderScene: SceneRenderer;
  /** How far the page indicator lies over the bottom of the page (`Pager`, `renderPage`). */
  bottomInset: number;
}
