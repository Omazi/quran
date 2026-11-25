/**
 * The size of the page text and the fitting of each line (docs/specs/reader.md, section 2).
 * Lines fill the width by layout and size only: the space between the words grows, and a line
 * too wide for the column is drawn a little smaller. The text itself is never touched: no
 * character is added, removed or moved.
 */

import { LINES_PER_PAGE } from '@/domain/quran';
import { layout, spacing } from '@/ui';

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
  /** The font's own space between two words, in points: centred lines keep it. */
  readonly wordGap: number;
  /** The tightest space between two words, in points: only a line too wide goes down to it. */
  readonly tightestGap: number;
}

/**
 * Room the frame of the page takes above and below the lines: the gap between the rule and the
 * text, and the rule itself. The frame sits in the side margins, so it takes no width.
 */
export const PAGE_FRAME_ROOM = spacing.sm + layout.outlineWidth;

function columnOf({ width, height }: PageArea): { textWidth: number; linesHeight: number } {
  const textWidth = width - 2 * layout.screenMargin;
  const linesHeight = height - 2 * PAGE_FRAME_ROOM;
  if (!(textWidth > 0) || !(linesHeight > 0)) {
    throw new RangeError(`No room for a page: ${width} by ${height} points.`);
  }
  return { textWidth, linesHeight };
}

function metricsOf(fontSize: number, lineHeight: number, textWidth: number): PageMetrics {
  return {
    fontSize,
    lineHeight,
    textWidth,
    wordGap: fontSize * READER_CONFIG.wordGapInEm,
    tightestGap: fontSize * READER_CONFIG.tightestWordGapInEm,
  };
}

/**
 * The size of the page text, from the room the screen gives: as wide as the column allows (see
 * `READER_CONFIG.lineWidthInEm`), unless the 15 lines would then not fit in the height. The text
 * size setting of the person is not read: the page is composed like an image, and enlarged by
 * zoom (spec 2, deviation 30).
 */
export function computePageMetrics(area: PageArea): PageMetrics {
  const { textWidth, linesHeight } = columnOf(area);
  const fontSize = Math.min(
    textWidth / READER_CONFIG.lineWidthInEm,
    linesHeight / (LINES_PER_PAGE * READER_CONFIG.minimumLineHeightInEm),
  );
  const lineHeight = Math.min(
    linesHeight / LINES_PER_PAGE,
    fontSize * READER_CONFIG.lineHeightInEm,
  );
  return metricsOf(fontSize, lineHeight, textWidth);
}

/**
 * The size of pages 1 and 2, whose few lines the print sets larger and spreads over the page:
 * their widest line takes the column (`READER_CONFIG.openingPages`), unless their lines would
 * then not fit in the height; the lines then share the height, up to the print's spacing.
 */
export function computeOpeningPageMetrics(area: PageArea, lineCount: number): PageMetrics {
  if (!Number.isInteger(lineCount) || lineCount < 1 || lineCount > LINES_PER_PAGE) {
    throw new RangeError(`An opening page has 1 to ${LINES_PER_PAGE} lines, not ${lineCount}.`);
  }
  const { textWidth, linesHeight } = columnOf(area);
  const { openingPages } = READER_CONFIG;
  const fontSize = Math.min(
    textWidth / openingPages.lineWidthInEm,
    linesHeight / (lineCount * READER_CONFIG.minimumLineHeightInEm),
  );
  const lineHeight = Math.min(linesHeight / lineCount, fontSize * openingPages.lineHeightInEm);
  return metricsOf(fontSize, lineHeight, textWidth);
}

/** Whether a page is one of the two opening pages, set apart by the print. */
export function isOpeningPage(page: number): boolean {
  return page <= READER_CONFIG.openingPages.lastPage;
}

export interface LineFitInput {
  /** Width of each word and verse mark of the line, drawn at the page's text size. */
  readonly itemWidths: readonly number[];
  /** Width of the text column. */
  readonly available: number;
  /** The font's space, at the page's text size. */
  readonly wordGap: number;
  /** The tightest gap between two items, at the page's text size. */
  readonly tightestGap: number;
}

export interface LineFit {
  /** 1 for a line that fits; below 1, the factor that makes it fit. */
  readonly scale: number;
  /**
   * Whether the line is spread across the column word by word. Otherwise it is centred, its
   * items separated by the font's space.
   */
  readonly justify: boolean;
}

/**
 * How a line is laid out (architect's rule): it is spread word by word only when, with the
 * font's space between its items, it fills at least `minimumFillToJustify` of the column; a
 * shorter line is centred. A line wider than the column first closes its gaps down to the
 * tightest gap, then, if it still does not fit, is drawn smaller: words and gaps shrink together,
 * so the factor is the ratio of the two widths.
 */
export function fitLine({ itemWidths, available, wordGap, tightestGap }: LineFitInput): LineFit {
  if (itemWidths.length === 0) throw new RangeError('A line has at least one word.');
  const glyphs = itemWidths.reduce((total, width) => total + width, 0);
  const gaps = itemWidths.length - 1;
  const natural = glyphs + wordGap * gaps;
  const justify = gaps > 0 && natural >= available * READER_CONFIG.minimumFillToJustify;
  const tightest = glyphs + tightestGap * gaps;
  return { scale: tightest <= available ? 1 : available / tightest, justify };
}
