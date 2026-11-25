/**
 * Helpers shared by the social tests. Not part of the module's API.
 */
import { parseLocalDate, type LocalDate } from '@/domain/shared/local-date';

import { SocialRuleError, type Profile, type SocialRefusal } from '../index';

/** Short alias: tests write `day('2026-11-24')`. */
export function day(value: string): LocalDate {
  return parseLocalDate(value);
}

/** A Tuesday. The week around it runs from Monday 23 to Sunday 29 November 2026. */
export const TODAY = day('2026-11-24');

/**
 * Values the types forbid but damaged data can bring. The casts are the point of these
 * constants: each one smuggles a wrong value past the compiler, as storage or a server could.
 */
export const IMPOSSIBLE_DAY = '2026-02-30' as LocalDate;
export const NOT_TEXT = 7 as unknown as string;
export const NOT_AN_OBJECT = null as unknown as never;

/** The people of the tests. The first names are those of docs/DECISIONS.md, D25. */
export const OMAR = 'user-omar';
export const MUSTAPHA = 'user-mustapha';
export const SARAH = 'user-sarah';
export const TAGHREAD = 'user-taghread';

/**
 * Checks that a rule says no, and why. Any other error (a TypeError, a plain RangeError, no
 * error at all) fails the test: a refusal the screen cannot name is not a refusal.
 */
export function expectRefusal(action: () => unknown, reason: SocialRefusal): void {
  let thrown: unknown = null;
  try {
    action();
  } catch (error) {
    thrown = error;
  }
  if (!(thrown instanceof SocialRuleError)) {
    throw new Error(`Expected the refusal "${reason}", got: ${String(thrown)}`);
  }
  expect(thrown.reason).toBe(reason);
}

/** The same check for a call that answers later, as the repository does. */
export async function expectRefusalLater(
  action: () => Promise<unknown>,
  reason: SocialRefusal,
): Promise<void> {
  let thrown: unknown = null;
  try {
    await action();
  } catch (error) {
    thrown = error;
  }
  if (!(thrown instanceof SocialRuleError)) {
    throw new Error(`Expected the refusal "${reason}", got: ${String(thrown)}`);
  }
  expect(thrown.reason).toBe(reason);
}

/** Gives `overrides` on top of a profile of Sarah, shown to friends by default (D23). */
export function profileOf(
  id: string,
  displayName: string,
  overrides: Partial<{ showGarden: boolean; showLevel: boolean }> = {},
): Profile {
  return {
    id,
    displayName,
    showGarden: true,
    showLevel: true,
    createdOn: day('2026-10-01'),
    ...overrides,
  };
}
