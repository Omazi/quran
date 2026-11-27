import { placeOfTimeZone, solarDayOn, SUN_CONFIG } from '../index';
import { parseLocalDate } from '../../shared/local-date';
import { ZONE_COORDINATES } from '../zone-coordinates';

describe('placeOfTimeZone: the place of the phone’s time zone (rule 1)', () => {
  it.each([
    ['America/Toronto', -300, 43.65, -79.38],
    ['Europe/Paris', 60, 48.87, 2.33],
    ['Asia/Riyadh', 180, 24.63, 46.72],
    ['Asia/Jakarta', 420, -6.17, 106.8],
    ['Atlantic/Reykjavik', 0, 64.15, -21.85],
  ] as const)('%s is placed where the database names it', (zone, offset, latitude, longitude) => {
    expect(placeOfTimeZone(zone, offset)).toEqual({ latitude, longitude, source: 'time-zone' });
  });

  it('a zone of its own country keeps its own place, not the one it shares rules with', () => {
    expect(placeOfTimeZone('Arctic/Longyearbyen', 60)).toMatchObject({
      latitude: 78,
      longitude: 16,
    });
    expect(placeOfTimeZone('Europe/Amsterdam', 60)).toMatchObject({ latitude: 52.37 });
  });

  it('an old name (a link of the database) takes the place of the zone it points to', () => {
    expect(placeOfTimeZone('Asia/Calcutta', 330)).toEqual(placeOfTimeZone('Asia/Kolkata', 330));
    expect(placeOfTimeZone('US/Eastern', -300)).toEqual(placeOfTimeZone('America/New_York', -300));
    expect(placeOfTimeZone('Europe/Kiev', 120)).toEqual(placeOfTimeZone('Europe/Kyiv', 120));
  });

  it('every place of the table is a real latitude and longitude', () => {
    const entries = Object.entries(ZONE_COORDINATES);
    expect(entries.length).toBeGreaterThan(400);
    for (const [, [latitude, longitude]] of entries) {
      expect(Math.abs(latitude)).toBeLessThanOrEqual(90);
      expect(Math.abs(longitude)).toBeLessThanOrEqual(180);
    }
  });
});

describe('placeOfTimeZone: without a known zone, the UTC offset and 30° N (rule 1, fallback)', () => {
  it('a zone with no place (UTC) is estimated from the offset', () => {
    expect(placeOfTimeZone('Etc/UTC', 0)).toEqual({
      latitude: SUN_CONFIG.fallbackLatitude,
      longitude: 0,
      source: 'utc-offset',
    });
  });

  it('15° of longitude per hour of offset', () => {
    expect(placeOfTimeZone('Mars/Olympus', 330).longitude).toBe(82.5);
    expect(placeOfTimeZone(null, -300).longitude).toBe(-75);
    expect(placeOfTimeZone(undefined, -720).longitude).toBe(-180);
    expect(placeOfTimeZone('', 60).source).toBe('utc-offset');
  });

  it('an offset past 12 hours east wraps round the date line', () => {
    expect(placeOfTimeZone(null, 840).longitude).toBe(-150);
    expect(placeOfTimeZone(null, 780).longitude).toBe(-165);
  });

  it('the fallback place still gives a sunrise and a sunset (30° N, 0° on 27 November)', () => {
    const day = solarDayOn(parseLocalDate('2026-11-27'), placeOfTimeZone(null, 0));
    // PyEphem: 06:34:52 and 17:00:06 UTC.
    expect(Math.abs((day.sunrise as number) - Date.UTC(2026, 10, 27, 6, 34, 52))).toBeLessThan(
      3 * 60_000,
    );
    expect(Math.abs((day.sunset as number) - Date.UTC(2026, 10, 27, 17, 0, 6))).toBeLessThan(
      3 * 60_000,
    );
  });

  it('refuses an offset that no clock has', () => {
    expect(() => placeOfTimeZone(null, Number.NaN)).toThrow(RangeError);
    expect(() => placeOfTimeZone(null, -721)).toThrow(RangeError);
    expect(() => placeOfTimeZone(null, 841)).toThrow(RangeError);
  });
});
