/**
 * The first-launch flow in the "voix" direction (docs/specs/ui-lot1.md, A.3): its pages as data,
 * the screen that shows them, and the hooks that build its model and load Al-Fatiha.
 */

export { OnboardingScreen, type OnboardingScreenProps } from './onboarding-screen';
export {
  ONBOARDING_PAGES,
  ONBOARDING_PAGES_FULL,
  type OnboardingPage,
  type OnboardingPageKind,
} from './pages';
export { useFatihaPage } from './use-fatiha';
export {
  useOnboarding,
  type OnboardingActions,
  type OnboardingDependencies,
  type OnboardingModel,
} from './use-onboarding';
