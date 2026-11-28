import { SocialRuleError, type SocialRefusal } from '@/domain/social';

/** The refusals the screens of this tab can meet, each with a sentence in the `friends` namespace. */
const SHOWN_REFUSALS = [
  'name-empty',
  'name-too-long',
  'name-forbidden-character',
  'already-friends',
  'request-already-sent',
  'request-declined-recently',
  'person-unavailable',
  'you-blocked-them',
  'invite-code-malformed',
  'invite-not-found',
  'invite-expired',
  'invite-is-yours',
  'search-query-too-long',
  'search-query-forbidden-character',
  'too-many-searches',
  'already-nudged-today',
  'already-a-member',
  'group-full',
  'email-malformed',
  'email-code-malformed',
] as const satisfies readonly SocialRefusal[];

/** `coming-soon`: a way to sign in that is not set up yet (`SIGN_IN_PROVIDERS_READY`). */
export type ShownRefusal = (typeof SHOWN_REFUSALS)[number] | 'unknown' | 'coming-soon';

/**
 * The sentence to show for an error, as a key of `friends:refusals`. A rule that said no gives
 * its own sentence; anything else (a bug, the server out of reach) gives one calm sentence that
 * blames no one (writing.md › Best practices).
 */
export function refusalOf(error: unknown): ShownRefusal {
  if (error instanceof SocialRuleError) {
    const shown: readonly string[] = SHOWN_REFUSALS;
    if (shown.includes(error.reason)) return error.reason as ShownRefusal; // checked just above
  }
  return 'unknown';
}

export function isRefusal(error: unknown, reason: SocialRefusal): boolean {
  return error instanceof SocialRuleError && error.reason === reason;
}
