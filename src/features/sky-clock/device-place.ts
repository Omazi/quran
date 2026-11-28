/**
 * Where the sun is read from on this phone, and the moment it is read at (D51). The place is the
 * phone's time zone's (`placeOfTimeZone`): the app never asks for the location. The zone is read
 * from `Intl` (Hermes gives the system's zone); without it, the clock's UTC offset places the sun.
 */

import { placeOfTimeZone, type Place } from '@/domain/sun';

const MINUTE_MS = 60_000;

/** The phone's IANA time zone (`Europe/Paris`), or null when the system does not say. */
export function deviceTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    // An engine without `Intl` time zones: the UTC offset will place the sun.
    return null;
  }
}

/** The place of the phone's time zone at a moment (the offset is the clock's at that moment). */
export function devicePlace(moment: Date, zone: string | null = deviceTimeZone()): Place {
  return placeOfTimeZone(zone, -moment.getTimezoneOffset());
}

/** A moment to the minute, with the place its sun is read at. */
export interface SunMoment {
  /** Milliseconds since 1970 UTC, the seconds dropped. */
  readonly instant: number;
  readonly place: Place;
}

export function sunMomentOf(moment: Date, zone: string | null = deviceTimeZone()): SunMoment {
  return {
    instant: Math.floor(moment.getTime() / MINUTE_MS) * MINUTE_MS,
    place: devicePlace(moment, zone),
  };
}

/** Same minute, same place: nothing for the sky or the page to redraw. */
export function isSameSunMoment(a: SunMoment, b: SunMoment): boolean {
  return (
    a.instant === b.instant &&
    a.place.latitude === b.place.latitude &&
    a.place.longitude === b.place.longitude &&
    a.place.source === b.place.source
  );
}
