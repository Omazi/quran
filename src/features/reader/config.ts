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
   * The water thread in the margin of each page (validated mockup of 27 November 2026, shots 20 to
   * 22; it replaces the water line under the title): how long its fill takes to follow a new value,
   * and, with Reduce Motion, the number of still steps it moves by (the rule of the water line it
   * replaces, spec 3). How long the light that runs down a filling thread takes to pass (the
   * mockup's `flow`, 1.6 s, its light at 80 %), and how pale a thread is once its page counted
   * (the mockup's 45 %).
   */
  thread: {
    followMs: 900,
    reducedMotionSteps: 3,
    flowMs: 1600,
    flowOpacity: 0.8,
    doneOpacity: 0.45,
  },

  /**
   * The paper of the page by day, the night page at night (owner's decision of 27 November 2026):
   * the minute of the local day at which the paper comes, and the one at which the night page
   * comes. They are where the validated mockup's sky turns (docs/design/maquette-wow, `js/sky.js`:
   * the theme turns "night" when the top of the sky falls under 16 % luminance, at 17:56, and
   * "day" again at 06:11). Fixed hours, not the sun's: the app does not ask where the person is.
   * The phone's dark appearance always gives the night page. How often the reader looks at the
   * clock while it is open, in seconds.
   */
  paper: { dayStartsAtMinute: 6 * 60 + 11, nightStartsAtMinute: 17 * 60 + 56, recheckSeconds: 60 },

  /**
   * The drop that falls from the end of a page's thread into the glass pill when the page counts,
   * as the validated mockup times it (`js/fx.js`, `drop()`): it forms at the end of the thread with
   * an overshoot (380 ms, the curve (0.34, 1.56, 0.64, 1)), waits a moment, then falls with gravity
   * for 620 ms plus 0.45 ms per point of height, at most 400 ms more. It stretches with its speed,
   * up to 55 % longer. Then a few droplets splash where it lands.
   */
  drop: {
    formMs: 380,
    holdMs: 90,
    fallBaseMs: 620,
    fallMsPerPoint: 0.45,
    fallExtraMaxMs: 400,
    maxStretch: 0.55,
    stretchPerPointPerFrame: 0.04,
    /** The drop starts at least this far above the pill, as in the mockup (`H - 240`). */
    minimumFallPoints: 96,
    splashMs: 520,
    splashDroplets: 6,
  },

  /**
   * The glass pill the drop falls into (shots 21, 22), at the bottom above the controls: the
   * owner's decision of 27 November 2026, where the drop falls the way water falls. How long it stays
   * once the drop has landed: 4 s, the time of the pill it replaces (deviation 64), where the
   * mockup waits 2.4 s, short for two lines read with VoiceOver or at a large text size. Its small
   * bounce when the drop lands (the mockup's 420 ms to 106 %, curve (0.34, 1.56, 0.64, 1)).
   */
  /**
   * The text size panel fades in and out (the mockup's 220 ms), and the day's counter fades its new
   * number in when a drop lands (the mockup's 420 ms). Without movement with Reduce Motion.
   */
  sizePanelMs: 220,
  counterMs: 420,

  dropPill: {
    visibleSeconds: 4,
    bounceMs: 420,
    bounceScale: 1.06,
  },

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
   * The entrance of the glass pill of the drop: the system's snappy spring (animation-patterns,
   * core-animations.md › Spring Presets: `.snappy` is 0.3 s with a bounce of 0.15, so a damping
   * ratio of 0.85), from this scale and transparent to its size and opaque. Brief and tied to the
   * page that counted (motion.md › Aim for brevity and precision in feedback animations). With
   * Reduce Motion it simply appears (spec 3).
   */
  feedbackEntrance: { durationMs: 300, dampingRatio: 0.85, fromScale: 0.96 },

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
   * The surah header in the scroll, the framed gold title of the validated mockup of 27 November
   * 2026 (`.rd-head .frame`: a 54-point frame, a 30-point name over a 25-point text): the frame is
   * at least this many times the line height of the text tall, the name this share of the text size,
   * and its inner rule at 70 %.
   */
  surahHeader: { heightInLines: 1.15, nameScale: 1.2, innerRuleOpacity: 0.7 },

  /**
   * Following a recitation (spec 3b): how many pages of words the voice is followed on at a time,
   * how close to their end more are added, and how long a silence ends the listening (no word
   * heard). The scroll keeps the current line at the reading line; with Reduce Motion it jumps a
   * line at a time instead of gliding. Judgment, to try on an iPhone.
   */
  follow: { pagesAhead: 3, extendWithinWords: 60, silenceSeconds: 20 },

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
