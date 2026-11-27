import { deviceAnonymousAuth, type AnonymousAuth } from '@/data/auth';
import { createDemoSocial, createSupabaseSocial } from '@/data/social';
import {
  readBuildEnvironment,
  readSupabaseConfig,
  type SupabaseConfig,
  type SyncSession,
} from '@/data/sync';
import type { LocalDate } from '@/domain/shared/local-date';

import { isFriendsAnonymousEnabled } from './anonymous-flag';
import type { SocialClient } from './social-store';

/**
 * The name the profile of an anonymous account gets the first time: friends see it. There is no
 * screen to choose one yet; the owner decides how the person names themselves (a question in
 * docs/AUTH-SETUP.md). Until then the flag stays off.
 */
export const ANONYMOUS_PROFILE_NAME = 'Proche';

export interface AppAccountChoice {
  /** The `friendsAnonymous` flag. */
  readonly isAnonymousEnabled: boolean;
  /** The anonymous account of the phone, or null (no project, no keychain). */
  readonly auth: AnonymousAuth | null;
  readonly config: SupabaseConfig | null;
  readonly today: () => LocalDate;
}

/**
 * Where the Proches tab gets its friends: the Supabase project with the anonymous account when
 * the flag is on and the phone can keep an account; the demonstration otherwise.
 */
export function chooseSocialClient({
  isAnonymousEnabled,
  auth,
  config,
  today,
}: AppAccountChoice): SocialClient {
  if (isAnonymousEnabled && auth !== null && config !== null) {
    return createSupabaseSocial({
      config,
      auth,
      today,
      newProfileName: () => ANONYMOUS_PROFILE_NAME,
    });
  }
  return createDemoSocial({ today });
}

/** The account the sync uses: the anonymous one when the flag is on, otherwise none. */
export function chooseSyncSession({
  isAnonymousEnabled,
  auth,
}: Pick<AppAccountChoice, 'isAnonymousEnabled' | 'auth'>): SyncSession | null {
  return isAnonymousEnabled && auth !== null ? auth.syncSession() : null;
}

/** The account of this phone for this build: null while the flag is off. */
function appAnonymousAuth(): AnonymousAuth | null {
  return isFriendsAnonymousEnabled() ? deviceAnonymousAuth() : null;
}

/** The Proches tab's client for this build. */
export function appSocialClient(today: () => LocalDate): SocialClient {
  return chooseSocialClient({
    isAnonymousEnabled: isFriendsAnonymousEnabled(),
    auth: appAnonymousAuth(),
    config: readSupabaseConfig(readBuildEnvironment()),
    today,
  });
}

/**
 * The account the sync of this build uses (`session` of src/app/_layout.tsx): the anonymous
 * account, made on the first sync, when the flag is on; none otherwise (the progress stays on
 * the phone, as before).
 */
export function appSyncSession(): SyncSession | null {
  return chooseSyncSession({
    isAnonymousEnabled: isFriendsAnonymousEnabled(),
    auth: appAnonymousAuth(),
  });
}
