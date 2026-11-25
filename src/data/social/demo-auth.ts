import {
  deleteAccountData,
  parseEmail,
  parseEmailCode,
  SocialRuleError,
  type AuthGateway,
  type Session,
  type SignInProvider,
} from '@/domain/social';
import type { LocalDate } from '@/domain/shared/local-date';

import { DEMO_SIGNED_IN_USER } from './config';
import { createDemoSocialData } from './demo-data';
import type { DemoStore } from './demo-store';

/**
 * `AuthGateway` of the demonstration. The three ways to sign in open the same session, the one
 * of Omar: no account is created and nothing leaves the phone. The e-mail way still checks the
 * shape of the address and of the code, so that a screen is tested against the real rules; any
 * well-formed code is accepted.
 */
export function createDemoAuthGateway(store: DemoStore, today: () => LocalDate): AuthGateway {
  function open(provider: SignInProvider): Session {
    // After a deletion the demonstration starts over, so that it can be shown again.
    if (!store.data.profiles.some((profile) => profile.id === DEMO_SIGNED_IN_USER)) {
      store.data = createDemoSocialData(today());
    }
    store.session = { userId: DEMO_SIGNED_IN_USER, provider, isDemonstration: true };
    return store.session;
  }

  return {
    isDemonstration: true,
    // `async` on purpose: a refusal reaches the caller as a rejected promise, like a server's.
    getSession: async () => store.session,
    signInWithApple: async () => open('apple'),
    signInWithGoogle: async () => open('google'),
    requestEmailCode: async (email) => {
      parseEmail(email);
    },
    signInWithEmail: async (email, code) => {
      parseEmail(email);
      parseEmailCode(code);
      return open('email');
    },
    signOut: async () => {
      store.session = null;
    },
    deleteAccount: async () => {
      if (store.session === null) {
        throw new SocialRuleError('not-signed-in', 'sign in before deleting the account');
      }
      store.data = deleteAccountData(store.data, store.session.userId);
      store.session = null;
    },
  };
}
