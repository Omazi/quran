/**
 * The gender a person says they have, so that the words that speak to them or of them agree
 * (French "arrêté" / "arrêtée", Arabic "اقرأ" / "اقرئي"). The owner decided (26 November 2026)
 * that the app asks for it: two values, and "unspecified" (null) for a person who prefers not to
 * say, which every text answers with a neutral wording. Nothing guesses it from a name.
 */
export const GENDERS = ['male', 'female'] as const;

export type Gender = (typeof GENDERS)[number];

/** True for "male" and "female" only. */
export function isGender(value: unknown): value is Gender {
  return typeof value === 'string' && (GENDERS as readonly string[]).includes(value);
}

/**
 * A gender, or null for "unspecified". Anything else is refused with an explicit error rather
 * than corrected: a wrong gender would put the wrong words in someone's mouth.
 */
export function parseGender(value: unknown): Gender | null {
  if (value === null || isGender(value)) return value;
  if (typeof value !== 'string') {
    throw new TypeError(`Invalid gender: expected "male", "female" or null, got ${typeof value}`);
  }
  throw new RangeError(`Invalid gender: expected "male", "female" or null, got "${value}"`);
}
