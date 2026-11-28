/**
 * Sunrise, sunset and civil twilight of a date at a place, with the equations of NOAA's Solar
 * Calculator (NOAA Global Monitoring Laboratory, after Meeus): the sun's declination and the
 * equation of time at the hour of the event, then the hour angle at which the sun's centre is at
 * the event's altitude. Every time is an instant (milliseconds since 1970 UTC): the place's clock
 * and its summer time play no part. Pure: the date and the place are parameters.
 */

import { isLocalDate, type LocalDate } from '../shared/local-date';
import { SUN_CONFIG } from './config';

/** A place on Earth, in degrees: north and east positive. */
export interface GeoPosition {
  readonly latitude: number;
  readonly longitude: number;
}

/**
 * Whether the sun crosses an altitude that day: it rises above it and sets under it, stays above
 * it all day (polar day, white night), or stays under it all day (polar night).
 */
export type SunPassage = 'rises-and-sets' | 'always-up' | 'always-down';

export interface SolarDay {
  /** The place's calendar date, by its own mean solar time. */
  readonly date: LocalDate;
  /** The mean solar midnights that open and close the date at this longitude (24 hours apart). */
  readonly startsAt: number;
  readonly endsAt: number;
  /** When the sun is highest. */
  readonly solarNoon: number;
  /** Whether the sun rises and sets; sunrise and sunset are null when it does not. */
  readonly sun: SunPassage;
  readonly sunrise: number | null;
  readonly sunset: number | null;
  /** Whether the sun crosses 6° under the horizon; civil dawn and dusk are null when it does not. */
  readonly civilTwilight: SunPassage;
  readonly civilDawn: number | null;
  readonly civilDusk: number | null;
}

const MINUTE_MS = 60_000;
const MINUTES_PER_DAY = 24 * 60;
const DAY_MS = MINUTES_PER_DAY * MINUTE_MS;
const NOON_MINUTES = 12 * 60;
/** The Earth turns one degree in four minutes. */
const MINUTES_PER_DEGREE = 4;
const RADIANS_PER_DEGREE = Math.PI / 180;
/** The Julian day of 1970-01-01 00:00 UTC, of J2000.0, and the days of a Julian century. */
const UNIX_EPOCH_JULIAN_DAY = 2440587.5;
const J2000_JULIAN_DAY = 2451545;
const DAYS_PER_JULIAN_CENTURY = 36525;
const MAX_LATITUDE = 90;
const MAX_LONGITUDE = 180;
const MORNING = -1;
const EVENING = 1;

export function assertPosition({ latitude, longitude }: GeoPosition): void {
  if (!Number.isFinite(latitude) || Math.abs(latitude) > MAX_LATITUDE) {
    throw new RangeError(`A latitude is a number from -90 to 90, not ${latitude}.`);
  }
  if (!Number.isFinite(longitude) || Math.abs(longitude) > MAX_LONGITUDE) {
    throw new RangeError(`A longitude is a number from -180 to 180, not ${longitude}.`);
  }
}

export function assertInstant(instant: number): void {
  if (!Number.isFinite(instant)) throw new RangeError(`A moment must be a number, not ${instant}.`);
}

/** UTC midnight that opens a calendar date. */
function utcMidnightOf(date: LocalDate): number {
  if (!isLocalDate(date)) throw new RangeError(`Invalid local date: "${date}"`);
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return Date.UTC(year, month - 1, day);
}

interface SunAt {
  /** The sun's declination, in radians. */
  readonly declination: number;
  /** How far the true sun runs ahead of the mean sun, in minutes. */
  readonly equationOfTimeMinutes: number;
}

function sinDegrees(degrees: number): number {
  return Math.sin(degrees * RADIANS_PER_DEGREE);
}

/**
 * The sun's declination and the equation of time at a moment, by the equations of NOAA's Solar
 * Calculator (after Meeus, "Astronomical Algorithms"): mean longitude and anomaly, equation of
 * centre, apparent longitude, obliquity. Declination within about 0.01°.
 */
function sunAt(instant: number): SunAt {
  const julianDay = instant / DAY_MS + UNIX_EPOCH_JULIAN_DAY;
  const t = (julianDay - J2000_JULIAN_DAY) / DAYS_PER_JULIAN_CENTURY;
  const meanLongitude = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const meanAnomaly = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const centre =
    sinDegrees(meanAnomaly) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    sinDegrees(2 * meanAnomaly) * (0.019993 - 0.000101 * t) +
    sinDegrees(3 * meanAnomaly) * 0.000289;
  const omega = 125.04 - 1934.136 * t;
  const apparentLongitude = meanLongitude + centre - 0.00569 - 0.00478 * sinDegrees(omega);
  const meanObliquity =
    23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const obliquity =
    (meanObliquity + 0.00256 * Math.cos(omega * RADIANS_PER_DEGREE)) * RADIANS_PER_DEGREE;
  const declination = Math.asin(Math.sin(obliquity) * sinDegrees(apparentLongitude));
  const y = Math.tan(obliquity / 2) ** 2;
  const l0 = meanLongitude * RADIANS_PER_DEGREE;
  const m = meanAnomaly * RADIANS_PER_DEGREE;
  const equationOfTime =
    y * Math.sin(2 * l0) -
    2 * eccentricity * Math.sin(m) +
    4 * eccentricity * y * Math.sin(m) * Math.cos(2 * l0) -
    0.5 * y * y * Math.sin(4 * l0) -
    1.25 * eccentricity * eccentricity * Math.sin(2 * m);
  return {
    declination,
    equationOfTimeMinutes: (MINUTES_PER_DEGREE * equationOfTime) / RADIANS_PER_DEGREE,
  };
}

/** The cosine of the hour angle at which the sun's centre is at `zenithDegrees` from the zenith. */
function cosHourAngle(zenithDegrees: number, latitude: number, sunDeclination: number): number {
  const phi = latitude * RADIANS_PER_DEGREE;
  return (
    (Math.cos(zenithDegrees * RADIANS_PER_DEGREE) - Math.sin(phi) * Math.sin(sunDeclination)) /
    (Math.cos(phi) * Math.cos(sunDeclination))
  );
}

/** The moment at a minute after a UTC midnight. */
function at(utcMidnight: number, minutes: number): number {
  return utcMidnight + minutes * MINUTE_MS;
}

/** When the sun is highest, near the mean noon of the date at this longitude. */
function solarNoonOf(utcMidnight: number, longitude: number): number {
  const meanNoon = NOON_MINUTES - MINUTES_PER_DEGREE * longitude;
  let noon = at(utcMidnight, meanNoon);
  for (let pass = 0; pass < SUN_CONFIG.refinementPasses; pass += 1) {
    noon = at(utcMidnight, meanNoon - sunAt(noon).equationOfTimeMinutes);
  }
  return noon;
}

interface Crossing {
  readonly passage: SunPassage;
  readonly morning: number | null;
  readonly evening: number | null;
}

/**
 * When the sun crosses an altitude. Whether it crosses at all is decided once, with the
 * declination of solar noon, so that a day has both crossings or neither; the times are then
 * refined with the sun of their own hour.
 */
function crossing(
  utcMidnight: number,
  { latitude, longitude }: GeoPosition,
  zenithDegrees: number,
  noon: number,
): Crossing {
  const atNoon = cosHourAngle(zenithDegrees, latitude, sunAt(noon).declination);
  if (atNoon > 1) return { passage: 'always-down', morning: null, evening: null };
  if (atNoon < -1) return { passage: 'always-up', morning: null, evening: null };
  const refine = (side: number): number => {
    let moment = noon;
    for (let pass = 0; pass < SUN_CONFIG.refinementPasses; pass += 1) {
      const sun = sunAt(moment);
      // A refined hour may step just past the limit the noon check allowed: hold it there.
      const cosine = Math.min(
        1,
        Math.max(-1, cosHourAngle(zenithDegrees, latitude, sun.declination)),
      );
      const hourAngleDegrees = Math.acos(cosine) / RADIANS_PER_DEGREE;
      moment = at(
        utcMidnight,
        NOON_MINUTES -
          MINUTES_PER_DEGREE * (longitude - side * hourAngleDegrees) -
          sun.equationOfTimeMinutes,
      );
    }
    return moment;
  };
  return { passage: 'rises-and-sets', morning: refine(MORNING), evening: refine(EVENING) };
}

/** The sun's day at a place on its calendar date (docs/specs/sun.md, rules 2 and 3). */
export function solarDayOn(date: LocalDate, position: GeoPosition): SolarDay {
  assertPosition(position);
  const utcMidnight = utcMidnightOf(date);
  const solarNoon = solarNoonOf(utcMidnight, position.longitude);
  const sun = crossing(utcMidnight, position, SUN_CONFIG.sunriseZenithDegrees, solarNoon);
  const civil = crossing(utcMidnight, position, SUN_CONFIG.civilZenithDegrees, solarNoon);
  const startsAt = at(utcMidnight, -MINUTES_PER_DEGREE * position.longitude);
  return {
    date,
    startsAt,
    endsAt: startsAt + DAY_MS,
    solarNoon,
    sun: sun.passage,
    sunrise: sun.morning,
    sunset: sun.evening,
    civilTwilight: civil.passage,
    civilDawn: civil.morning,
    civilDusk: civil.evening,
  };
}

/** The place's calendar date at a moment, by its mean solar time (rule 1). */
export function solarDateAt(instant: number, position: GeoPosition): LocalDate {
  assertInstant(instant);
  assertPosition(position);
  const meanSolarTime = instant + MINUTES_PER_DEGREE * position.longitude * MINUTE_MS;
  const epochDay = Math.floor(meanSolarTime / DAY_MS);
  // An ISO date cut to its first ten characters is a valid `YYYY-MM-DD`: the brand holds.
  return new Date(epochDay * DAY_MS).toISOString().slice(0, 10) as LocalDate;
}
