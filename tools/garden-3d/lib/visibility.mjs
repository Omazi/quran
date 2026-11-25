/**
 * When a piece of the baked garden is drawn. The garden has one stage per number of elements
 * (0 to 60), water level (0 dry, 1 low, 2 flowing) and foliage (0 full leaf to 3 bare), as the
 * pictures (docs/specs/garden-pictures.md). The bake runs the picture builder for every stage and
 * records, for each piece, the stages where it is drawn; this file turns that set into a few
 * items the app reads: a range of element counts and the water and foliage combinations.
 *
 * Pure: no three.js, no browser. Used by the bake page and tested under Node.
 */

export const MAX_COUNT = 60;
export const WATER_LEVELS = 3;
export const FOLIAGE_STAGES = 4;
export const COMBO_COUNT = WATER_LEVELS * FOLIAGE_STAGES;
const ALL_COMBOS = (1 << COMBO_COUNT) - 1;

/** The index of a water and foliage combination, 0 to 11: what bit of `comboMask` it is. */
export function comboOf(water, foliage) {
  return water * FOLIAGE_STAGES + foliage;
}

/**
 * The items that draw a piece exactly where `isShown(count, combo)` is true. Each item is drawn
 * when `from <= count < until` and bit `combo` of `comboMask` is set. Combinations that share the
 * same counts share an item; counts with a hole give one item per run.
 */
export function encodeVisibility(isShown) {
  const byCounts = new Map();
  for (let combo = 0; combo < COMBO_COUNT; combo += 1) {
    let counts = '';
    for (let count = 0; count <= MAX_COUNT; count += 1) counts += isShown(count, combo) ? '1' : '0';
    if (!counts.includes('1')) continue;
    byCounts.set(counts, (byCounts.get(counts) ?? 0) | (1 << combo));
  }
  const items = [];
  for (const [counts, comboMask] of byCounts) {
    let start = -1;
    for (let count = 0; count <= MAX_COUNT + 1; count += 1) {
      const on = count <= MAX_COUNT && counts[count] === '1';
      if (on && start < 0) start = count;
      if (!on && start >= 0) {
        items.push({ from: start, until: count, comboMask });
        start = -1;
      }
    }
  }
  return items.sort((a, b) => a.from - b.from || b.comboMask - a.comboMask || a.until - b.until);
}

export { ALL_COMBOS };
