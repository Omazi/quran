/**
 * Where the reader's floating pieces lie on the screen (validated mockup of 27 November 2026,
 * `.rd-top`, `.rd-bar`, `.rd-toast`, `.rd-scroll`'s mask): the text runs the full height of the
 * screen and fades under the glass controls; the pill of the drop sits above the bottom bar, or
 * under the top controls (`READER_CONFIG.dropPill.position`). Pure: the window and the safe area
 * are parameters; every length is a token of the design system.
 */

import { readerShapes, spacing } from '@/ui';

import { READER_CONFIG } from './config';

export interface ReaderGeometryInput {
  readonly windowHeight: number;
  readonly insets: { readonly top: number; readonly bottom: number };
  readonly pillPosition: 'bottom' | 'top';
}

export interface ReaderGeometry {
  /** Where the top controls start, and where they end. */
  readonly topBarTop: number;
  readonly topBarBottom: number;
  /** Where the bottom bar ends, from the bottom of the screen, and where it starts from the top. */
  readonly bottomBarOffset: number;
  readonly bottomBarTop: number;
  /** The room the text keeps above its first line and below its last, under the controls. */
  readonly contentTop: number;
  readonly contentBottom: number;
  /** The text is hidden down to the first, then fades in down to the second (and up at the bottom). */
  readonly fadeTopStart: number;
  readonly fadeTopEnd: number;
  readonly fadeBottomStart: number;
  readonly fadeBottomEnd: number;
  /** The pill: its distance to the bottom (or top) of the screen, and the height of its middle. */
  readonly pillOffset: number;
  readonly pillCenterY: number;
  /** The highest and lowest points a drop starts from: in the clear text, above the pill. */
  readonly dropMinY: number;
  readonly dropMaxY: number;
}

export function readerGeometry({
  windowHeight,
  insets,
  pillPosition,
}: ReaderGeometryInput): ReaderGeometry {
  const {
    glassControl,
    glassBarHeight,
    glassTopGap,
    glassBottomGap,
    fadeTop,
    fadeBottom,
    dropPillHeight,
    dropPillGap,
  } = readerShapes;
  const topBarTop = insets.top + glassTopGap;
  const topBarBottom = topBarTop + glassControl;
  const bottomBarOffset = insets.bottom + glassBottomGap;
  const bottomBarTop = windowHeight - bottomBarOffset - glassBarHeight;
  // The mockup's mask: hidden down to the middle of the controls, clear one fade further.
  const fadeTopStart = topBarTop + glassControl / 2;
  const fadeTopEnd = fadeTopStart + fadeTop;
  const fadeBottomEnd = bottomBarTop + glassBarHeight / 2 - glassBottomGap;
  const fadeBottomStart = fadeBottomEnd - fadeBottom;
  const pillOffset =
    pillPosition === 'bottom'
      ? bottomBarOffset + glassBarHeight + dropPillGap
      : topBarBottom + dropPillGap;
  const pillCenterY =
    pillPosition === 'bottom'
      ? windowHeight - pillOffset - dropPillHeight / 2
      : pillOffset + dropPillHeight / 2;
  const { minimumFallPoints } = READER_CONFIG.drop;
  const dropMinY = fadeTopEnd;
  const dropMaxY =
    pillPosition === 'bottom'
      ? Math.max(dropMinY, pillCenterY - minimumFallPoints)
      : fadeBottomStart;
  return {
    topBarTop,
    topBarBottom,
    bottomBarOffset,
    bottomBarTop,
    contentTop: fadeTopEnd + spacing.sm,
    contentBottom: windowHeight - fadeBottomStart + spacing.xl,
    fadeTopStart,
    fadeTopEnd,
    fadeBottomStart,
    fadeBottomEnd,
    pillOffset,
    pillCenterY,
    dropMinY,
    dropMaxY,
  };
}

/** Where a drop starts: at the end of its page's text, kept in the clear part of the screen. */
export function dropStartY(
  pageEndOnScreen: number | null,
  geometry: Pick<ReaderGeometry, 'dropMinY' | 'dropMaxY'>,
): number {
  if (pageEndOnScreen === null) return geometry.dropMaxY;
  return Math.min(geometry.dropMaxY, Math.max(geometry.dropMinY, pageEndOnScreen));
}
