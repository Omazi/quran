import type { OnboardingPage } from '../pages';
import type { OnboardingActions, OnboardingModel } from '../use-onboarding';

/** What every page component receives. Each one uses what it needs. */
export interface OnboardingPageProps {
  page: OnboardingPage;
  model: OnboardingModel;
  actions: OnboardingActions;
}
