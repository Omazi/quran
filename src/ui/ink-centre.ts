/**
 * Centring a line of Arabic by its ink, not by its box.
 *
 * A font keeps room above and below its letters for its marks, and Arabic fonts keep a lot of it:
 * Amiri's box is 1.76 times its size, and its letters do not sit in the middle of that box. A
 * title centred by its box therefore looks low in a frame (the defect the owner caught on the
 * surah header, 27 November 2026). `centredLine` gives the line height and the small lift that
 * put the band of the letters, from the top of alif-lam to the bowls of ra and waw, in the middle
 * of the line. The measures are read from the font files by `tools/design-qa/font_band.py`
 * (docs/design/POLISH-CHECKLIST.md); `__tests__/ink-centre.test.ts` checks them against the files.
 */

import { fontFamily } from './tokens';

/** The vertical measures of a font, in ems (multiples of the font size). */
export interface InkMetrics {
  /** What the layout engines take above and below the baseline for a line (table `hhea`). */
  readonly ascent: number;
  readonly descent: number;
  /** The band of letters without marks: its top above the baseline, its bottom below it. */
  readonly bandTop: number;
  readonly bandBottom: number;
  /** The furthest any text written in this font here goes above the baseline, and below it. */
  readonly inkTop: number;
  readonly inkBottom: number;
}

/**
 * The fonts of the Arabic titles drawn inside a frame, by the name of their token.
 * `quranTitle` (Amiri Bold): the band is the median of the 114 titles "سورة …" of the reader
 * (`font_band.py --surah-titles`), so that every title keeps the same baseline in its frame; the
 * ink goes up to the hamza of «سورة الأنعام» and down to the final mim of «سورة القلم».
 */
export const inkMetrics = {
  quranTitle: {
    ascent: 1.124,
    descent: 0.634,
    bandTop: 0.74,
    bandBottom: 0.292,
    inkTop: 1.005,
    inkBottom: 0.663,
  },
} as const satisfies Partial<Record<keyof typeof fontFamily, InkMetrics>>;

export interface CentredLine {
  /** The line height to give the text, in points. */
  readonly lineHeight: number;
  /** The vertical translation to give it, in points; negative lifts the text. */
  readonly translateY: number;
}

/**
 * The line of a single-line text of `fontSize` points whose letters are to sit in the middle of
 * it, when the layout would give it `lineHeight` points.
 *
 * The line is never shorter than the font's own box. In a line that holds its font, iOS, Android
 * and the web all put the font's box in the middle of the line, so one lift is right everywhere;
 * in a shorter line iOS cuts the top of the box instead and the text sits high
 * (`RCTApplyBaselineOffsetForRange` leaves such a line alone).
 *
 * Nor is it shorter than the ink: with the band in the middle, the tallest and the deepest text of
 * the font stay inside the line. A frame that pads this line by a few points therefore never
 * touches a letter, at any text size: the line grows with Dynamic Type as the font does.
 */
export function centredLine(
  metrics: InkMetrics,
  fontSize: number,
  lineHeight: number,
): CentredLine {
  const fontBox = (metrics.ascent + metrics.descent) * fontSize;
  const boxMiddle = (metrics.ascent - metrics.descent) / 2;
  const bandMiddle = (metrics.bandTop - metrics.bandBottom) / 2;
  const inkAroundMiddle =
    2 * Math.max(metrics.inkTop - bandMiddle, metrics.inkBottom + bandMiddle) * fontSize;
  return {
    lineHeight: Math.max(lineHeight, Math.ceil(Math.max(fontBox, inkAroundMiddle))),
    translateY: (bandMiddle - boxMiddle) * fontSize,
  };
}
