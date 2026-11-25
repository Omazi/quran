/**
 * The numbers of docs/specs/social.md, in one place. The server keeps the same values in its
 * own checks: changing one here means changing it there (docs/specs/social-database.md).
 */
export const SOCIAL_CONFIG = Object.freeze({
  /** A display name or a group name, counted in characters once the edge spaces are removed. */
  nameMinLength: 1,
  nameMaxLength: 30,
  /** Days a sender waits, from the day their request was declined, before asking again. */
  friendRequestCooldownDays: 7,
  /** Characters of an invitation code (rule 6). Not given by the spec: see README. */
  inviteCodeLength: 8,
  /**
   * Days after its creation during which a code still works, the last one included: a code
   * made on the 24th works until the 1st. Not given by the spec: see README.
   */
  inviteValidityDays: 7,
  /** Members of a group, its owner included (rule 8). */
  maxGroupMembers: 50,
  /** Digits of the one-time code sent by e-mail. To align with the server's setting. */
  emailCodeLength: 6,
  /** Longest e-mail address a mail server accepts (RFC 5321 path limit). */
  maxEmailLength: 254,
});

/**
 * The characters of an invitation code: capitals and digits, without those that are easily
 * mistaken for one another when read aloud or copied by hand (0 and O, 1, I and L).
 */
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Longest identifier of an account or of a group. Identifiers come from the server; the bound
 * only keeps a damaged value from being carried around.
 */
export const MAX_ID_LENGTH = 64;

/** Khatmas, and therefore levels, are numbered from 1, as readers know them. */
export const FIRST_LEVEL = 1;

/** Health of a garden: 0 is dead earth, 1 full health (docs/specs/garden.md). */
export const NO_HEALTH = 0;
export const FULL_HEALTH = 1;

/** A known Monday, from which the day of the week of any date is counted. */
export const REFERENCE_MONDAY = '2024-01-01';
export const DAYS_PER_WEEK = 7;

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

/**
 * The spaces removed at both ends of a name (rule 1): the Unicode space separators and the
 * zero-width no-break space. Spelled out rather than left to `String.prototype.trim`, so that
 * the server checks the very same list. Line breaks and tabs are not here: they are refused.
 */
export const EDGE_SPACE_CODE_POINTS: readonly CodePointRange[] = Object.freeze([
  { first: 0x0020, last: 0x0020 }, // space
  { first: 0x00a0, last: 0x00a0 }, // no-break space
  { first: 0x1680, last: 0x1680 }, // ogham space mark
  { first: 0x2000, last: 0x200a }, // en quad to hair space
  { first: 0x202f, last: 0x202f }, // narrow no-break space
  { first: 0x205f, last: 0x205f }, // medium mathematical space
  { first: 0x3000, last: 0x3000 }, // ideographic space
  { first: 0xfeff, last: 0xfeff }, // zero-width no-break space
]);
