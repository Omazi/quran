import { assertBondBetween, type Bond } from './bond';
import { assertNoBlock } from './blocking';
import { SocialRuleError } from './errors';
import type { Nudge, NudgeKind, NudgeRequest } from './types';
import { assertId, assertList, assertLocalDate, assertObject } from './validation';

/**
 * Rule 7: a word of encouragement goes to an accepted friend, once per friend and per day.
 * The day is the sender's local day, as written by their phone.
 */

const NUDGE_KINDS: readonly NudgeKind[] = ['encourage', 'congratulate'];

/**
 * The nudge to store, or a refusal. `bond` is the bond between the two people; `previous` is
 * what the sender has already sent (the rule only looks at the sender's own nudges to this
 * friend).
 */
export function sendNudge(request: NudgeRequest, bond: Bond, previous: readonly Nudge[]): Nudge {
  assertObject(request, 'nudge request');
  assertId(request.fromId, 'sender');
  assertId(request.toId, 'friend');
  assertLocalDate(request.today, 'today');
  if (!NUDGE_KINDS.includes(request.kind)) {
    throw new RangeError(`Invalid nudge kind: ${String(request.kind)}`);
  }
  assertList(previous, 'nudges');

  if (request.fromId === request.toId) {
    throw new SocialRuleError('not-friends', 'a nudge goes to a friend, not to oneself');
  }
  assertBondBetween(bond, request.fromId, request.toId);
  assertNoBlock(bond, request.fromId, request.toId);
  if (bond.friendship === null || bond.friendship.status !== 'accepted') {
    throw new SocialRuleError('not-friends', 'a nudge goes to an accepted friend only');
  }

  const alreadySent = previous.some(
    (nudge) =>
      nudge.fromId === request.fromId &&
      nudge.toId === request.toId &&
      nudge.sentOn === request.today,
  );
  if (alreadySent) {
    throw new SocialRuleError('already-nudged-today', 'one nudge per friend and per day');
  }
  return { fromId: request.fromId, toId: request.toId, kind: request.kind, sentOn: request.today };
}
