/**
 * Named settings of the listening screen.
 *
 * The look is that of the validated mockups (`docs/design/shazam.png`, `voix.png`; sizes and
 * colours are tokens of `src/ui/listening-tokens.ts`). The rhythm of the voice is that of the
 * validated rosette prototype (`gen/ecoute/styles/site/index.html`, outside the repository;
 * docs/DECISIONS.md D27, D29): each value says where it comes from in that file. Times are in seconds unless the name says
 * otherwise, sizes in points or as a share of the screen.
 */

export const ROSETTE_GEOMETRY = {
  /** How much the microphone grows at full voice (`1 + 0.02 * level`). */
  levelGrowth: 0.02,
  /** A ripple's line starts at this width and loses `petalWidthLoss` over its life. */
  petalWidth: 1.25,
  petalWidthLoss: 0.5,
} as const;

/**
 * The light of the voice on the rings around the microphone (shazam.png draws them still; how
 * they light with the voice is a judgement): at rest they keep this share of their opacity,
 * at full voice all of it.
 */
export const VOICE_LIGHT = {
  ringsBase: 0.7,
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
