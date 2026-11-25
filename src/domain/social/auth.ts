import { SOCIAL_CONFIG } from './config';
import { SocialRuleError } from './errors';
import type { SignInProvider, SignInPlatform } from './gateways';

/**
 * Sign-in rules that do not depend on a server: the shape of an e-mail address and of the
 * one-time code, and the providers a store requires (docs/SECURITY.md).
 */

/** Characters allowed in the part before the @ (RFC 5322 "atext", plus the dot). */
const LOCAL_PART_PATTERN = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
/** One label of the domain: letters, digits and hyphens, never a hyphen at either end. */
const DOMAIN_LABEL_PATTERN = /^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?$/;
const EXTENSION_PATTERN = /^[A-Za-z]{2,}$/;
const MIN_DOMAIN_LABELS = 2;

function malformedEmail(): SocialRuleError {
  return new SocialRuleError('email-malformed', 'an address looks like name@example.com');
}

/**
 * The address as it was typed, or a refusal. Nothing is corrected, not even a space at an end:
 * the e-mail field of the screen trims. Accented and non-Latin addresses are refused for now: a
 * mail server and a database do not all agree on them, and the first sign-in must not depend on
 * that. Not a guarantee that the address exists: only the code sent to it proves that.
 */
export function parseEmail(raw: string): string {
  if (typeof raw !== 'string') {
    throw new TypeError(
      `Invalid e-mail address: expected text, got ${raw === null ? 'null' : typeof raw}`,
    );
  }
  if (raw.length > SOCIAL_CONFIG.maxEmailLength) throw malformedEmail();

  const parts = raw.split('@');
  const [local, domain] = parts;
  if (parts.length !== 2 || local === undefined || domain === undefined) throw malformedEmail();
  if (local.length > SOCIAL_CONFIG.maxEmailLocalPartLength || !LOCAL_PART_PATTERN.test(local)) {
    throw malformedEmail();
  }
  const labels = domain.split('.');
  const extension = labels[labels.length - 1] ?? '';
  if (
    labels.length < MIN_DOMAIN_LABELS ||
    !labels.every((label) => DOMAIN_LABEL_PATTERN.test(label)) ||
    !EXTENSION_PATTERN.test(extension)
  ) {
    throw malformedEmail();
  }
  return raw;
}

const EMAIL_CODE_PATTERN = new RegExp(`^[0-9]{${SOCIAL_CONFIG.emailCodeLength}}$`);

/** The one-time code as it was typed, or a refusal. ASCII digits only. */
export function parseEmailCode(raw: string): string {
  if (typeof raw !== 'string') {
    throw new TypeError(
      `Invalid e-mail code: expected text, got ${raw === null ? 'null' : typeof raw}`,
    );
  }
  if (!EMAIL_CODE_PATTERN.test(raw)) {
    throw new SocialRuleError(
      'email-code-malformed',
      `the code has ${SOCIAL_CONFIG.emailCodeLength} digits`,
    );
  }
  return raw;
}

/**
 * The ways to sign in that a platform must offer. The iOS store requires "Sign in with Apple"
 * as soon as another third-party sign-in (Google) is offered; Android has no such rule.
 */
export function signInProvidersFor(platform: SignInPlatform): readonly SignInProvider[] {
  switch (platform) {
    case 'ios':
      return ['apple', 'google', 'email'];
    case 'android':
      return ['google', 'email'];
    default:
      throw new RangeError(`Invalid platform: ${String(platform)} (expected ios or android)`);
  }
}
