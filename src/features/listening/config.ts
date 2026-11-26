/**
 * Named settings of the listening screen.
 *
 * The geometry and the motion are those of the validated prototype
 * (`gen/ecoute/styles/site/index.html`, outside the repository; docs/DECISIONS.md D27, D29):
 * each value says where it comes from in that file. Times are in seconds unless the name says
 * otherwise, sizes in points or as a share of the screen.
 */

/**
 * The still rosette that marks "recognize a passage" outside the listening page (maquettes
 * 2026-11-26, 3A and 3C, drawn by their `rosette()`): the outer star at 94 % of the half side,
 * the three lines' widths (inside, outer star, heart) times one weight, and the halo of three
 * stars behind it on the green card (radius 108 of 115, 30 apart, a 1-point line).
 */
export const ROSETTE_MARK = {
  radiusShare: 0.94,
  insideWidth: 0.9,
  outerWidth: 1.3,
  heartWidth: 1.5,
  weight: 1.2,
  haloStars: 3,
  haloRadiusShare: 108 / 115,
  haloStepShare: 30 / 115,
  haloWidth: 1,
} as const;

export const ROSETTE_GEOMETRY = {
  /** The centre of the rosette, as a share of the screen width and height (`W * 0.5, H * 0.38`). */
  centreX: 0.5,
  centreY: 0.38,
  /** Radius of the outer star: the smaller of these shares of the width and height (`drawRosette`). */
  radiusOfWidth: 0.262,
  radiusOfHeight: 0.168,
  /**
   * How much the whole drawing grows at full voice. The prototype had `1 + 0.02 * level`, fed by
   * a simulated voice; on the iPhone the owner could not tell whether the phone heard him
   * (deviation 123): the rosette now swells visibly with the real voice.
   */
  levelGrowth: 0.08,
  /**
   * Where the two squares cross, as a share of the radius (`HOLLOW`): cos(45°) / cos(22.5°).
   * Written out because it is the definition, not a tuned value.
   */
  hollow: Math.SQRT1_2 / Math.cos(Math.PI / 8),
  /** Where the eight small squares meet: the radius of the heart star (`INNER = √2 − 1`). */
  inner: Math.SQRT2 - 1,
  /** How far a petal's tip reaches past the star while it is still sharp (`1 + 0.16 * …`). */
  petalTipReach: 0.16,
  /** Line widths in points (`ctx.lineWidth = … * dpr`). */
  heartWidth: 1.5,
  outerWidth: 1.25,
  insideWidth: 1.05,
  /** A petal's line starts at this width and loses `petalWidthLoss` over its life. */
  petalWidth: 1.25,
  petalWidthLoss: 0.5,
  /** Night only: radius of the quiet point of light at the eight tips of the heart star. */
  nodeRadius: 3.5,
} as const;

export const ROSETTE_MOTION = {
  /** How long a petal lives (`age = (t - t0) / 4.6`). */
  petalLife: 4.6,
  /** Where a petal starts, and how far it grows over its life: `1.04 + age * (0.95 + 0.35 * power)`. */
  petalStart: 1.04,
  petalGrowth: 0.95,
  petalGrowthByPower: 0.35,
  /** Its opacity: `(1 - age)^1.6 * 0.5 * (0.55 + 0.45 * power)`. */
  petalFadeExponent: 1.6,
  petalOpacity: 0.5,
  petalOpacityFloor: 0.55,
  /** A sharp star becomes a petal over the first 1 / 1.5 of its life (`min(1, age * 1.5)`). */
  petalRounding: 1.5,
  /** At most this many petals at once (`if (echoes.length > 6) echoes.shift()`). */
  maxPetals: 6,
  /** Two petals of the voice are at least this far apart (`now - last.t0 > 0.85`). */
  petalSpacing: 0.85,
  /** In silence a discreet petal leaves when the last one is this old (`> 2.3`)… */
  silentPetalInterval: 2.3,
  /** …with this strength (`power: 0.12`). */
  silentPetalPower: 0.12,
  /** The voice level falls back by this factor every 60th of a second (`target *= 0.945^(dt*60)`). */
  levelDecayPerFrame: 0.945,
  framesPerSecond: 60,
  /** The drawn level follows the voice at these rates, rising and falling (`24 : 6`). */
  levelRiseRate: 24,
  levelFallRate: 6,
  /** The longest step of time one frame may take (`Math.min(0.05, …)`): a pause is not a jump. */
  maxFrameStep: 0.05,
  /**
   * Night: the lines breathe with the voice, `0.84 + 0.16 * level + 0.04 * sin(t * 1.4)`, and
   * never dim below their silent light.
   */
  breatheBase: 0.84,
  breatheByLevel: 0.16,
  breatheWave: 0.04,
  breatheSpeed: 1.4,
  /**
   * A level sample is a new breath of the voice (a petal may leave) when it reaches this level and
   * rises this much above the level drawn. The prototype was told each syllable; a real engine
   * gives a stream of levels, so the syllables are found as rises in it (judgement, see the report).
   */
  syllableMinimum: 0.3,
  syllableRise: 0.15,
  /**
   * In silence the drawing breathes, very little (this share of its size, at `breatheSpeed`), so
   * it never looks frozen; the voice takes over from the breath as it rises (deviation 123).
   */
  idleBreath: 0.012,
  /**
   * Before the microphone is open (the model loading) the rosette is drawn at this opacity and
   * sends no petal; it lights up when the phone starts to listen (deviation 123).
   */
  notLiveOpacity: 0.35,
  /** That lighting up: a state change, a short ease-out (skill animate: 150–250 ms, strong ease-out). */
  liveFadeMs: 250,
  liveFadeCurve: [0.23, 1, 0.32, 1] as const,
} as const;

/**
 * Opacities of the lines: the prototype's own (`drawRosette`, `PALETTES`). Night values are
 * drawn with the night values of the app's colours, which are the prototype's night colours.
 *
 * Day values are the prototype's too, drawn with the app's colours: the gold lines in
 * `ornamentLine` (#CE9A3C, the prototype's gold), the outer star in water (#0E6B78, where the
 * prototype has #347A7A), the heart in `accentStrong` (#0A4F59, where it has #0C5056). The
 * water lines are therefore a little darker than the validated image; the report compares them.
 */
export const ROSETTE_OPACITY = {
  light: {
    /** `rgba(heart, 0.94)`. */
    heart: 0.94,
    /** `rgba(outer, 0.88)`. */
    outer: 0.88,
    /** `rgba(inside, 0.78 + 0.22 * level)`. */
    inside: 0.78,
    insideByLevel: 0.22,
    /** Petals are drawn at the opacity of their own life, with no further share. */
    goldPetal: 1,
    waterPetal: 1,
  },
  dark: {
    heart: 0.94,
    outer: 0.78,
    inside: 0.55,
    insideByLevel: 0,
    goldPetal: 1,
    waterPetal: 1,
    /** The light on the lines (`(0.30 + 0.45 * level) * breathe`, canvas at opacity 0.7). */
    glow: 0.3,
    glowByLevel: 0.45,
    glowLayer: 0.7,
    /** Blur of that light, in points (`filter: blur(13px)`). */
    glowBlur: 13,
    /** Width of the light on the heart and outer stars at mid voice (`2.2 + 4.5 * level`, `1.6 + 3.5 * level`). */
    heartGlowWidth: 4.45,
    outerGlowWidth: 3.35,
    /** The points of light at the tips (`0.40 * (0.25 + 0.75 * level)`). */
    node: 0.4,
    nodeFloor: 0.25,
  },
} as const;

export const LISTENING_LAYOUT = {
  /** The title's top, as a share of the screen height (`.title { top: 62.5% }`). */
  titleTop: 0.625,
  /**
   * Radius of the outer star of the small rosette above a result (found, several places):
   * 40 points, a star 80 points wide, the size of a large symbol rather than a picture
   * (judgement on the 8-point grid; the prototype has no result screen).
   */
  resultRosetteRadius: 40,
} as const;

/**
 * The rosette at rest, once the listening is over. It is a still frame of the silent rosette of
 * the prototype: the stars at their silent light, and the two silent petals that are alive at
 * any moment of silence (one leaves every `silentPetalInterval`, each lives `petalLife`, so two
 * overlap, half a life apart). Their shape, size and opacity come from `petalAppearance`.
 */
export const SETTLED_ROSETTE = {
  /** The ages of the two petals, as shares of a petal's life (the phase is a judgement). */
  petalAges: [0.25, 0.75],
  /**
   * The width of the screen the prototype's night light was drawn for (an iPhone of 393 points;
   * the validated images are of that size). A rosette smaller than the one on that screen gets a
   * proportionally smaller light, so a small rosette does not drown in its own glow.
   */
  lightReferenceScreenWidth: 393,
} as const;

/**
 * The voice meter of the following bar (voix.png draws it still; how it moves is a judgement).
 * At rest each bar has its share of the meter's height, the outline of a voice as the mockup
 * draws it; with the voice each bar reaches up to its full share, a little out of step with its
 * neighbours.
 */
export const METER_MOTION = {
  shape: [0.55, 0.9, 0.45, 0.7, 0.4, 0.6, 0.4, 0.7, 0.45, 0.85, 1],
  /** The smallest a bar becomes, as a share of its height at rest. */
  floor: 0.45,
  /** How strongly the level lifts the bars. */
  gain: 1.6,
  /** The share of a bar's reach that waves, and how fast, in radians per second and per bar. */
  waveShare: 0.4,
  waveSpeed: 9,
  waveStep: 1.7,
} as const;

/** What a result shows of the Quran text. */
export const RESULT_TEXT = {
  /**
   * At most this many verses of a passage found: enough to recognise it, short enough for the
   * button under them to stay in view at the default text size on an iPhone (judgement). The
   * reader shows the rest.
   */
  maxVerses: 3,
  /**
   * The opening words of the verse of each place, when several places are possible: enough to
   * tell the places apart, which differ by what surrounds the words heard (judgement).
   */
  openingWords: 6,
} as const;

/** Rhythm of a simulated recitation (`frame()` of the prototype, "the simulated voice"). */
export const SIMULATED_VOICE = {
  /** A syllable's strength: 0.5 plus up to 0.55, at most 1. */
  minStrength: 0.5,
  strengthSpread: 0.55,
  /** Gap after a syllable: 0.24 s plus up to 0.26 s… */
  minGapMs: 240,
  gapSpreadMs: 260,
  /** …and, one time in five, a breath: 0.75 s plus up to 0.5 s. */
  breathChance: 0.2,
  minBreathMs: 750,
  breathSpreadMs: 500,
  /** Syllables per word in the simulation. */
  syllablesPerWord: 2,
  /** After a syllable, the level falls in two samples, as a microphone's level would. */
  fallSteps: [
    { afterMs: 90, share: 0.45 },
    { afterMs: 180, share: 0.1 },
  ],
} as const;

/** The words heard, shown faintly under the title while the screen listens (deviation 123). */
export const HEARD_WORDS = {
  /** The latest words only: enough to see the voice arrive, never a transcript to read. */
  shown: 8,
  /** A new line fades in (skill animate: a state change, short). */
  fadeInMs: 200,
} as const;
