/**
 * The sky that follows the real local hour, as the validated mockup computes it
 * (docs/design/maquette-wow, `js/sky.js`): the colours of the gradient, the stars, how much night
 * it is, where the sun and the moon are, and the light the garden receives. Pure: an hour in, a
 * state out. The values live in `src/ui/sky-tokens.ts`.
 */

import { SKY_NIGHT_LUMINANCE, skyKeyframes, skyLights, type SkyKeyframe } from '@/ui/sky-tokens';

export type SkyPhase = 'dawn' | 'day' | 'sunset' | 'night';
export type SkyTheme = 'day' | 'night';
export type Appearance = 'light' | 'dark';

/** A light in the sky: where it is, as shares of the screen's width and height, and how visible. */
export interface SkyBody {
  readonly x: number;
  readonly y: number;
  /** 0 (gone) to 1. */
  readonly on: number;
}

export interface SkyState {
  readonly hour: number;
  readonly phase: SkyPhase;
  /** The gradient behind the garden, top to bottom (`#rrggbb`). */
  readonly top: string;
  readonly mid: string;
  readonly low: string;
  readonly stars: number;
  readonly night: number;
  readonly sunColor: string;
  readonly sunIntensity: number;
  readonly hemiSky: string;
  readonly hemiGround: string;
  readonly hemiIntensity: number;
  readonly shadow: number;
  readonly sun: SkyBody;
  readonly moon: SkyBody;
  /** Where the garden's directional light comes from, in metres from the garden's centre. */
  readonly sunDirection: readonly [number, number, number];
  /** Whether the sky counts as night for what floats on it. */
  readonly theme: SkyTheme;
  /** The water's colour under this sky. */
  readonly water: string;
  /** The sun's warm halo: white high in the sky, the colour of the horizon when low. */
  readonly sunTint: string;
  /** How visible the clouds are, 0 to 1. */
  readonly cloud: number;
}

/** Phase boundaries, in hours: dawn from the first light, sunset from the golden hour. */
const PHASES = { dawnFrom: 4.8, dayFrom: 7, sunsetFrom: 17.3, nightFrom: 19.8 } as const;

/** The sun crosses the sky from 6:00 to 19:00; the moon from 19:30 to 6:00. */
const SUN = { rise: 6, span: 13, left: 0.08, width: 0.84, low: 0.8, arc: 0.72 } as const;
const MOON = { rise: 19.5, span: 10.5, right: 0.92, drift: 0.3, high: 0.36, arc: 0.12 } as const;
/**
 * The light on the garden: turned around the garden by the light's place in the sky, raised by its
 * height, from the side the pictures' sun comes from (`GARDEN_3D.light.sun.position`).
 */
const LIGHT = {
  turn: 1.6,
  minElevation: 0.28,
  elevationTop: 1.05,
  elevationPerHeight: 1.1,
  distance: 38,
  pictureSun: { x: -14, z: 22 },
  /** Above this night, the moon lights the garden. */
  moonFromNight: 0.6,
} as const;

const HOURS_PER_DAY = 24;
const HEX = /^#[0-9a-f]{6}$/i;

function assertHour(hour: number): void {
  if (!Number.isFinite(hour)) throw new RangeError(`An hour must be a number, not ${hour}.`);
}

function wrapHour(hour: number): number {
  return ((hour % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY;
}

function channels(hex: string): [number, number, number] {
  if (!HEX.test(hex)) throw new TypeError(`A colour must be written #rrggbb, not ${hex}.`);
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function toHex(values: readonly number[]): string {
  return `#${values.map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`;
}

/** The colour `t` of the way from `a` to `b`, channel by channel. */
export function mixHex(a: string, b: string, t: number): string {
  const from = channels(a);
  const to = channels(b);
  return toHex(from.map((value, k) => value + ((to[k] ?? value) - value) * t));
}

/** WCAG's relative luminance of a colour. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map((value) => {
    const unit = value / 255;
    return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothStep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** The two keyframes around `hour` and how far between them (smoothed). */
function bracket(hour: number): { a: SkyKeyframe; b: SkyKeyframe; t: number } {
  let index = 0;
  while (index < skyKeyframes.length - 2 && (skyKeyframes[index + 1] as SkyKeyframe).hour <= hour)
    index += 1;
  const a = skyKeyframes[index] as SkyKeyframe;
  const b = skyKeyframes[index + 1] as SkyKeyframe;
  return { a, b, t: smoothStep((hour - a.hour) / (b.hour - a.hour)) };
}

export function skyPhaseAt(hour: number): SkyPhase {
  assertHour(hour);
  const h = wrapHour(hour);
  if (h >= PHASES.dawnFrom && h < PHASES.dayFrom) return 'dawn';
  if (h >= PHASES.dayFrom && h < PHASES.sunsetFrom) return 'day';
  if (h >= PHASES.sunsetFrom && h < PHASES.nightFrom) return 'sunset';
  return 'night';
}

export function skyStateAt(hour: number): SkyState {
  assertHour(hour);
  const h = wrapHour(hour);
  const { a, b, t } = bracket(h);
  const colour = (key: 'top' | 'mid' | 'low' | 'sunColor' | 'hemiSky' | 'hemiGround') =>
    mixHex(a[key], b[key], t);
  const value = (key: 'stars' | 'night' | 'sunIntensity' | 'hemiIntensity' | 'shadow'): number =>
    a[key] + (b[key] - a[key]) * t;

  const day = (h - SUN.rise) / SUN.span;
  const isSunUp = day > -0.05 && day < 1.05;
  const sunArc = Math.PI * clamp01(day);
  const sun: SkyBody = {
    x: SUN.left + SUN.width * day,
    y: SUN.low - Math.sin(sunArc) * SUN.arc,
    on: isSunUp ? Math.min(1, Math.sin(sunArc) * 3 + 0.15) : 0,
  };
  const nightPhase = (((h - MOON.rise) % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY;
  const moonShare = nightPhase / MOON.span;
  const moon: SkyBody = {
    x: MOON.right - MOON.drift * moonShare,
    y: MOON.high - Math.sin(Math.PI * clamp01(moonShare)) * MOON.arc,
    on: moonShare <= 1 ? Math.min(1, Math.sin(Math.PI * moonShare) * 3) : 0,
  };
  const night = value('night');
  const source = isSunUp && night < LIGHT.moonFromNight ? sun : moon;
  const turn = (source.x - 0.5) * LIGHT.turn;
  const elevation = Math.max(
    LIGHT.minElevation,
    LIGHT.elevationTop - source.y * LIGHT.elevationPerHeight,
  );
  const base = Math.atan2(LIGHT.pictureSun.x, LIGHT.pictureSun.z);
  const flat = Math.cos(elevation) * LIGHT.distance;
  const top = colour('top');
  const low = colour('low');
  return {
    hour: h,
    phase: skyPhaseAt(h),
    top,
    mid: colour('mid'),
    low,
    stars: value('stars'),
    night,
    sunColor: colour('sunColor'),
    sunIntensity: value('sunIntensity'),
    hemiSky: colour('hemiSky'),
    hemiGround: colour('hemiGround'),
    hemiIntensity: value('hemiIntensity'),
    shadow: value('shadow'),
    sun,
    moon,
    sunDirection: [
      Math.sin(base + turn) * flat,
      Math.sin(elevation) * LIGHT.distance,
      Math.cos(base + turn) * flat,
    ],
    theme: relativeLuminance(top) < SKY_NIGHT_LUMINANCE ? 'night' : 'day',
    water: mixHex(skyLights.water, low, 0.45),
    sunTint: mixHex(skyLights.sunWarm, low, clamp01((sun.y - 0.3) * 2)),
    cloud: Math.max(0, 0.75 - night * 0.95),
  };
}

/**
 * The appearance of the glass and its words over the sky: the night values over a night sky (the
 * mockup's `theme`), and always in Dark Mode, whose palette is the owner's "dusk"
 * (brand-spec.md › Nuit; dark-mode.md › Best practices: respect the person's choice).
 */
export function chromeAppearanceOf(theme: SkyTheme, device: Appearance): Appearance {
  return theme === 'night' || device === 'dark' ? 'dark' : 'light';
}

/** How far a day sky moves towards the evening sky in Dark Mode. */
const DARK_MODE_DIM = 0.6;
/** The evening sky it moves towards: the keyframe of 20:12. */
const EVENING = skyKeyframes.find((keyframe) => keyframe.hour === 20.2) ?? skyKeyframes[0];

/**
 * The sky in Dark Mode (dark-mode.md › Best practices: dimmer backgrounds; the owner's "dusk" at
 * night, brand-spec.md › Nuit): a day sky is dimmed towards the evening, so that the dusk palette
 * of the words floats on a dark enough sky. The garden keeps the light of its hour. A sky that is
 * already night is unchanged.
 */
export function skyForAppearance(sky: SkyState, device: Appearance): SkyState {
  if (device !== 'dark' || sky.theme === 'night' || EVENING === undefined) return sky;
  const top = mixHex(sky.top, EVENING.top, DARK_MODE_DIM);
  const low = mixHex(sky.low, EVENING.low, DARK_MODE_DIM);
  return {
    ...sky,
    top,
    mid: mixHex(sky.mid, EVENING.mid, DARK_MODE_DIM),
    low,
    theme: relativeLuminance(top) < SKY_NIGHT_LUMINANCE ? 'night' : 'day',
    water: mixHex(skyLights.water, low, 0.45),
    cloud: sky.cloud * (1 - DARK_MODE_DIM),
  };
}

/** The local hour of a date, with its minutes as a fraction (18:24 is 18.4). */
export function hourOfDay(date: Date): number {
  return date.getHours() + date.getMinutes() / 60;
}
