/**
 * Named settings of the listening screen.
 *
 * The geometry and the motion are those of the validated prototype
 * (`gen/ecoute/styles/site/index.html`, outside the repository; docs/DECISIONS.md D27, D29):
 * each value says where it comes from in that file. Times are in seconds unless the name says
 * otherwise, sizes in points or as a share of the screen.
 */

export const ROSETTE_GEOMETRY = {
  /** The centre of the rosette, as a share of the screen width and height (`W * 0.5, H * 0.38`). */
  centreX: 0.5,
  centreY: 0.38,
  /** Radius of the outer star: the smaller of these shares of the width and height (`drawRosette`). */
  radiusOfWidth: 0.262,
  radiusOfHeight: 0.168,
  /** How much the whole drawing grows at full voice (`1 + 0.02 * level`). */
  levelGrowth: 0.02,
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
} as const;

/**
 * Opacities of the lines. Night values are the prototype's (`PALETTES.night`); its colours are
 * the night values of the app's colours, so they are kept as they are.
 *
 * Day values: the prototype's day colours are not the app's colours (gold #CE9A3C and water
 * #347A7A, where the charter has #8F611A and #0E6B78). Drawn with the charter's colours at the
 * prototype's opacities, every line would be darker than the validated image (the gold lines
 * 3.31:1 instead of 1.93:1 on paper). So each day opacity below is the one that gives the
 * charter's colour, on paper, the contrast the validated line had: same light, token colour.
 */
export const ROSETTE_OPACITY = {
  light: {
    /** Prototype rgba(12,80,86,0.94) = 7.34:1; the high-contrast water #0A4F59 at 0.94. */
    heart: 0.94,
    /** Prototype rgba(52,122,122,0.88) = 3.75:1; water #0E6B78 at 0.78. */
    outer: 0.78,
    /** Prototype rgba(206,154,60,0.78 + 0.22 * level) = 1.93 to 2.36:1; gold #8F611A at 0.46 to 0.59. */
    inside: 0.46,
    insideByLevel: 0.13,
    /** Petals: prototype gold #D6AA5C and water #5CA09E; the same contrast takes these shares. */
    goldPetal: 0.5,
    waterPetal: 0.64,
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
