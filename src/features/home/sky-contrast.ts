/**
 * The glass and the words over the home garden's sky stay readable at every hour (maquette-wow,
 * README: "le coucher de soleil est le cas le plus délicat"; accessibility.md › Vision: 4.5:1 for
 * text, 3:1 for large text). Pure: the sky behind, the glass's tint and the words on it in; the
 * least opacity of the tint that lets every word reach its contrast out.
 */

import { mixHex, relativeLuminance, type SkyState } from '@/features/garden';

/** A colour of words and the contrast it needs (4.5 for text, 3 for large text). */
export interface Ink {
  readonly color: string;
  readonly minimum: number;
}

export const TEXT_CONTRAST = 4.5;
export const LARGE_TEXT_CONTRAST = 3;

/** How finely the opacity is searched. */
const STEP = 0.01;

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * The least opacity, from `least`, of the tint `veil` over each colour of `behind` at which every
 * ink reaches its contrast. 1 when even the tint alone cannot (it then does what it can).
 */
export function veilOpacityFor(
  behind: readonly string[],
  veil: string,
  inks: readonly Ink[],
  least: number,
): number {
  if (!(least >= 0 && least <= 1))
    throw new RangeError(`An opacity goes from 0 to 1, not ${least}.`);
  for (let alpha = least; alpha < 1; alpha = Math.round((alpha + STEP) * 100) / 100) {
    const reads = behind.every((colour) => {
      const surface = mixHex(colour, veil, alpha);
      return inks.every((ink) => contrastRatio(ink.color, surface) >= ink.minimum);
    });
    if (reads) return alpha;
  }
  return 1;
}

/** Where each piece floats, as colours of the sky behind it (the gradient at 0, 46, 82, 100 %). */
export function skyBehind(sky: SkyState): {
  readonly header: readonly string[];
  readonly panel: readonly string[];
} {
  const bottom = mixHex(sky.low, sky.mid, 0.25);
  return {
    // The date and title, from the top of the screen down to a quarter of it.
    header: [sky.top, mixHex(sky.top, sky.mid, 0.55)],
    // The panel, from about 60 % of the height to the tab bar.
    panel: [mixHex(sky.mid, sky.low, 0.4), sky.low, bottom],
  };
}
