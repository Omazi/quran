/**
 * WCAG 2 contrast ratio between two opaque sRGB colours, the measure Apple's Accessibility
 * Inspector uses (accessibility.md › Vision). Test support: the app itself never computes it.
 */

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const CHANNEL_MAX = 255;

// Constants of the WCAG 2 definition of relative luminance.
const LINEAR_THRESHOLD = 0.04045;
const LINEAR_DIVISOR = 12.92;
const GAMMA_OFFSET = 0.055;
const GAMMA_DIVISOR = 1.055;
const GAMMA_EXPONENT = 2.4;
const RED_WEIGHT = 0.2126;
const GREEN_WEIGHT = 0.7152;
const BLUE_WEIGHT = 0.0722;
const FLARE = 0.05;

function linearize(channel: number): number {
  const ratio = channel / CHANNEL_MAX;
  return ratio <= LINEAR_THRESHOLD
    ? ratio / LINEAR_DIVISOR
    : ((ratio + GAMMA_OFFSET) / GAMMA_DIVISOR) ** GAMMA_EXPONENT;
}

/** Relative luminance of a `#RRGGBB` colour, from 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  if (!HEX_COLOR.test(hex)) throw new TypeError(`Expected a #RRGGBB colour, received "${hex}".`);
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  return (
    RED_WEIGHT * linearize(red) + GREEN_WEIGHT * linearize(green) + BLUE_WEIGHT * linearize(blue)
  );
}

/** Contrast ratio between two `#RRGGBB` colours, from 1 to 21. The order does not matter. */
export function contrastRatio(first: string, second: string): number {
  const luminances = [relativeLuminance(first), relativeLuminance(second)];
  const lighter = Math.max(...luminances);
  const darker = Math.min(...luminances);
  return (lighter + FLARE) / (darker + FLARE);
}
