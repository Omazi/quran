/**
 * The numbers of docs/specs/social.md, in one place. The server keeps the same values in its
 * own checks: changing one here means changing it there.
 */
export const SOCIAL_CONFIG = Object.freeze({
  /** A display name or a group name, counted in characters once the edge spaces are removed. */
  nameMinLength: 1,
  nameMaxLength: 30,
  /** Days a sender waits, from the day their request was declined, before asking again. */
  friendRequestCooldownDays: 7,
});

/**
 * Longest identifier of an account or of a group. Identifiers come from the server; the bound
 * only keeps a damaged value from being carried around.
 */
export const MAX_ID_LENGTH = 64;

/** An unbroken run of Unicode code points, both ends included. */
export interface CodePointRange {
  readonly first: number;
  readonly last: number;
}

/**
 * What a display name or a group name may not contain (rule 1). The ranges are spelled out,
 * not left to a "control character" class, so that the app and the server refuse exactly the
 * same characters.
 */
export const FORBIDDEN_NAME_CODE_POINTS: readonly CodePointRange[] = Object.freeze([
  // C0 controls: tab, line feed, carriage return and the rest.
  { first: 0x0000, last: 0x001f },
  // Delete and the C1 controls, "next line" among them.
  { first: 0x007f, last: 0x009f },
  // Line separator and paragraph separator: line breaks that are not control characters.
  { first: 0x2028, last: 0x2029 },
  // Direction embeddings and overrides: they can make a name read backwards.
  { first: 0x202a, last: 0x202e },
  // Direction isolates.
  { first: 0x2066, last: 0x2069 },
  // Half of a character pair on its own: text no server can store.
  { first: 0xd800, last: 0xdfff },
]);
