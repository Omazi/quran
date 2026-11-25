/**
 * Why a rule of docs/specs/social.md said no. A screen turns the reason into a sentence; the
 * server answers with the same words.
 */
export type SocialRefusal =
  // Rule 1 and rule 8: a display name or a group name.
  | 'name-empty'
  | 'name-too-long'
  | 'name-forbidden-character'
  // Rule 2: friend requests.
  | 'cannot-befriend-yourself'
  | 'already-friends'
  | 'request-already-sent'
  | 'request-declined-recently'
  | 'no-pending-request'
  | 'not-the-addressee'
  | 'not-friends'
  | 'not-your-friendship'
  // Rule 3: blocks. A blocked person is never told so: what they try fails with
  // `person-unavailable`, the answer about an account that does not exist.
  | 'cannot-block-yourself'
  | 'already-blocked'
  | 'not-blocked'
  | 'you-blocked-them'
  | 'person-unavailable'
  // Rule 6: invitation codes.
  | 'invite-code-malformed'
  | 'invite-not-found'
  | 'invite-expired'
  | 'invite-is-yours'
  // Rule 11: search by name. `too-many-searches` comes from the server only.
  | 'search-query-too-short'
  | 'search-query-too-long'
  | 'search-query-forbidden-character'
  | 'too-many-searches'
  // Rule 7: nudges.
  | 'already-nudged-today'
  // Rule 8: groups.
  | 'group-not-found'
  | 'not-a-member'
  | 'already-a-member'
  | 'group-full'
  | 'owner-must-hand-over'
  | 'successor-not-a-member'
  // Sign-in.
  | 'email-malformed'
  | 'email-code-malformed'
  | 'not-signed-in';

/**
 * A rule said no to something a person can do by using the app: typing a name or a code,
 * tapping a button. It is a `RangeError`, like every refused value in the domain, and it
 * carries a `reason` the screen can read.
 *
 * A value only a bug or damaged data can produce (a wrong type, an impossible date, a number
 * out of bounds) raises a plain `TypeError` or `RangeError` instead.
 */
export class SocialRuleError extends RangeError {
  readonly reason: SocialRefusal;

  /** `detail` goes to the logs: it never repeats a name, a code or an address. */
  constructor(reason: SocialRefusal, detail: string) {
    super(`${reason}: ${detail}`);
    this.name = 'SocialRuleError';
    this.reason = reason;
  }
}
