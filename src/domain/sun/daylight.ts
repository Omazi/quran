/**
 * Day and night at a moment, by the real sun: whether the sun is up (night runs from sunset to
 * sunrise), and where a moment falls in a drawn day (a reference day whose sun rises and sets at
 * fixed hours, such as the validated mockup's sky) once that day is re-timed on the real sun.
 * Pure: the moment and the place are parameters.
 */

import {
  assertInstant,
  solarDateAt,
  solarDayOn,
  type GeoPosition,
  type SolarDay,
  type SunPassage,
} from './solar-day';

/** A drawn day: the hours, from 0 to 24, of its civil dawn, sunrise, sunset and civil dusk. */
export interface ReferenceDay {
  readonly civilDawn: number;
  readonly sunrise: number;
  readonly sunset: number;
  readonly civilDusk: number;
}

const HOURS_PER_DAY = 24;

function solarDayAt(instant: number, position: GeoPosition): SolarDay {
  return solarDayOn(solarDateAt(instant, position), position);
}

/** Whether the sun is up at a moment: from sunrise (included) to sunset (excluded) (rule 5). */
export function isSunUpAt(instant: number, position: GeoPosition): boolean {
  assertInstant(instant);
  const day = solarDayAt(instant, position);
  if (day.sun !== 'rises-and-sets') return day.sun === 'always-up';
  return instant >= (day.sunrise as number) && instant < (day.sunset as number);
}

function assertReferenceDay({ civilDawn, sunrise, sunset, civilDusk }: ReferenceDay): void {
  const hours = [civilDawn, sunrise, sunset, civilDusk];
  const inDay = hours.every((hour) => Number.isFinite(hour) && hour >= 0 && hour <= HOURS_PER_DAY);
  if (!inDay || civilDawn > sunrise || sunrise >= sunset || sunset > civilDusk) {
    throw new RangeError(
      `A reference day runs civil dawn ≤ sunrise < sunset ≤ civil dusk, within 0 to 24 h: ${hours.join(', ')}.`,
    );
  }
}

/**
 * The moment of a crossing that may not happen that day: the real one when the sun crosses; else
 * the limit of a crossing that nearly happens. A sun that never goes down to the altitude crosses
 * it at the solar midnights (the day's edges); one that never comes up to it, at solar noon.
 */
function crossingOr(passage: SunPassage, real: number | null, edge: number, noon: number): number {
  if (passage === 'rises-and-sets') return real as number;
  return passage === 'always-up' ? edge : noon;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

interface Segment {
  readonly from: number;
  readonly to: number;
  readonly fromHour: number;
  readonly toHour: number;
}

/**
 * The hour of the drawn day at a moment (rule 7): the drawn civil dawn falls on the real civil
 * dawn, the drawn sunrise on the real sunrise, and so on; between two of them the drawn hours run
 * evenly. The night runs from civil dusk to the next civil dawn. When the sun skips a crossing
 * (polar day, white night, polar night), the stretch it would open is skipped: the drawn day never
 * shows more light, nor more night, than the real sun gives. Result from 0 (included) to 24.
 */
export function referenceHourAt(
  instant: number,
  position: GeoPosition,
  reference: ReferenceDay,
): number {
  assertInstant(instant);
  assertReferenceDay(reference);
  const day = solarDayAt(instant, position);
  const { startsAt, endsAt, solarNoon } = day;
  const dawn = clamp(
    crossingOr(day.civilTwilight, day.civilDawn, startsAt, solarNoon),
    startsAt,
    solarNoon,
  );
  const sunrise = clamp(crossingOr(day.sun, day.sunrise, startsAt, solarNoon), dawn, solarNoon);
  const dusk = clamp(
    crossingOr(day.civilTwilight, day.civilDusk, endsAt, solarNoon),
    solarNoon,
    endsAt,
  );
  const sunset = clamp(crossingOr(day.sun, day.sunset, endsAt, solarNoon), solarNoon, dusk);
  const dayMs = endsAt - startsAt;

  const segments: readonly Segment[] = [
    {
      from: dusk - dayMs,
      to: dawn,
      fromHour: reference.civilDusk - HOURS_PER_DAY,
      toHour: reference.civilDawn,
    },
    { from: dawn, to: sunrise, fromHour: reference.civilDawn, toHour: reference.sunrise },
    { from: sunrise, to: sunset, fromHour: reference.sunrise, toHour: reference.sunset },
    { from: sunset, to: dusk, fromHour: reference.sunset, toHour: reference.civilDusk },
    {
      from: dusk,
      to: dawn + dayMs,
      fromHour: reference.civilDusk,
      toHour: reference.civilDawn + HOURS_PER_DAY,
    },
  ];
  // The stretches follow one another and cover the solar day, which holds the moment (held there
  // against a rounding of a millisecond's fraction at its edges).
  const at = clamp(instant, startsAt, endsAt);
  const nonEmpty = segments.filter(({ from, to }) => to > from);
  const segment = nonEmpty.find(({ to }) => at < to) ?? (nonEmpty[nonEmpty.length - 1] as Segment);
  const share = (at - segment.from) / (segment.to - segment.from);
  const hour = segment.fromHour + (segment.toHour - segment.fromHour) * share;
  return ((hour % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY;
}
