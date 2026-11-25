import { FORBIDDEN_NAME_CODE_POINTS, SOCIAL_CONFIG } from './config';
import { SocialRuleError } from './errors';

function isForbiddenInName(character: string): boolean {
  // Never undefined: iterating a string yields whole characters, each with a code point.
  const codePoint = character.codePointAt(0) ?? 0;
  return FORBIDDEN_NAME_CODE_POINTS.some(
    (range) => codePoint >= range.first && codePoint <= range.last,
  );
}

/**
 * Rule 1: the name as it is stored, or an explicit refusal. Group names follow the same rule
 * (rule 8).
 *
 * The spaces at both ends are removed, as the rule says; nothing else is ever changed. The
 * forbidden characters are looked for before that, so that a line break at the end is refused
 * instead of vanishing with the spaces. The length is counted in characters (code points), the
 * way a database counts them: an emoji is one character, not two.
 */
export function parseDisplayName(raw: string): string {
  if (typeof raw !== 'string') {
    throw new TypeError(`Invalid name: expected text, got ${raw === null ? 'null' : typeof raw}`);
  }
  if (Array.from(raw).some(isForbiddenInName)) {
    throw new SocialRuleError(
      'name-forbidden-character',
      'a name holds no line break, no control character and no direction mark',
    );
  }

  const name = raw.trim();
  const length = Array.from(name).length;
  if (length < SOCIAL_CONFIG.nameMinLength) {
    throw new SocialRuleError('name-empty', 'a name has at least one character');
  }
  if (length > SOCIAL_CONFIG.nameMaxLength) {
    throw new SocialRuleError(
      'name-too-long',
      `a name has at most ${SOCIAL_CONFIG.nameMaxLength} characters, got ${length}`,
    );
  }
  return name;
}
