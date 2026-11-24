/**
 * One garden per khatma (docs/DECISIONS.md, D9): each cycle grows a different variant of
 * the garden, and the same cycle of the same user always grows the same one.
 *
 * Nothing here is random and nothing reads the clock: a variant is computed from the
 * cycle number and from the user's seed (drawn once by the app, at first launch).
 *
 * WARNING: once users have gardens and badges, changing the list of themes or the mixing
 * below changes the gardens they already earned.
 */
import { catalogForTreeSpeciesOffset, TREE_SPECIES_CYCLE } from './catalog';
import { isObject } from './checks';
import type { GardenElement, GardenThemeId, GardenVariant } from './types';

/**
 * PLACEHOLDERS: neither the number of themes nor their look is decided (docs/DECISIONS.md,
 * D12). A theme changes how the garden looks, never which elements it has.
 * A user goes through the themes in this order, starting from a theme of their own.
 */
export const GARDEN_THEME_IDS: readonly GardenThemeId[] = Object.freeze([
  'theme-1',
  'theme-2',
  'theme-3',
  'theme-4',
]);

/** Two consecutive cycles can only differ in theme if there is more than one theme. */
const MIN_THEME_COUNT = 2;

/** Number of values of an unsigned 32-bit integer: seeds go from 0 to this, excluded. */
const UINT32_RANGE = 4_294_967_296;

/**
 * The variant the tests and the mock-ups are written for: its seed does not shift the
 * tree species, so tree-1 is a pomegranate tree (docs/specs/garden.md).
 */
export const REFERENCE_GARDEN_VARIANT: GardenVariant = Object.freeze({
  cycle: 1,
  themeId: 'theme-1',
  seed: 0,
});

function assertThemesAreUsable(themeIds: readonly GardenThemeId[]): void {
  if (themeIds.length < MIN_THEME_COUNT || new Set(themeIds).size !== themeIds.length) {
    throw new RangeError(
      `Garden themes: expected at least ${MIN_THEME_COUNT} themes, all different`,
    );
  }
}

// A broken list of themes must stop the app at start-up, not repeat a garden later.
assertThemesAreUsable(GARDEN_THEME_IDS);

/**
 * Scrambles a 32-bit number: neighbouring inputs (cycle 7, cycle 8) give unrelated
 * outputs. This is the final mixing step of MurmurHash3, a public-domain hash. Each
 * operation can be undone, so two different inputs never give the same output.
 */
function scramble32(value: number): number {
  let mixed = value >>> 0;
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x85ebca6b);
  mixed = Math.imul(mixed ^ (mixed >>> 13), 0xc2b2ae35);
  return (mixed ^ (mixed >>> 16)) >>> 0;
}

/** Reduces a user seed of up to 53 bits to a well-mixed 32-bit number. */
function userSeedTo32Bits(userSeed: number): number {
  const lowBits = userSeed % UINT32_RANGE;
  const highBits = Math.floor(userSeed / UINT32_RANGE);
  return scramble32(lowBits ^ scramble32(highBits));
}

function assertCycle(cycle: number): void {
  if (!Number.isSafeInteger(cycle) || cycle < 1) {
    throw new RangeError(
      `Garden variant: cycle must be a whole number of at least 1, got ${cycle}`,
    );
  }
}

function assertUserSeed(userSeed: number): void {
  if (!Number.isSafeInteger(userSeed) || userSeed < 0) {
    throw new RangeError(
      `Garden variant: userSeed must be a whole number of at least 0, got ${userSeed}`,
    );
  }
}

/**
 * The theme of a cycle: the user's own first theme, then the next theme of the list at
 * each new cycle. Two consecutive cycles are therefore never alike, and a theme only
 * comes back once all the others have been seen.
 */
function themeIdOf(cycle: number, userBits: number): GardenThemeId {
  const themeCount = GARDEN_THEME_IDS.length;
  const position = ((userBits % themeCount) + ((cycle - 1) % themeCount)) % themeCount;
  const themeId = GARDEN_THEME_IDS[position];
  if (themeId === undefined) {
    throw new RangeError(`Garden variant: no theme at position ${position}`);
  }
  return themeId;
}

/**
 * The variant of the garden grown by the `cycle`-th khatma (1-based) of the user whose
 * seed is `userSeed` (a whole number, 0 or more).
 *
 * Pure and constant-time, whatever the cycle number: computing the variants of hundreds
 * of finished khatmas (the badges) costs one call each.
 */
export function gardenVariant(cycle: number, userSeed: number): GardenVariant {
  assertCycle(cycle);
  assertUserSeed(userSeed);
  const userBits = userSeedTo32Bits(userSeed);
  return Object.freeze({
    cycle,
    themeId: themeIdOf(cycle, userBits),
    // Adding the cycle before scrambling gives every cycle of a user its own seed.
    seed: scramble32(userBits + (cycle % UINT32_RANGE)),
  });
}

/** Throws unless `variant` has the shape and the ranges `gardenVariant` produces. */
export function assertValidVariant(variant: GardenVariant): void {
  if (!isObject(variant)) {
    throw new TypeError('Garden: variant is required (see gardenVariant)');
  }
  assertCycle(variant.cycle);
  if (!GARDEN_THEME_IDS.includes(variant.themeId)) {
    throw new RangeError(`Garden variant: unknown theme "${String(variant.themeId)}"`);
  }
  const { seed } = variant;
  if (!Number.isInteger(seed) || seed < 0 || seed >= UINT32_RANGE) {
    throw new RangeError(
      `Garden variant: seed must be a whole number from 0 to ${UINT32_RANGE - 1}, got ${seed}`,
    );
  }
}

/**
 * The 60 elements of the garden of a variant, in unlocking order.
 *
 * From one variant to another only the species of the trees change: the species cycle
 * starts `seed % 6` species further (0: tree-1 is a pomegranate tree; 1: a date palm...).
 * Ids, order and the other elements never change.
 */
export function catalogForVariant(variant: GardenVariant): readonly GardenElement[] {
  assertValidVariant(variant);
  return catalogForTreeSpeciesOffset(variant.seed % TREE_SPECIES_CYCLE.length);
}
