/**
 * The demonstration of the social module (docs/specs/social.md, section 4). Everything here is
 * invented: no real person, no real account, nothing leaves the phone.
 */

/**
 * The people of the demonstration. The first names are those of docs/DECISIONS.md, D25, and
 * Yacine, the author of the pending request: the spec asks for three friends and a request, and
 * D25 gives only three names besides Omar.
 */
export const DEMO_USERS = Object.freeze({
  omar: 'demo-omar',
  mustapha: 'demo-mustapha',
  sarah: 'demo-sarah',
  taghread: 'demo-taghread',
  yacine: 'demo-yacine',
});

/** Who the demonstration signs in, whatever the way chosen. */
export const DEMO_SIGNED_IN_USER = DEMO_USERS.omar;

export const DEMO_GROUP_ID = 'demo-group-1';
export const DEMO_GROUP_NAME = 'Famille';

/** Days of reading history the starting data holds, today included: enough for a whole month. */
export const DEMO_HISTORY_DAYS = 35;

/** Seed of the repeatable "random" source that makes the invitation codes of the demonstration. */
export const DEMO_RANDOM_SEED = 20_261_124;
