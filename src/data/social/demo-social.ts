import type { LocalDate } from '@/domain/shared/local-date';
import {
  SocialRuleError,
  type AuthGateway,
  type SocialData,
  type SocialRepository,
  type UserId,
} from '@/domain/social';

import { DEMO_RANDOM_SEED } from './config';
import { createDemoAuthGateway } from './demo-auth';
import { createDemoSocialData } from './demo-data';
import { createDemoRepository } from './demo-repository';
import type { DemoStore } from './demo-store';

/** Constants of a small linear congruential generator (Numerical Recipes): repeatable, not secure. */
const LCG_MULTIPLIER = 1_664_525;
const LCG_INCREMENT = 1_013_904_223;
const LCG_MODULUS = 2 ** 32;

/**
 * A source of whole numbers that gives the same run every time. Good enough for invitation
 * codes of a demonstration; the real server uses a secure source.
 */
export function createRepeatableRandomIndex(seed: number): (size: number) => number {
  let state = seed % LCG_MODULUS;
  return (size) => {
    state = (state * LCG_MULTIPLIER + LCG_INCREMENT) % LCG_MODULUS;
    return Math.floor((state / LCG_MODULUS) * size);
  };
}

export interface DemoSocialOptions {
  /** The day of the phone, asked at each action. Time is injected, never read here. */
  readonly today: () => LocalDate;
  /** Starts from other tables than `createDemoSocialData(today())` (tests, previews). */
  readonly initialData?: SocialData;
  /** Source of invitation codes; repeatable by default. */
  readonly randomIndex?: (size: number) => number;
}

export interface DemoSocial {
  /** Always true: a screen says so (docs/specs/social.md, section 4). */
  readonly isDemonstration: true;
  readonly auth: AuthGateway;
  /** Acts as the signed-in person; every call fails with `not-signed-in` before sign-in. */
  readonly repository: SocialRepository;
  /**
   * Acts as another person of the demonstration, whatever the session: to show the other side
   * of a request or a block ("Sarah answers"). Not part of `SocialRepository`.
   */
  repositoryAs(userId: UserId): SocialRepository;
}

/** The demonstration of accounts and friends: in memory, repeatable, and obviously not real. */
export function createDemoSocial(options: DemoSocialOptions): DemoSocial {
  const store: DemoStore = {
    data: options.initialData ?? createDemoSocialData(options.today()),
    session: null,
    nextGroupNumber: 2,
  };
  const randomIndex = options.randomIndex ?? createRepeatableRandomIndex(DEMO_RANDOM_SEED);
  const build = (actingUser: () => UserId): SocialRepository =>
    createDemoRepository({ store, today: options.today, randomIndex, actingUser });

  return {
    isDemonstration: true,
    auth: createDemoAuthGateway(store, options.today),
    repository: build(() => {
      if (store.session === null) {
        throw new SocialRuleError('not-signed-in', 'sign in first');
      }
      return store.session.userId;
    }),
    repositoryAs: (userId) => build(() => userId),
  };
}
