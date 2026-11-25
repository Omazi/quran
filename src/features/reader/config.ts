/**
 * Settings of the reader (docs/specs/reader.md). Every number here is named and explained, as the
 * architecture asks (docs/ARCHITECTURE.md, "Règles transverses").
 */
export const READER_CONFIG = Object.freeze({
  /**
   * The time a page asks before it counts (spec 3; owner's decision of 25 November 2026): this
   * many seconds per word of that page of the mushaf, never less than the minimum, so that the
   * short pages count too (`requiredReadingSeconds` in the khatm module). The words of a page are
   * those of its verses in the Uthmani text: 29 on page 1, 129 for the median page (about 26
   * seconds), 161 at most (about 32 seconds). The time adds up across stays until it is reached.
   */
  readingTime: { secondsPerWord: 0.2, minimumSeconds: 8 },

  /**
   * The water line that shows a page being counted, under the title (spec 3): its width, its
   * thickness, how long it takes to follow a new value, and, with Reduce Motion, the number of
   * still steps it moves by. A thin line, the width of the pill's drop and a few words: discreet,
   * never over the text. Judgment.
   */
  progressLine: { width: 72, thickness: 3, followMs: 900, reducedMotionSteps: 3 },

  /**
   * Past this speed, in screens per second, the text is flung, not read: no time counts and no
   * edge is "seen" (spec 3, D41). A reader moves the text a few lines at a time, well under one
   * screen a second; a fling starts at several screens a second. Judgment, no skill sets it: to
   * check on an iPhone.
   */
  flingScreensPerSecond: 1.5,

  /**
   * How often the reader looks at the screen while nothing moves, in seconds: a page read without
   * scrolling still counts when its time is up, and the pill says so. Cheap: one pure function.
   */
  trackingTickSeconds: 1,

  /**
   * The reading line, as a share of the visible text from its top: the bar names the surah and
   * page under it, and the page to resume is that page. A third down is where the eyes rest while
   * scrolling text; quran.com's reading mode follows the band between its bar and 70 % of the
   * screen (docs/specs/reader.md, comparison). Judgment.
   */
  readingLineRatio: 1 / 3,

  /**
   * How long the watered pill stays in the bar after a page counted, before the title of the page
   * comes back (spec 3). Brief, because it takes the place of the title; VoiceOver hears it when it
   * comes, and the garden keeps the water. A time-boxed element is a deviation to
   * accessibility.md › Cognitive (deviation 64 of the register). Judgment.
   */
  feedbackSeconds: 4,

  /**
   * The entrance of the watered pill: the system's snappy spring (animation-patterns,
   * core-animations.md › Spring Presets: `.snappy` is 0.3 s with a bounce of 0.15, so a damping
   * ratio of 0.85), from this scale and transparent to its size and opaque. Brief and tied to the
   * page that counted (motion.md › Aim for brevity and precision in feedback animations). With
   * Reduce Motion it simply appears (spec 3).
   */
  feedbackEntrance: { durationMs: 300, dampingRatio: 0.85, fromScale: 0.9 },

  /**
   * The reader's own text size control (D41), on top of the phone's text size, which the Quran
   * text follows anyway (typography.md › Supporting Dynamic Type). One factor per step of the
   * store's `READER_TEXT_SIZE_RANGE`; the first launch is on the factor 1. One step smaller for a
   * reader who wants more text per screen, three larger ones for a reader who wants the marks
   * bigger without changing every app. Judgment, in the spirit of reading apps' "Aa" control.
   */
  textSizeScales: [0.85, 1, 1.2, 1.4, 1.65],

  /**
   * Verses are justified, like a printed page, up to this text size factor; larger, they are
   * aligned to the right edge (the start of Arabic): with four or five words a line, justified
   * Arabic without kashida opens wide holes between words (seen on the web screenshots at the
   * largest step). Judgment, after typography.md › Ensuring legibility.
   */
  justifyUpToScale: 1.2,

  /**
   * The end-of-verse mark of the simple script: the verse number in Arabic-Indic digits between
   * the ornate parentheses of Unicode (U+FD3F, U+FD3E), first the one that opens on the right.
   * The simple font has no verse-mark glyph of its own, unlike the King Fahd font.
   */
  simpleVerseMark: { open: '﴿', close: '﴾' },

  /**
   * The surah header in the scroll: its cartouche is this many times the line height of the text
   * tall, its name this share of the text size, and the two words at its ends this share, never
   * under the smallest size of the interface. Measured on the mockup's cartouche
   * (docs/design/mushaf.png: about 36 points for a 22-point text). Judgment.
   */
  surahHeader: { heightInLines: 1.15, nameScale: 1.1, labelScale: 0.62 },

  /**
   * The list of pages: how many sections are added above the first one when the reader nears the
   * top (the list opens on the page asked and grows upwards on demand), how many sections it
   * renders first, and how many screens it keeps drawn around the visible one (FlatList
   * `windowSize`: 5 is two screens above and two below). Enough to scroll smoothly without holding
   * the 604 pages; to measure on an iPhone X.
   */
  list: { pagesAddedAbove: 10, initialSections: 3, windowSize: 7, nearTopScreens: 1 },

  /**
   * Height of the system navigation bar on an iPhone in portrait, which floats over the top of
   * an empty reader: React Navigation's own table (`getDefaultHeaderHeight`). Elsewhere,
   * Material's top app bar. Not verified on iOS 26.
   */
  navigationBarHeight: { ios: 44, default: 64 },

  /**
   * The surah a search with no result gives as an example of what to type (writing.md › Provide
   * clear next steps): Al-Kahf, a name most readers know, short in every language. Judgment.
   */
  searchExampleSurah: 18,

  /** Words of the verse a juz starts with that its header shows, in the Quran font. Judgment. */
  juzOpeningWords: 3,
});
