/**
 * The first-launch flow (docs/specs/ui-lot1.md, A.3): its pages as data, the screen that shows
 * them, and the hook that builds its model.
 */

export { OnboardingScreen, type OnboardingScreenProps } from './onboarding-screen';
export {
  ONBOARDING_LENGTH,
  ONBOARDING_PAGES,
  ONBOARDING_PAGES_FULL,
  ONBOARDING_PAGES_SHORT,
  SHIPPED_FEATURES,
  onboardingPages,
  type OnboardingFeature,
  type OnboardingLength,
  type OnboardingPage,
  type OnboardingPageKind,
  type OnboardingScene,
} from './pages';
export {
  PlaceholderScene,
  gardenOfScene,
  renderPlaceholderScene,
  type SceneGarden,
  type SceneRenderer,
} from './scene';
export {
  useOnboarding,
  type OnboardingActions,
  type OnboardingDependencies,
  type OnboardingEnding,
  type OnboardingModel,
} from './use-onboarding';
