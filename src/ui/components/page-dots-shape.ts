/**
 * Sizes of the page dots, measured on the validated prototype
 * (docs/design/premier-lancement-prototype.html, `.pc i`), in points.
 */
export const PAGE_DOTS = {
  /** A dot. */
  dot: 8,
  /** The current page's dot is longer: a capsule. */
  currentWidth: 20,
  /** The dots three and four pages away shrink, hinting that more pages follow. */
  smallDot: 6,
  smallerDot: 4,
  /** Space between two dots. */
  gap: 8,
  /** The capsule under the dots: its height, and the space at its ends. */
  capsuleHeight: 36,
  capsulePadding: 14,
} as const;

export interface PageDotShape {
  readonly width: number;
  readonly height: number;
  /** The space the dot keeps from its neighbour; none once it is hidden. */
  readonly spacing: number;
  /** 1 for the current page, 0 for the others: how much of the current page's colour it takes. */
  readonly emphasis: number;
}

/** The size of a dot at each whole distance from the current page; 5 pages away it is gone. */
const STEPS: readonly PageDotShape[] = [
  { width: PAGE_DOTS.currentWidth, height: PAGE_DOTS.dot, spacing: PAGE_DOTS.gap, emphasis: 1 },
  { width: PAGE_DOTS.dot, height: PAGE_DOTS.dot, spacing: PAGE_DOTS.gap, emphasis: 0 },
  { width: PAGE_DOTS.dot, height: PAGE_DOTS.dot, spacing: PAGE_DOTS.gap, emphasis: 0 },
  { width: PAGE_DOTS.smallDot, height: PAGE_DOTS.smallDot, spacing: PAGE_DOTS.gap, emphasis: 0 },
  {
    width: PAGE_DOTS.smallerDot,
    height: PAGE_DOTS.smallerDot,
    spacing: PAGE_DOTS.gap,
    emphasis: 0,
  },
  { width: 0, height: 0, spacing: 0, emphasis: 0 },
];

/**
 * The shape of a dot at a distance, in pages, from the position of the pager: the current page is
 * a capsule, its neighbours are dots, the dots further away shrink and then disappear, as the
 * system control shrinks the indicators at its ends (page-controls.md › Mobile). Continuous, so
 * the dots change with the finger rather than jumping when a page is reached.
 */
export function pageDotShape(distance: number): PageDotShape {
  'worklet';
  const away = Math.abs(distance);
  const last = STEPS.length - 1;
  if (away >= last) return STEPS[last] as PageDotShape;
  const step = Math.floor(away);
  const along = away - step;
  const from = STEPS[step] as PageDotShape;
  const to = STEPS[step + 1] as PageDotShape;
  const mix = (a: number, b: number) => a + (b - a) * along;
  if (along === 0) return from;
  return {
    width: mix(from.width, to.width),
    height: mix(from.height, to.height),
    spacing: mix(from.spacing, to.spacing),
    emphasis: mix(from.emphasis, to.emphasis),
  };
}
