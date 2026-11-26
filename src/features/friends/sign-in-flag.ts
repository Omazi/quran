import Constants from 'expo-constants';

/**
 * The feature flag `friendsSignIn` of app.json (`expo.extra.features`): true only when it is a
 * real `true`. It stays false while real accounts are not set up (Supabase's sign-in providers,
 * docs/AUTH-SETUP.md): the owner does not ship a sign-in that cannot work, so the Proches tab
 * opens straight on the friends of the demonstration, which says it is one, and the sign-in screen
 * exists and is tested but is not shown to anyone. Turn it on together with `accountInvitation`,
 * whose sheet leads to this sign-in.
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
