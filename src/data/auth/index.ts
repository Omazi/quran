/**
 * The account of this phone with Supabase Auth: for now an anonymous account, made silently
 * (docs/AUTH-SETUP.md, "Connexion anonyme"), kept in the keychain, used by the Proches tab and
 * the sync. Nothing here is used while the `friendsAnonymous` flag is off.
 */
import { readBuildEnvironment, readSupabaseConfig } from '@/data/sync';

import { createAnonymousAuth, type AnonymousAuth } from './anonymous-auth';
import type { SessionStorage } from './session-storage';

export {
  AnonymousAuthError,
  createAnonymousAuth,
  type AnonymousAuth,
  type AnonymousAuthFailure,
  type AnonymousAuthOptions,
  type AnonymousSession,
} from './anonymous-auth';
export { createMemorySessionStorage, type SessionStorage } from './session-storage';

/**
 * The keychain of the phone, or null while the app has none. `docs/SECURITY.md` requires the
 * session in `expo-secure-store`, which is not installed yet (adding a native module is the
 * coordinator's step: `npx expo install expo-secure-store`, docs/AUTH-SETUP.md). Without it
 * there is no account: the tokens are never written in clear, and the app stays as it is
 * (demonstration in the Proches tab, progress kept on the phone), even with the flag on.
 */
export const deviceSessionStorage: SessionStorage | null = null;

let deviceAuth: AnonymousAuth | null | undefined;

/**
 * The account of this phone: one for the whole app (the Proches tab and the sync share it).
 * Null when the build has no Supabase project or the phone has no keychain to keep it in.
 */
export function deviceAnonymousAuth(): AnonymousAuth | null {
  if (deviceAuth === undefined) {
    const config = readSupabaseConfig(readBuildEnvironment());
    deviceAuth =
      config === null || deviceSessionStorage === null
        ? null
        : createAnonymousAuth({ config, storage: deviceSessionStorage });
  }
  return deviceAuth;
}
