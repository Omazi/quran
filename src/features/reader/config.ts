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
   * divided by this number, whatever the person's text size setting (spec 2, deviation 34 of the
   * register: the page is sized by width and enlarged by zoom).
   *
   * Measured, not chosen: every text line of the 604 pages was shaped with HarfBuzz in the
   * bundled font (KFGQPC HAFS v0.18), word by word, with the verse marks, items separated by the
   * font's space (0.22 em). Of the 8,820 lines, the median is 16.1 em, 99 % are at most 20.65 em,
   * the widest 23.1 em (page 507, line 7).
   *
   * The architect asked for about 18.5 em, provided no line shrinks by more than about 8 %. Both
   * cannot hold: at 18.5 em, 173 lines shrink by more than 8 % (30 even with the tightest gap
   * below), the widest by 15.5 %. At 19.5 em, with the tightest gap, 8,818 lines shrink by 8 % or
   * less; two do not: page 377 line 8 (8.5 %) and page 507 line 7 (10.9 %). That is the value
   * kept: the text is 6 % larger than at the former 20.7 em, and zoom does the rest.
   */
  lineWidthInEm: 19.5,

  /**
   * The share of the column a line must fill, at the page's size and with the font's space
   * between its items, to be spread word by word. A shorter line (the end of a surah) is centred
   * with the font's normal space, as the print does, instead of being torn apart. Architect's
   * decision; HarfBuzz counts 33 such lines outside pages 1 and 2 at 19.5 em.
   */
  minimumFillToJustify: 0.6,

  /**
   * Pages 1 and 2, printed with few, short, centred lines in a larger size (spec 2). Their widest
   * line, measured as above, is 15.15 em (page 2, line 4): the size is the column divided by
   * this, unless the lines would not fit in the height. Their lines are spread over the page up
   * to this distance, in ems, as the print spreads them.
   */
  openingPages: { lastPage: 2, lineWidthInEm: 15.2, lineHeightInEm: 3 },

  /**
   * Zoom of the page (spec 2, deviation 34): pinch from the page's size up to this factor, never
   * so far that one word fills the screen (scroll-views.md › Best practices: set appropriate
   * maximum and minimum scale values). A double tap toggles between the page's size and the
   * second factor (gestures.md › Standard gestures: double tap zooms in, then out).
   */
  zoom: {
    maximumScale: 3,
    doubleTapScale: 2,
    animationMs: 250,
    /**
     * A drag that reaches the edge of an enlarged page turns the page once the finger went this
     * far beyond it, in points; the page follows the finger by this share only, a small
     * resistance so that a drag stopping at the edge does not turn it by accident. Judgment,
     * no skill sets it.
     */
    edgeTurnDistance: 72,
    edgeResistance: 0.4,
  },

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
   * Height of the surah header's cartouche, as a share of its line: it stays inside its line, as
   * the printed cartouche does, and leaves air above and below. Judgment, no skill sets it.
   */
  surahHeaderHeightRatio: 0.84,

  /**
   * The surah name in the cartouche, as a share of the page's text size: the design review found
   * it small in its frame; 10 % larger fills it better and still fits the narrowest names
   * (checked on the longest, page 293 and 604). Judgment.
   */
  surahNameScale: 1.1,

  /** The normal space between two words, in ems: the space of the font (450 / 2,048 units). */
  wordGapInEm: 0.22,

  /**
   * The tightest space between two words, in ems: half the font's space. Only a line wider than
   * the column closes its gaps this far, before it is drawn smaller; the print sets its crowded
   * lines as tight. Chosen with the HarfBuzz measurements above.
   */
  tightestWordGapInEm: 0.11,

  /**
   * Height of the system navigation bar on an iPhone in portrait, which floats over the top of
   * the page: React Navigation's own table (`getDefaultHeaderHeight`). Elsewhere, Material's top
   * app bar. Not verified on iOS 26.
   */
  navigationBarHeight: { ios: 44, default: 64 },

  /** Words of the verse a juz starts with that its header shows, in the Quran font. Judgment. */
  juzOpeningWords: 3,
});
