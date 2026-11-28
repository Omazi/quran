/**
 * The real sun without the location: the place from the phone's time zone, sunrise, sunset and
 * civil twilight of a date (NOAA's equations), whether the sun is up, and a drawn day re-timed on
 * the real sun. See docs/specs/sun.md.
 */
export { SUN_CONFIG } from './config';
export { isSunUpAt, referenceHourAt, type ReferenceDay } from './daylight';
export { placeOfTimeZone, type Place } from './place';
export {
  solarDateAt,
  solarDayOn,
  type GeoPosition,
  type SolarDay,
  type SunPassage,
} from './solar-day';
