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
  | 'not-your-friendship';

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
