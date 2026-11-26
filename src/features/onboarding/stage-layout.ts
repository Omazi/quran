/**
 * Where each piece of the first launch's stage sits, from the size of the screen and its safe
 * area, as the owner's chosen prototype places them (`layout()`). Computed once per size; the
 * stage then moves the pieces with transforms only.
 */

import { GARDEN_PICTURE_PIXELS } from '@/features/garden';
import { voiceStoryLayout as L } from '@/ui';

export interface StageSize {
  readonly width: number;
  readonly height: number;
  /** The safe area's top and bottom insets. */
  readonly top: number;
  readonly bottom: number;
}

export interface StageLayout {
  readonly width: number;
  readonly height: number;
  readonly top: number;
  readonly bottom: number;
  /** The garden picture's box on the story pages. */
  readonly garden: {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
  };
  /** The recited line's top, the thread's centre line, the words' top. */
  readonly verseTop: number;
  readonly waveY: number;
  readonly copyTop: number;
  readonly glowTop: number;
  readonly hintTop: number;
  readonly brandTop: number;
  readonly dotsTop: number;
  /** Above the settings: the garden's lift from its story place, its scale on each page. */
  readonly previewLift: number;
  readonly goalScale: number;
  readonly remindersScale: number;
  readonly goalTop: number;
  readonly remindersTop: number;
  /** The mushaf page of the voice page: its top, side inset, text size and line height. */
  readonly pageTop: number;
  readonly pageTextSize: number;
  readonly pageLineHeight: number;
  /** The listening rosette: its radius and centre, then its centre once the passage is found. */
  readonly rosetteRadius: number;
  readonly rosetteY: number;
  readonly listenLabelTop: number;
}

const PICTURE_RATIO = GARDEN_PICTURE_PIXELS.width / GARDEN_PICTURE_PIXELS.height;

export function stageLayout({ width: W, height: H, top, bottom }: StageSize): StageLayout {
  if (!(W > 0) || !(H > 0)) throw new RangeError(`The stage needs a size, received ${W} × ${H}.`);
  const gardenHeight = Math.min((W * L.gardenWidthShare) / PICTURE_RATIO, H * L.gardenHeightShare);
  const gardenWidth = gardenHeight * PICTURE_RATIO;
  const gardenTop = top + Math.max(L.gardenTopMin, H * L.gardenTopShare);
  const verseTop = gardenTop + gardenHeight + Math.max(L.verseGapMin, H * L.verseGapShare);
  const waveY = verseTop + L.verseLineHeight + Math.max(L.waveGapMin, H * L.waveGapShare);
  const copyTop = Math.max(waveY + L.copyBelowWave, H - L.copyFromBottom - bottom);
  const previewTop = top + L.previewTop;
  const goalScale = Math.min(L.goalPreviewMax, (H * L.goalPreviewShare) / gardenHeight);
  const remindersScale = Math.min(
    L.remindersPreviewMax,
    (H * L.remindersPreviewShare) / gardenHeight,
  );
  const pageTextSize = Math.min(L.pageTextMax, (W - 4 * L.pageInset) / L.pageTextEms);
  const rosetteRadius = Math.min(W * L.rosetteWidthShare, H * L.rosetteHeightShare);
  const rosetteY =
    top + Math.min(H * L.rosetteTopShare, copyTop - rosetteRadius * L.rosetteAboveCopy);
  return {
    width: W,
    height: H,
    top,
    bottom,
    garden: {
      left: (W - gardenWidth) / 2,
      top: gardenTop,
      width: gardenWidth,
      height: gardenHeight,
    },
    verseTop,
    waveY,
    copyTop,
    glowTop: gardenTop + gardenHeight / 2 - L.glowHeight / 2,
    hintTop: H - bottom - L.hintFromBottom,
    brandTop: top + L.brandTop,
    dotsTop: H / 2 - L.dotsAboveCentre,
    previewLift: previewTop - gardenTop,
    goalScale,
    remindersScale,
    goalTop: previewTop + gardenHeight * goalScale + L.goalPanelGap,
    remindersTop: previewTop + gardenHeight * remindersScale + L.remindersPanelGap,
    pageTop: top + Math.max(L.pageTopMin, H * L.pageTopShare),
    pageTextSize,
    pageLineHeight: Math.round(pageTextSize * L.pageLineEm),
    rosetteRadius,
    rosetteY,
    listenLabelTop: rosetteY + rosetteRadius * L.rosetteLabelBelow,
  };
}
