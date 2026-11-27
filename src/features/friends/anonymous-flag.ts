import Constants from 'expo-constants';

/**
 * The feature flag `friendsAnonymous` of app.json (`expo.extra.features`): true only when it is a
 * real `true`. On, the phone gets a Supabase anonymous account by itself (no screen), the Proches
 * tab works on the real tables (codes and QR codes), and the progress syncs with that account
 * (docs/AUTH-SETUP.md, "Connexion anonyme"). Off, nothing changes: the demonstration, and the
 * progress kept on the phone. It stays off until the owner has turned on anonymous sign-ins in
 * the dashboard, the keychain module is installed and a real try on two phones has passed.
 */
export function readFriendsAnonymousFlag(extra: unknown): boolean {
  if (typeof extra !== 'object' || extra === null) return false;
  const { features } = extra as { features?: unknown };
  if (typeof features !== 'object' || features === null) return false;
  return (features as { friendsAnonymous?: unknown }).friendsAnonymous === true;
}

/** The flag of this build. */
export function isFriendsAnonymousEnabled(): boolean {
  return readFriendsAnonymousFlag(Constants.expoConfig?.extra);
}
