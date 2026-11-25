/**
 * Settings of the reader (docs/specs/reader.md). Every number here is named and explained, as the
 * architecture asks (docs/ARCHITECTURE.md, "Règles transverses").
 */
export const READER_CONFIG = Object.freeze({
  /**
   * A page counts once the person stayed on it this long, app in the foreground, then turned the
   * page or left the reader (spec 3). Starting value given by the spec: **to be confirmed by the
   * owner**.
   */
  minimumSecondsOnPage: 30,

  /**
   * The width of the text column, in ems of the Quran font: the font size is the column width
   * divided by this number, whatever the person's text size setting (spec 2, deviation to
   * `typography.md › Supporting Dynamic Type`).
   *
   * Measured, not chosen: every text line of the 604 pages was shaped with HarfBuzz in the
   * bundled font (KFGQPC HAFS v0.18), word by word with a space between words and the verse
   * marks included. Of the 8,820 lines, 99 % are at most 20.65 em wide (median 16.1, widest
   * 23.1, on page 507). The 1 % of wider lines are shrunk one by one, on the device, to fit
   * (`fitLine`). Choosing the widest line instead would make every page 12 % smaller.
   */
  lineWidthInEm: 20.7,

  /**
   * Distance between two lines, in ems: about the proportion of the printed Medina page (a text
   * block about 1.6 times as tall as it is wide, in 15 lines). Used when the screen is tall
   * enough; otherwise the 15 lines share the height.
   */
  lineHeightInEm: 2.5,

  /**
   * The smallest distance between two lines, in ems: the font's own line height is 1.76 em
   * (ascent 2,400 and descent 1,200 for 2,048 units); the margin keeps the marks of two lines
   * apart. A screen too short for this gets a smaller text instead.
   */
  minimumLineHeightInEm: 1.9,

  /**
   * Height of the surah header's frame, as a share of its line: the frame stays inside its line,
   * as the printed cartouche does, and leaves air above and below. Judgment, no skill sets it.
   */
  surahHeaderHeightRatio: 0.8,

  /** The smallest space between two words, in ems: the space of the font (450 / 2,048 units). */
  wordGapInEm: 0.22,

  /**
   * Height of the system navigation bar on an iPhone in portrait, which floats over the top of
   * the page: React Navigation's own table (`getDefaultHeaderHeight`). Elsewhere, Material's top
   * app bar. Not verified on iOS 26.
   */
  navigationBarHeight: { ios: 44, default: 64 },
});
