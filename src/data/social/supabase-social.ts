import type { AnonymousAuth } from '@/data/auth';
import type { SupabaseConfig } from '@/data/sync';
import type { LocalDate } from '@/domain/shared/local-date';
import type { AuthGateway, Session, SocialRepository } from '@/domain/social';

import { createSupabaseRepository } from './supabase-repository';
import { createSupabaseRest } from './supabase-rest';

export interface SupabaseSocialOptions {
  readonly config: SupabaseConfig;
  /** The anonymous account of this phone (src/data/auth). */
  readonly auth: AnonymousAuth;
  readonly today: () => LocalDate;
  /** The name of the profile made the first time (no screen to choose it yet). */
  readonly newProfileName: () => string;
  readonly fetch?: typeof fetch;
}

export interface SupabaseSocial {
  readonly isDemonstration: false;
  readonly auth: AuthGateway;
  readonly repository: SocialRepository;
  /** Opens the account without a screen: the anonymous account, made the first time. */
  openSilently(): Promise<Session>;
}

/** The ways to sign in with a provider do not exist yet: no screen offers them (`friendsSignIn`). */
async function notYet(): Promise<never> {
  throw new Error('Signing in with Apple, Google or an e-mail is not available yet.');
}

/**
 * The Proches tab on the Supabase project, with the anonymous account of the phone: the same two
 * interfaces as the demonstration (docs/specs/social.md, section 4), so that no screen changes.
 */
export function createSupabaseSocial({
  config,
  auth,
  today,
  newProfileName,
  fetch: request,
}: SupabaseSocialOptions): SupabaseSocial {
  const rest = createSupabaseRest({ config, getAccessToken: auth.getAccessToken, fetch: request });
  const sessionOf = (userId: string): Session => ({
    userId,
    provider: 'anonymous',
    isDemonstration: false,
  });
  const repository = createSupabaseRepository({
    rest,
    myId: async () => (await auth.ensure()).userId,
    today,
    newProfileName,
  });
  const gateway: AuthGateway = {
    isDemonstration: false,
    getSession: async () => {
      const current = await auth.current();
      return current === null ? null : sessionOf(current.userId);
    },
    signInWithApple: notYet,
    signInWithGoogle: notYet,
    requestEmailCode: notYet,
    signInWithEmail: notYet,
    signOut: () => auth.forget(),
    deleteAccount: async () => {
      await rest.rpc('delete_my_account');
      await auth.forget();
    },
  };
  return {
    isDemonstration: false,
    auth: gateway,
    repository,
    openSilently: async () => sessionOf((await auth.ensure()).userId),
  };
}
