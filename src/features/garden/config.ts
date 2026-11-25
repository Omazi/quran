/**
 * Presentation settings of the garden on screen: sizes, symbols and colour roles. No rule of the
 * garden lives here; the rules are in `@/domain/garden`.
 */

import { GARDEN_CATALOG, type GardenPhase, type WaterState } from '@/domain/garden';
import { spacing, type IconSymbol, type LabelRowTone, type StatusTone } from '@/ui';

import { GARDEN_PICTURE_PIXELS } from './garden-images.generated';

/** How many steps a garden has: one element per hizb. The catalogue is the garden's own count. */
export const GARDEN_STEP_COUNT = GARDEN_CATALOG.length;

/**
 * Smallest height of the scene shown as a band across the screen: below it an image would no
 * longer read. A minimum, never a fixed height, so that the name of the placeholder can wrap at
 * the largest text sizes (layout.md › Adaptability).
 */
export const GARDEN_SCENE_BAND_MIN_HEIGHT = spacing.xxl * 4;

/**
 * One symbol per state of the water, so that the state never rests on colour
 * (accessibility.md › Vision). Outline variants, which sit well beside text, and the slash
 * variant for what is unavailable (sf-symbols.md › Design variants). All exist on iOS 16.
 */
export const WATER_SYMBOLS: Readonly<Record<WaterState, IconSymbol>> = {
  flowing: { ios: 'water.waves', android: 'water' },
  still: { ios: 'drop', android: 'water_drop' },
  dry: { ios: 'water.waves.slash', android: 'format_color_reset' },
};

/**
 * Colour of the water symbol. The accent is the colour of water ("watered"); orange is thirst,
 * on the symbol only: the words beside it stay in the label colour (charter, section 3).
 */
export const WATER_TONES: Readonly<Record<WaterState, LabelRowTone>> = {
  flowing: 'accent',
  still: 'secondaryLabel',
  dry: 'warning',
};

/** On the bare earth there is no water yet: nothing went dry, so nothing is orange. */
export const NO_WATER_YET_TONE: LabelRowTone = 'secondaryLabel';

/**
 * One colour, one meaning (color.md › Best practices). Green is what has grown: the hizb
 * finished. The health gauge is the water the garden has: the accent while it is fine, orange
 * from thirst on. The value is always written beside each gauge.
 */
export const HIZB_TONE: StatusTone = 'growth';

/** The bare earth shows no health gauge. */
export const HEALTH_TONES: Readonly<Record<GardenPhase, StatusTone>> = {
  bare: 'accent',
  thriving: 'accent',
  thirsty: 'warning',
  wilting: 'warning',
  dying: 'warning',
  dead: 'warning',
};

// ---------------------------------------------------------------------------------------------
// The garden as pictures (docs/specs/garden-pictures.md)
// ---------------------------------------------------------------------------------------------

/**
 * Size of every garden picture. One camera for the whole set, cut to the same box, so two
 * pictures overlay exactly; the scene keeps these proportions (image-views.md › Content: one size
 * for a sequence). The tool measures it and writes it with the table of pictures: it is the
 * rendered picture without the empty margin around what the set draws.
 */
export const GARDEN_PICTURE_SIZE = GARDEN_PICTURE_PIXELS;

/** Width over height of a garden picture. */
export const GARDEN_PICTURE_ASPECT_RATIO = GARDEN_PICTURE_SIZE.width / GARDEN_PICTURE_SIZE.height;

/** Number of foliage pictures per number of elements: full leaf, dull, half bare, all bare. */
export const FOLIAGE_STAGE_COUNT = 4;

/**
 * Drought days between the day the trees start to lose their leaves (`wiltingMinDroughtDays`)
 * and the day every tree is bare. The garden module has no setting for it: the rules only say
 * "6 to 9: the trees lose their leaves". The pictures cut that stretch in two, half the trees
 * bare, then all of them. The scene never goes past the start of the dying phase (see
 * `foliageStageOf`).
 */
export const BARE_TREES_AFTER_WILTING_DAYS = 2;

/**
 * How long each picture stays when a state jumps several steps (decision D26). Drying is slow
 * enough to be watched; reviving takes half the time ("plus vite qu'il n'a séché").
 */
export const STEP_DURATION_MS = { decay: 600, recovery: 300 } as const;

/** Never more than this many pictures between two numbers of elements, however far apart. */
export const MAX_ELEMENT_STEPS = 5;

/**
 * A whole transition never lasts longer than this: nobody waits for it (motion.md › Providing
 * feedback: let people cancel motion). The steps get shorter instead.
 */
export const MAX_TRANSITION_MS = 4000;

/** No step is shorter than this: below it a cross-fade can no longer be seen. */
export const MIN_STEP_DURATION_MS = 150;
