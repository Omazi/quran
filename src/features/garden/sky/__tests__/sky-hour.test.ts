import { solarDayOn } from '@/domain/sun';
import { parseLocalDate } from '@/domain/shared/local-date';

import { MOCKUP_DAY, skyHourAt, skyPhaseAt, skyStateAt } from '../sky-state';

const HOUR_MS = 3_600_000;
const TORONTO = { latitude: 43.65, longitude: -79.38 };
const PARIS = { latitude: 48.87, longitude: 2.33 };
const MECCA = { latitude: 21.42, longitude: 39.83 };

/** A local clock reading at a UTC offset in hours, as an instant. */
function clock(date: string, hour: number, minute: number, offset: number): number {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return Date.UTC(year, month - 1, day, hour, minute) - offset * HOUR_MS;
}

const phaseAt = (instant: number, place: typeof TORONTO) => skyPhaseAt(skyHourAt(instant, place));

describe('the mockup’s day: the sun rises at 6:00 and sets at 19:00 (js/sky.js)', () => {
  it('is the day the mockup’s sun crosses, with half an hour of civil twilight each side', () => {
    expect(MOCKUP_DAY).toEqual({ civilDawn: 5.5, sunrise: 6, sunset: 19, civilDusk: 19.5 });
  });

  it('puts the mockup’s sun on the horizon at its sunrise and sunset, highest at 12:30', () => {
    const low = skyStateAt(MOCKUP_DAY.sunrise).sun.y;
    expect(skyStateAt(MOCKUP_DAY.sunset).sun.y).toBeCloseTo(low, 6);
    expect(skyStateAt(12.5).sun.y).toBeLessThan(low);
    expect(skyStateAt(12.5).sun.x).toBeCloseTo(0.5, 6);
  });
});

describe('the sky’s phases follow the real sun of the place (owner, D51)', () => {
  it('Toronto on 27 November: dawn at sunrise, day at noon, golden hour before sunset, night after dusk', () => {
    const day = solarDayOn(parseLocalDate('2026-11-27'), TORONTO);
    expect(phaseAt(day.sunrise as number, TORONTO)).toBe('dawn');
    expect(phaseAt(day.solarNoon, TORONTO)).toBe('day');
    expect(phaseAt((day.sunset as number) - 30 * 60_000, TORONTO)).toBe('sunset');
    expect(phaseAt(clock('2026-11-27', 18, 30, -5), TORONTO)).toBe('night');
    // Under the mockup's fixed hours, 18:30 was the sunset and 16:30 the plain day.
    expect(phaseAt(clock('2026-11-27', 16, 30, -5), TORONTO)).toBe('sunset');
  });

  it('Paris on 21 June: still the golden hour at 21:30, night only after 22:40', () => {
    expect(phaseAt(clock('2026-06-21', 21, 30, 2), PARIS)).toBe('sunset');
    expect(phaseAt(clock('2026-06-21', 23, 30, 2), PARIS)).toBe('night');
    expect(phaseAt(clock('2026-06-21', 6, 0, 2), PARIS)).toBe('dawn');
  });

  it('the mockup’s sunset sky comes at the real sunset, in Mecca as in Toronto', () => {
    const mecca = solarDayOn(parseLocalDate('2026-12-21'), MECCA);
    expect(skyHourAt(mecca.sunset as number, MECCA)).toBeCloseTo(MOCKUP_DAY.sunset, 6);
    expect(skyHourAt(mecca.sunrise as number, MECCA)).toBeCloseTo(MOCKUP_DAY.sunrise, 6);
  });
});
