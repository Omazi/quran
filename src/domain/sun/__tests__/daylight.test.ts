import { parseLocalDate } from '../../shared/local-date';
import {
  isSunUpAt,
  referenceHourAt,
  solarDayOn,
  type GeoPosition,
  type ReferenceDay,
} from '../index';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** A drawn day whose sun rises at 6:00 and sets at 19:00, civil twilight half an hour each side. */
const DRAWN: ReferenceDay = { civilDawn: 5.5, sunrise: 6, sunset: 19, civilDusk: 19.5 };

const TORONTO: GeoPosition = { latitude: 43.65, longitude: -79.38 };
const PARIS: GeoPosition = { latitude: 48.87, longitude: 2.33 };
const JAKARTA: GeoPosition = { latitude: -6.17, longitude: 106.8 };
const REYKJAVIK: GeoPosition = { latitude: 64.15, longitude: -21.85 };
const LONGYEARBYEN: GeoPosition = { latitude: 78, longitude: 16 };

/** Toronto's clock in November (EST, UTC−5). */
function toronto(day: number, hours: number, minutes: number): number {
  return Date.UTC(2026, 10, day, hours + 5, minutes);
}

/** Whether a drawn hour falls in the drawn night, civil dusk to civil dawn. */
function isDrawnNight(hour: number): boolean {
  return hour > DRAWN.civilDusk || hour < DRAWN.civilDawn;
}

/** Whether a drawn hour falls in the drawn day, sunrise to sunset. */
function isDrawnDay(hour: number): boolean {
  return hour > DRAWN.sunrise && hour < DRAWN.sunset;
}

function hoursOver(start: number, days: number, place: GeoPosition): number[] {
  const hours: number[] = [];
  for (let moment = start; moment < start + days * DAY_MS; moment += MINUTE_MS) {
    hours.push(referenceHourAt(moment, place, DRAWN));
  }
  return hours;
}

/** The step from one drawn hour to the next, across midnight of the drawn day. */
function step(from: number, to: number): number {
  const raw = to - from;
  return raw < -12 ? raw + 24 : raw;
}

describe('isSunUpAt: night is from sunset until sunrise (rule 5)', () => {
  it('in Toronto on 27 November, the sun is up from 7:27 to 16:43', () => {
    expect(isSunUpAt(toronto(27, 7, 20), TORONTO)).toBe(false);
    expect(isSunUpAt(toronto(27, 7, 32), TORONTO)).toBe(true);
    expect(isSunUpAt(toronto(27, 12, 0), TORONTO)).toBe(true);
    expect(isSunUpAt(toronto(27, 16, 40), TORONTO)).toBe(true);
    expect(isSunUpAt(toronto(27, 16, 48), TORONTO)).toBe(false);
  });

  it('the night runs across midnight', () => {
    expect(isSunUpAt(toronto(27, 23, 0), TORONTO)).toBe(false);
    expect(isSunUpAt(toronto(28, 0, 0), TORONTO)).toBe(false);
    expect(isSunUpAt(toronto(28, 3, 0), TORONTO)).toBe(false);
  });

  it('switches exactly at the computed sunrise and sunset', () => {
    const day = solarDayOn(parseLocalDate('2026-11-27'), TORONTO);
    const sunrise = day.sunrise as number;
    const sunset = day.sunset as number;
    expect(isSunUpAt(sunrise - 1, TORONTO)).toBe(false);
    expect(isSunUpAt(sunrise, TORONTO)).toBe(true);
    expect(isSunUpAt(sunset - 1, TORONTO)).toBe(true);
    expect(isSunUpAt(sunset, TORONTO)).toBe(false);
  });

  it('Reykjavik in June: still day at 23:50, night after the sunset of 00:04, day again at 3:00', () => {
    expect(isSunUpAt(Date.UTC(2026, 5, 21, 23, 50), REYKJAVIK)).toBe(true);
    expect(isSunUpAt(Date.UTC(2026, 5, 22, 0, 15), REYKJAVIK)).toBe(false);
    expect(isSunUpAt(Date.UTC(2026, 5, 22, 2, 45), REYKJAVIK)).toBe(false);
    expect(isSunUpAt(Date.UTC(2026, 5, 22, 3, 5), REYKJAVIK)).toBe(true);
  });

  it('polar day is day at every hour, polar night is night at every hour', () => {
    for (let hour = 0; hour < 24; hour += 1) {
      expect(isSunUpAt(Date.UTC(2026, 5, 21, hour), LONGYEARBYEN)).toBe(true);
      expect(isSunUpAt(Date.UTC(2026, 11, 21, hour), LONGYEARBYEN)).toBe(false);
      expect(isSunUpAt(Date.UTC(2026, 10, 10, hour), LONGYEARBYEN)).toBe(false);
    }
  });
});

describe('referenceHourAt: the drawn day re-timed on the real sun (rule 7)', () => {
  it('puts the drawn civil dawn, sunrise, sunset and civil dusk on the real ones', () => {
    const day = solarDayOn(parseLocalDate('2026-11-27'), TORONTO);
    expect(referenceHourAt(day.civilDawn as number, TORONTO, DRAWN)).toBeCloseTo(5.5, 6);
    expect(referenceHourAt(day.sunrise as number, TORONTO, DRAWN)).toBeCloseTo(6, 6);
    expect(referenceHourAt(day.sunset as number, TORONTO, DRAWN)).toBeCloseTo(19, 6);
    expect(referenceHourAt(day.civilDusk as number, TORONTO, DRAWN)).toBeCloseTo(19.5, 6);
  });

  it('puts the real solar noon near the middle of the drawn day', () => {
    const day = solarDayOn(parseLocalDate('2026-06-21'), PARIS);
    expect(referenceHourAt(day.solarNoon, PARIS, DRAWN)).toBeCloseTo(12.5, 1);
  });

  it('in Toronto at 17:30 in November it is already the drawn night, at 6:00 still', () => {
    expect(isDrawnNight(referenceHourAt(toronto(27, 17, 30), TORONTO, DRAWN))).toBe(true);
    expect(isDrawnNight(referenceHourAt(toronto(27, 6, 0), TORONTO, DRAWN))).toBe(true);
    expect(isDrawnDay(referenceHourAt(toronto(27, 12, 0), TORONTO, DRAWN))).toBe(true);
  });

  it.each([
    ['Toronto in November', TORONTO, Date.UTC(2026, 10, 26)],
    ['Paris in June', PARIS, Date.UTC(2026, 5, 20)],
    ['Jakarta in December', JAKARTA, Date.UTC(2026, 11, 20)],
  ] as const)(
    '%s: moves forward minute by minute, without a jump, across midnight and the days',
    (_name, place, start) => {
      const hours = hoursOver(start, 3, place);
      // The steepest stretch is a short twilight: half a drawn hour in about 22 minutes.
      const largestStep = 0.05;
      for (let index = 1; index < hours.length; index += 1) {
        const change = step(hours[index - 1] as number, hours[index] as number);
        expect(change).toBeGreaterThanOrEqual(0);
        expect(change).toBeLessThan(largestStep);
      }
    },
  );

  it('always gives an hour from 0 to 24', () => {
    for (const hour of hoursOver(Date.UTC(2026, 5, 20), 2, REYKJAVIK)) {
      expect(hour).toBeGreaterThanOrEqual(0);
      expect(hour).toBeLessThan(24);
    }
  });
});

describe('referenceHourAt: polar days and nights stay within the light the sun gives (rule 3)', () => {
  it('white night in Reykjavik: the drawn night never comes, only its twilight', () => {
    const hours = hoursOver(Date.UTC(2026, 5, 21, 1, 30), 1, REYKJAVIK);
    expect(hours.some(isDrawnNight)).toBe(false);
    expect(hours.some(isDrawnDay)).toBe(true);
  });

  it('polar day: always the drawn day, its noon at the real solar noon', () => {
    const hours = hoursOver(Date.UTC(2026, 5, 21), 1, LONGYEARBYEN);
    expect(hours.every((hour) => hour >= DRAWN.sunrise && hour <= DRAWN.sunset)).toBe(true);
    const noon = solarDayOn(parseLocalDate('2026-06-21'), LONGYEARBYEN).solarNoon;
    expect(referenceHourAt(noon, LONGYEARBYEN, DRAWN)).toBeCloseTo(12.5, 1);
  });

  it('polar night: always the drawn night', () => {
    const hours = hoursOver(Date.UTC(2026, 11, 21), 1, LONGYEARBYEN);
    expect(hours.every((hour) => hour <= DRAWN.civilDawn || hour >= DRAWN.civilDusk)).toBe(true);
  });

  it('polar twilight: dawn and dusk come around noon, the drawn day never does', () => {
    const hours = hoursOver(Date.UTC(2026, 10, 10), 1, LONGYEARBYEN);
    expect(hours.some(isDrawnDay)).toBe(false);
    expect(hours.some((hour) => hour > DRAWN.civilDawn && hour <= DRAWN.sunrise)).toBe(true);
    expect(hours.some((hour) => hour >= DRAWN.sunset && hour < DRAWN.civilDusk)).toBe(true);
  });
});

describe('invalid input is refused (rule 6)', () => {
  it('refuses a reference day out of order or out of the day', () => {
    const moment = Date.UTC(2026, 5, 21, 12);
    const wrong: ReferenceDay[] = [
      { civilDawn: 6, sunrise: 5.5, sunset: 19, civilDusk: 19.5 },
      { civilDawn: 5.5, sunrise: 19, sunset: 6, civilDusk: 19.5 },
      { civilDawn: 5.5, sunrise: 6, sunset: 19, civilDusk: 25 },
      { civilDawn: -1, sunrise: 6, sunset: 19, civilDusk: 19.5 },
      { civilDawn: Number.NaN, sunrise: 6, sunset: 19, civilDusk: 19.5 },
    ];
    for (const reference of wrong) {
      expect(() => referenceHourAt(moment, PARIS, reference)).toThrow(RangeError);
    }
  });

  it('refuses a moment that is not a number', () => {
    expect(() => referenceHourAt(Number.NaN, PARIS, DRAWN)).toThrow(RangeError);
    expect(() => isSunUpAt(Number.POSITIVE_INFINITY, PARIS)).toThrow(RangeError);
  });
});
