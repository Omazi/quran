/**
 * Where the person probably is, from the phone's time zone alone: the app does not ask for the
 * location (owner's decision, D51). A zone of the IANA database is placed where the database names
 * it (America/Toronto: Toronto); without one, the UTC offset gives the longitude (15° an hour) and
 * the latitude is 30° N. Pure: the zone and the offset are parameters.
 */

import { SUN_CONFIG } from './config';
import type { GeoPosition } from './solar-day';
import { ZONE_COORDINATES } from './zone-coordinates';

/** A place and where it comes from: the time zone's table, or the UTC offset alone. */
export interface Place extends GeoPosition {
  readonly source: 'time-zone' | 'utc-offset';
}

const MINUTES_PER_DEGREE = 4;
const FULL_TURN = 360;
const HALF_TURN = 180;

/** A longitude brought into -180 to 180 (+210° is -150°); -180 stays -180. */
function wrapLongitude(degrees: number): number {
  return degrees > HALF_TURN ? degrees - FULL_TURN : degrees;
}

/**
 * The place of a time zone (`Europe/Paris`), or, when the zone is unknown or has no place
 * (`Etc/UTC`), the place estimated from the UTC offset in minutes (+60 for Paris in winter).
 */
export function placeOfTimeZone(zone: string | null | undefined, utcOffsetMinutes: number): Place {
  const { minimumUtcOffsetMinutes, maximumUtcOffsetMinutes, fallbackLatitude } = SUN_CONFIG;
  if (
    !Number.isFinite(utcOffsetMinutes) ||
    utcOffsetMinutes < minimumUtcOffsetMinutes ||
    utcOffsetMinutes > maximumUtcOffsetMinutes
  ) {
    throw new RangeError(`No clock is ${utcOffsetMinutes} minutes from UTC.`);
  }
  const known = zone ? ZONE_COORDINATES[zone] : undefined;
  if (known !== undefined) {
    return { latitude: known[0], longitude: known[1], source: 'time-zone' };
  }
  return {
    latitude: fallbackLatitude,
    longitude: wrapLongitude(utcOffsetMinutes / MINUTES_PER_DEGREE),
    source: 'utc-offset',
  };
}
