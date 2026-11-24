/**
 * Presentation settings of the garden on screen: sizes, symbols and colour roles. No rule of the
 * garden lives here; the rules are in `@/domain/garden`.
 */

import { GARDEN_CATALOG, type GardenPhase, type WaterState } from '@/domain/garden';
import { spacing, type IconSymbol, type LabelRowTone, type StatusTone } from '@/ui';

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
