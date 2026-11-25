/**
 * The size of the page text and the fitting of each line (docs/specs/reader.md, section 2).
 * Lines fill the width by layout and size only: the space between the words grows, and a line
 * too wide for the column is drawn a little smaller. The text itself is never touched: no
 * character is added, removed or moved.
 */

import { LINES_PER_PAGE } from '@/domain/quran';
import { layout } from '@/ui';

import { READER_CONFIG } from './config';

export interface PageArea {
  /** Width of the screen given to one page, in points. */
  readonly width: number;
  /** Height left to the 15 lines, in points. */
  readonly height: number;
}

export interface PageMetrics {
  /** Size of the Quran text, in points. */
  readonly fontSize: number;
  /** Distance between two lines, in points: each line is a row of this height. */
  readonly lineHeight: number;
  /** Width of the text column, in points. */
  readonly textWidth: number;
  /** Smallest space between two words, in points. */
  readonly minimumGap: number;
}

/**
 * The size of the page text, from the room the screen gives: as wide as the column allows (see
 * `READER_CONFIG.lineWidthInEm`), unless the 15 lines would then not fit in the height. The text
 * size setting of the person is not read: the page is composed like an image (spec 2).
 */
export function computePageMetrics({ width, height }: PageArea): PageMetrics {
  const textWidth = width - 2 * layout.screenMargin;
  if (!(textWidth > 0) || !(height > 0)) {
    throw new RangeError(`No room for a page: ${width} by ${height} points.`);
  }
  const fontSize = Math.min(
    textWidth / READER_CONFIG.lineWidthInEm,
    height / (LINES_PER_PAGE * READER_CONFIG.minimumLineHeightInEm),
  );
  const lineHeight = Math.min(height / LINES_PER_PAGE, fontSize * READER_CONFIG.lineHeightInEm);
  return { fontSize, lineHeight, textWidth, minimumGap: fontSize * READER_CONFIG.wordGapInEm };
}

export interface LineFitInput {
  /** Width of each word and verse mark of the line, drawn at the page's text size. */
  readonly itemWidths: readonly number[];
  /** Width of the text column. */
  readonly available: number;
  /** Smallest space between two items, at the page's text size. */
  readonly minimumGap: number;
}

export interface LineFit {
  /** 1 for a line that fits; below 1, the factor that makes it fit. */
  readonly scale: number;
}

/**
 * Whether a line fits the column at the page's text size, and how much smaller it must be drawn
 * if not. Words and gaps shrink together, so the factor is the ratio of the two widths.
 */
export function fitLine({ itemWidths, available, minimumGap }: LineFitInput): LineFit {
  if (itemWidths.length === 0) throw new RangeError('A line has at least one word.');
  const natural =
    itemWidths.reduce((total, width) => total + width, 0) + minimumGap * (itemWidths.length - 1);
  return { scale: natural <= available ? 1 : available / natural };
}
