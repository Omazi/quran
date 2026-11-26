/**
 * The choreography of the first launch, from the owner's chosen prototype
 * (docs/design/premier-lancement-voix/index.html, its `frame()` and `drawVoice()`). Every value
 * here is the prototype's; the comment names where it comes from. Sizes are in `voiceStoryLayout`
 * (src/ui), colours in the palette.
 *
 * Positions are in pages: 2.4 is 40 % of the way from the third page to the fourth. Times are in
 * milliseconds unless named in seconds.
 */
export const STORY_MOTION = {
  /**
   * The paging settle, after a swipe and after a step asked by VoiceOver: the motion spec's `pager`
   * spring (§1), critically damped with a response of 0.45 s, seeded with the finger's speed.
   */
  pagingSettle: { mass: 1, stiffness: 195, damping: 27.9 },
  /** A page's own visual leaves before the next one arrives (`presence`): 1 / 1.85 of a page. */
  presenceRate: 1.85,
  /** A page's words fade over 1 / 2.2 of a page either side (`pins`). */
  copyRate: 2.2,
  /** The garden picture of the next stage settles over the last 28 % of the way (`gardenShow`). */
  settleFrom: 0.72,
  /** What a new stage adds rises over the first 80 % of the way and is whole at 40 %. */
  riseSpan: 0.8,
  riseFade: 0.4,
  /** Its height starts at 90 % (`scaleY(.9 + .1 * …)`). */
  riseScaleFrom: 0.9,
  /** The arrival: the garden over 800 ms, the line 160 ms later, the words 320 ms, the hint 900 ms. */
  introMs: 800,
  introLineDelayMs: 160,
  introCopyDelayMs: 320,
  introTextDelayMs: 420,
  introDotsDelayMs: 600,
  introCopyRise: 16,
  introHintDelayMs: 900,
  introWaveDelayMs: 250,
  introWaveMs: 900,
  /** The hint to swipe fades out over the first third of a page. */
  hintRate: 3,
  hintLoopMs: 1800,
  /**
   * The voice. Its level comes from the finger's speed (the faster, the louder), from the
   * demonstrations' simulated reciter, and at rest it still breathes (`idle`).
   */
  speedSmoothing: 14,
  speedGain: 0.85,
  speedRise: 22,
  speedFall: 3.5,
  pulseDecayPerFrame: 0.945,
  levelRise: 24,
  /** A breath of voice at each word of the voice page (`pulse(.16 + rand × .08)`). */
  wordPulse: 0.16,
  wordPulseRange: 0.08,
  /** The reciter heard on the listening page: 3.6 bursts a second, each 50 % to 100 %. */
  listeningPulsesPerS: 3.6,
  listeningPulse: 0.5,
  listeningPulseRange: 0.5,
  levelFall: 6,
  idleLevel: 0.2,
  idleSwing: 0.07,
  idleRate: 1.3,
  /** After the revival the voice rests quieter (`pos < 10.5 ? 1 : .6`). */
  idleQuietFrom: 10.5,
  idleQuiet: 0.6,
  /** With "reduce motion" the voice is a still line at 35 % (`reduce ? .35 * voiceOn`). */
  reducedLevel: 0.35,
  /** The water flows with the voice: `clamp(.25 + level × 1.1)`. */
  flowBase: 0.25,
  flowGain: 1.1,
  /** The bars of the thread: their envelope and the swing of each one. */
  envelopeFloor: 0.28,
  envelopeWidth: 0.3,
  barRest: 0.55,
  barSwing: 0.45,
  barMin: 3,
  goldCurve: 1.4,
  barOpacity: 0.95,
  /**
   * The thread of the voice (motion spec §7): into the bar over `[0.08, 0.85]` of the way to the
   * voice page, then round the rosette over `[0.04, 0.72]` of the way to the listening page,
   * shrinking over `[0.55, 0.92]` (to 15 %) and fading over `[0.6, 0.92]` as the rosette lights.
   */
  threadIntoBar: [0.08, 0.85] as const,
  threadIntoRing: [0.04, 0.72] as const,
  threadShrink: [0.55, 0.92] as const,
  threadShrinkTo: 0.15,
  threadFade: [0.6, 0.92] as const,
  /** The ring round the rosette: 1.38 radii, from 86 % as the rosette arrives; 18 pt bars. */
  ringRadius: 1.38,
  ringReach: 18,
  ringRise: 50,
  /** The bar under the mushaf page trails the page in (110 pt a page) and leaves at 60 pt a page. */
  followArriveTravel: 110,
  /**
   * The recited line advances with the finger over the five growing pages, through these words
   * (of Al-Fatiha's 29) on pages 0 to 5: each page rests on a word in the middle of a line, never
   * on two lines crossfading (motion spec §6).
   */
  lineStops: [0, 5.8, 11.5, 15, 22.2, 29] as const,
  lineFadeIn: 0.7,
  lineDrift: 12,
  wordFloor: 0.26,
  /** The line leaves upwards after the revival, 40 points per page. */
  lineLeaveTravel: 40,
  /** The pill moves to the next word over the last 45 % of the current one. */
  pillMoveFrom: 0.55,
  /** The camera walks around the garden: degrees per page are in pages.ts (`turn`). */
  perspective: 1400,
  /** The garden over the settings (`GT`): it rises 26 points on the two voice pages. */
  featureLift: -26,
  featureScale: 0.94,
  friendsPreviewDrop: 30,
  friendsPreviewScale: 0.9,
  /** It shows again over the second half of the way to the goal (`f × 1.85 − .85`), at 60 %. */
  previewReturnShift: 0.85,
  /** Droplets rise from the thread into the garden while it grows (`growing`, up to 0.02 past). */
  growingEdge: 0.02,
  dropletCount: 20,
  dropletLifeS: 0.9,
  dropletLifeRangeS: 0.6,
  dropletArc: 30,
  dropletArcRange: 40,
  dropletSpread: 60,
  dropletGoldShare: 0.35,
  dropletOpacity: 0.85,
  /** Leaves fall while the garden dries (`dry`), more of them when the finger moves. */
  leafCount: 16,
  leafFrom: 5.45,
  leafTo: 8.9,
  leafSteadyFrom: 5.8,
  leafSteadyTo: 8.4,
  leafSteady: 0.18,
  leafLifeS: 1.8,
  leafLifeRangeS: 1.4,
  leafFall: 26,
  leafFallRange: 26,
  leafOpacity: 0.95,
  /** A leaf starts this far above the earth's top, in picture pixels, and up to 150 more. */
  leafStartAbove: 60,
  leafStartRange: 150,
  /**
   * The earth cracks from page 7.35 over 1.55 pages in eight layers (motion spec §5: layer b shows
   * over `[b·0.11875 − 0.02, b·0.11875 + 0.14]` of the cracking), and the cracks leave after the
   * dead page.
   */
  crackFrom: 7.35,
  crackSpan: 1.55,
  crackLeaveFrom: 9,
  crackLeaveRate: 1.7,
  crackLayers: 8,
  crackLayerStep: 0.11875,
  crackLayerLead: 0.02,
  crackLayerSpan: 0.16,
  /** The revival: two rings of water leave the fountain, the green follows (`ring1`, `ring2`). */
  ringSecondDelay: 0.12,
  ringStart: 0.04,
  ringGrowth: 1.3,
  ringSecondGrowth: 1.15,
  ringOpacity: 0.95,
  ringSecondOpacity: 0.8,
  revivalReach: 1.85,
  revivalOvershoot: 1.1,
  /** The mushaf page (page 11) comes from below and leaves upwards, smaller. */
  pageEnterTravel: 70,
  pageEnterScale: 0.04,
  pageLeaveTravel: 30,
  pageLeaveScale: 0.1,
  followLeaveTravel: 60,
  /** The demonstration of the voice page: a word every 300 ms plus 26 ms per letter pair. */
  recitationStartMs: 500,
  wordBaseMs: 300,
  wordPerPairMs: 26,
  rereadHoldMs: 1500,
  rereadFixMs: 520,
  verseBreathMs: 260,
  recitationRestMs: 1900,
  wordFadeMs: 280,
  pillSlideMs: 320,
  /**
   * The night of the two voice pages is a curtain 1.5 screens high (the dusk, then a 0.5 screen
   * tail) that comes down over `[10, 11]` and leaves upwards over `[12, 13]` (motion spec §4).
   */
  curtainHeight: 1.5,
  /** The name at the top is light from 10.1 to 12.75 (the night reaches it first, leaves it last). */
  nameNightFrom: 10.1,
  nameNightTo: 12.75,
  nameColorMs: 400,
  /** The red word shakes 0, −3, 3, −2, 1, 0 points over 360 ms (motion spec §8). */
  shakeMs: 360,
  shakeOffsets: [0, -3, 3, -2, 1, 0] as const,
  /** Springs of the listening page (motion spec §0): rosette 0.55 s, card 0.5 s 80 ms after it. */
  foundRosetteResponseS: 0.55,
  foundCardResponseS: 0.5,
  foundCardDelayMs: 80,
  /** The first page arrives on a 0.9 s spring (motion spec §2). */
  introResponseS: 0.9,
  /** The thirsty friend's words change in 250 ms once the heart has landed. */
  encouragedFadeMs: 250,
  /** The listening demonstration loops every 9 s: it listens 2.7 s, the card comes in 0.7 s. */
  recognitionLoopMs: 9000,
  recognitionListenMs: 2700,
  recognitionCardMs: 700,
  recognitionLeaveAtMs: 8300,
  /** It leaves faster than it came (motion spec §9: 0.45 s). */
  recognitionLeaveMs: 450,
  rosetteTravel: 50,
  labelTravel: 40,
  labelLift: 14,
  /** The words « À l’écoute… » are gone before the card covers them (`1 − 2.5·r`). */
  labelFadeRate: 2.5,
  /** The card: opacity `1.4·c`. */
  cardFadeRate: 1.4,
  cardScaleFrom: 0.96,
  /** Friends: each card arrives at its own speed, the heart flies over the second half of 12–13. */
  cardTravel: 60,
  cardTravelStep: 34,
  cardTilt: 3,
  /**
   * The heart flies over `[12.4, 12.88]` (motion spec §10): it lands at 88 % of the way, before the
   * settle's slow tail.
   */
  heartLead: 0.6,
  heartSpan: 0.48,
  heartPop: 0.35,
  heartTilt: 18,
  heartRest: 0.8,
  encouragedAt: 0.97,
  khatmaShare: 0.6,
  khatmaFloor: 0.55,
  khatmaRate: 1.4,
  /** The strong ease-out of the prototype (`--ease-out`), for the motions that run on a clock. */
  easeOutCurve: [0.23, 1, 0.32, 1] as const,
  /** A choice under the finger: 97 % in 140 ms (`.opt:active`, skill `animate` › press feedback). */
  pressScale: 0.97,
  pressMs: 140,
  /** The hint's chevron: visible after 35 % of its loop, then fading as it rises. */
  hintPeak: 0.35,
  /** The settings: the rolling figures, the garden preview's crossfade. */
  rollMs: 260,
  /** The four bars beside "Récite" sway over 0.9 s (`.mini`). */
  equalizerMs: 900,
  /** Their phases (the CSS delays −.3, −.6, −.15 s of 0.9 s) and their reach (30 % to 100 %). */
  equalizerPhases: [0, 0.33, 0.66, 0.16] as const,
  equalizerFloor: 0.3,
  previewFadeMs: 450,
  /** The settings take touches once they are nearly in place (`.panel.on`, |d| < 0.3). */
  touchableWithin: 0.3,
  /** The last button is touchable when it is nearly opaque (`ctaO > .9`). */
  finishTouchableFrom: 0.9,
  /** The dots: the current one, its neighbours, then smaller, then gone. */
  dotsNear: 2,
} as const;

/** The strong ease-out of the prototype (`--ease-out`), as the cubic it is: `1 − (1 − t)³`. */
export const EASE_OUT_POWER = 3;

/**
 * The drought's cracks are drawn on the picture with the prototype's seeded generator (`rnd`, a
 * Park–Miller sequence from 7), so that every launch cracks the same way.
 */
export const CRACK_SEED = 7;

/** The top of the earth block in picture pixels (`ISO`): its top, right and left corners. */
export const EARTH_TOP = {
  top: [584, 85],
  right: [1119, 415],
  left: [50, 415],
} as const;

/** The fountain, where the water comes back from, and the rings' ellipse, in picture pixels. */
export const FOUNTAIN = { cx: 584, cy: 415, rx: 534, ry: 333 } as const;

/** The revival's green spreads as an ellipse centred on the fountain (`ellipse(45.6% 40.8% …)`). */
export const REVIVAL_ELLIPSE = {
  rxShare: 0.456,
  ryShare: 0.408,
  cxShare: 0.499,
  cyShare: 0.509,
} as const;
