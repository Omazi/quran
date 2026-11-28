import Constants from 'expo-constants';

/**
 * The feature flag `friendsSignIn` of app.json (`expo.extra.features`): true only when it is a
 * real `true`. On since 27 November 2026 (owner: "ne cache aucun onglet, ne cache rien du tout"):
 * a person signed out sees the sign-in screen, whose Apple, Google and e-mail buttons say
 * "Bientôt disponible" while `SIGN_IN_PROVIDERS_READY` is false, and whose "Continuer sans
 * compte" opens the tab (the anonymous account, or the demonstration).
 */
export function readFriendsSignInFlag(extra: unknown): boolean {
  if (typeof extra !== 'object' || extra === null) return false;
  const { features } = extra as { features?: unknown };
  if (typeof features !== 'object' || features === null) return false;
  return (features as { friendsSignIn?: unknown }).friendsSignIn === true;
}

/** The flag of this build. */
export function isFriendsSignInEnabled(): boolean {
  return readFriendsSignInFlag(Constants.expoConfig?.extra);
}

/**
 * Whether Apple, Google and the e-mail can really sign in: false until the owner has set them up
 * (docs/AUTH-SETUP.md, sections 1 to 3) and the real sign-in is written. Until then their buttons
 * are shown (the owner wants to see everything while he tests) and answer "Bientôt disponible",
 * never a broken sign-in.
 */
export const SIGN_IN_PROVIDERS_READY = false;
