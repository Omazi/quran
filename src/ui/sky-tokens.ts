/**
 * The sky behind the home garden, hour by hour, as the validated mockup draws it
 * (docs/design/maquette-wow, `js/sky.js`, owner's validation of 27 November 2026). Each keyframe
 * gives the three colours of the sky's gradient, how many stars show, how much night it is, and
 * the light the garden receives from the sun or the moon. Between two keyframes everything is
 * interpolated (`skyStateAt` in src/features/garden/sky).
 *
 * The values are the mockup's own. At 12:30 the light is exactly the light the garden pictures
 * were rendered with (`GARDEN_3D.light`), so that the garden at noon is the picture.
 */

export interface SkyKeyframe {
  /** Hour of the day, 0 to 24. */
  readonly hour: number;
  /** The gradient: top of the screen, its middle (46 %), its lower part (82 %). */
  readonly top: string;
  readonly mid: string;
  readonly low: string;
  /** How visible the stars are, 0 to 1. */
  readonly stars: number;
  /** How much night it is, 0 (day) to 1 (night): fireflies, the moon, the water's glow. */
  readonly night: number;
  /** The directional light (the sun by day, the moon at night). */
  readonly sunColor: string;
  readonly sunIntensity: number;
  /** The sky light: its colour from above, from the ground, and its strength. */
  readonly hemiSky: string;
  readonly hemiGround: string;
  readonly hemiIntensity: number;
  /** How dark the shadows are, 0 to 1. */
  readonly shadow: number;
}

const NIGHT: Omit<SkyKeyframe, 'hour' | 'top' | 'mid' | 'low' | 'stars'> = {
  night: 1,
  sunColor: '#B4C6F4',
  sunIntensity: 0.75,
  hemiSky: '#7484B8',
  hemiGround: '#34344A',
  hemiIntensity: 1.25,
  shadow: 0.35,
};

/** The day, keyframe by keyframe; the last repeats the first at 24:00. */
export const skyKeyframes: readonly SkyKeyframe[] = [
  { hour: 0, top: '#0A0F24', mid: '#151B3B', low: '#2A2B4C', stars: 1, ...NIGHT },
  {
    hour: 4.8,
    top: '#0D1330',
    mid: '#1E2347',
    low: '#3A3457',
    stars: 0.9,
    ...NIGHT,
    sunIntensity: 0.7,
    hemiIntensity: 1.2,
    shadow: 0.3,
  },
  {
    hour: 5.7,
    top: '#1D2954',
    mid: '#5A4A73',
    low: '#D58E7C',
    stars: 0.45,
    night: 0.75,
    sunColor: '#FFB8A0',
    sunIntensity: 0.8,
    hemiSky: '#A898C0',
    hemiGround: '#4A3A40',
    hemiIntensity: 1.3,
    shadow: 0.35,
  },
  {
    hour: 6.5,
    top: '#8296C8',
    mid: '#E8C6CC',
    low: '#FFE0C4',
    stars: 0.02,
    night: 0.15,
    sunColor: '#FFD2B4',
    sunIntensity: 1.4,
    hemiSky: '#F4E4F0',
    hemiGround: '#A89080',
    hemiIntensity: 1.7,
    shadow: 0.45,
  },
  {
    hour: 8,
    top: '#7DB0D8',
    mid: '#CDE0EA',
    low: '#FBE6CF',
    stars: 0,
    night: 0,
    sunColor: '#FFF0DA',
    sunIntensity: 1.6,
    hemiSky: '#FFFFFF',
    hemiGround: '#CFC3B0',
    hemiIntensity: 1.85,
    shadow: 0.55,
  },
  {
    hour: 12.5,
    top: '#6CAADB',
    mid: '#B7D8EE',
    low: '#F3EEE4',
    stars: 0,
    night: 0,
    sunColor: '#FFF3DF',
    sunIntensity: 1.75,
    hemiSky: '#FFFFFF',
    hemiGround: '#CFC3B0',
    hemiIntensity: 1.9,
    shadow: 0.55,
  },
  {
    hour: 16,
    top: '#76ACD8',
    mid: '#C9DDEA',
    low: '#FBE3C6',
    stars: 0,
    night: 0,
    sunColor: '#FFEBD0',
    sunIntensity: 1.7,
    hemiSky: '#FFF8F0',
    hemiGround: '#CFC0A8',
    hemiIntensity: 1.85,
    shadow: 0.55,
  },
  {
    hour: 17.6,
    top: '#6B82B8',
    mid: '#E6B790',
    low: '#FFDAA2',
    stars: 0,
    night: 0.05,
    sunColor: '#FFD4A2',
    sunIntensity: 1.9,
    hemiSky: '#FFF4E8',
    hemiGround: '#B8A890',
    hemiIntensity: 1.75,
    shadow: 0.55,
  },
  {
    hour: 18.4,
    top: '#3C4782',
    mid: '#C7777B',
    low: '#F6A36D',
    stars: 0.1,
    night: 0.3,
    sunColor: '#FFC896',
    sunIntensity: 1.75,
    hemiSky: '#F4ECE8',
    hemiGround: '#909088',
    hemiIntensity: 1.65,
    shadow: 0.5,
  },
  {
    hour: 19.2,
    top: '#1C2350',
    mid: '#4F3B66',
    low: '#9A5A63',
    stars: 0.5,
    night: 0.7,
    sunColor: '#D8B0D0',
    sunIntensity: 1,
    hemiSky: '#B0A0C8',
    hemiGround: '#504050',
    hemiIntensity: 1.3,
    shadow: 0.35,
  },
  { hour: 20.2, top: '#0E1433', mid: '#211F42', low: '#3E2F4D', stars: 0.9, ...NIGHT },
  { hour: 24, top: '#0A0F24', mid: '#151B3B', low: '#2A2B4C', stars: 1, ...NIGHT },
];

/**
 * The fixed colours of the sky's lights (the mockup's `.sky-sun`, `.sky-moon`, stars, water):
 * the white core of the sun, the moon's face, the stars' warm white, the water's own blue before
 * the sky tints it, the fireflies' gold, the light of a growth's ripple.
 */
export const skyLights = {
  sunCore: '#FFFBF0',
  sunWarm: '#FFF6E0',
  moonFace: '#F4F0E4',
  moonHalo: '#BECDFF',
  star: '#FFF8E8',
  water: '#9FE3EE',
  waterNight: '#1A6B85',
  firefly: '#FFEB73',
  ripple: '#CCF5FF',
  growGlow: '#FFF2C4',
  /** The ring at the foot of the growing plant (`garden.js` buildGrowth): pale gold. */
  growRing: '#FFED9E',
  bird: '#2A3140',
  cloud: '#FFFFFF',
  /** The soft shadow under the island, and the wings of the butterflies. */
  islandShadow: '#000000',
  butterflies: ['#FFF1C9', '#FFC9D8', '#FFF9EF', '#F6D36B'],
  leaves: ['#8FB85A', '#B5C96A', '#D9B45A'],
} as const;

/**
 * Below this relative luminance of the sky's top, the sky counts as night for what floats on it:
 * the glass and its words take their night values (the mockup's `theme`).
 */
export const SKY_NIGHT_LUMINANCE = 0.16;
