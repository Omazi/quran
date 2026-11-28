import { skyHourAt, skyPhaseAt } from '@/features/garden';
import { readerPaperOf } from '@/features/reader/reader-paper';

import { devicePlace, isSameSunMoment, sunMomentOf } from '../device-place';

const DAY_MS = 86_400_000;

describe('devicePlace: the place of the phone’s time zone, never its location (D51)', () => {
  it('places a known zone where the time zone database names it', () => {
    expect(devicePlace(new Date(Date.UTC(2026, 10, 27, 12)), 'America/Toronto')).toEqual({
      latitude: 43.65,
      longitude: -79.38,
      source: 'time-zone',
    });
  });

  it('estimates the place from the clock’s UTC offset when the zone is unknown', () => {
    const moment = new Date(Date.UTC(2026, 10, 27, 12));
    const place = devicePlace(moment, null);
    expect(place.source).toBe('utc-offset');
    expect(place.latitude).toBe(30);
    expect(place.longitude).toBe(-moment.getTimezoneOffset() / 4);
  });

  it('reads the zone of the phone when none is given', () => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(devicePlace(new Date(Date.UTC(2026, 10, 27, 12)))).toEqual(
      devicePlace(new Date(Date.UTC(2026, 10, 27, 12)), zone),
    );
  });
});

describe('sunMomentOf: the moment to the minute, with the place it is read at', () => {
  it('drops the seconds, so that the sky and the page change at most once a minute', () => {
    const moment = sunMomentOf(new Date(Date.UTC(2026, 10, 27, 12, 34, 56, 789)), 'Europe/Paris');
    expect(moment.instant).toBe(Date.UTC(2026, 10, 27, 12, 34));
    expect(moment.place.source).toBe('time-zone');
  });

  it('is the same moment only for the same minute at the same place', () => {
    const a = sunMomentOf(new Date(Date.UTC(2026, 10, 27, 12, 34, 5)), 'Europe/Paris');
    const b = sunMomentOf(new Date(Date.UTC(2026, 10, 27, 12, 34, 50)), 'Europe/Paris');
    const later = sunMomentOf(new Date(Date.UTC(2026, 10, 27, 12, 35)), 'Europe/Paris');
    const elsewhere = sunMomentOf(new Date(Date.UTC(2026, 10, 27, 12, 34)), 'Asia/Tokyo');
    expect(isSameSunMoment(a, b)).toBe(true);
    expect(isSameSunMoment(a, later)).toBe(false);
    expect(isSameSunMoment(a, elsewhere)).toBe(false);
  });
});

describe('the check’s pinned hours keep their looks under the CI machine’s clock (docs/BUILD.md)', () => {
  // The GitHub Mac runs on UTC: no zone of the table, so the place is 30° N, 0°. The check pins
  // 10:00 (day shots) and 22:00 (night shots): a pinned hour is a real clock reading of today,
  // read against the computed sun. This holds every day of the year.
  const place = { latitude: 30, longitude: 0 };
  it('10:00 is the day sky and the paper, 22:00 the night sky and the night page, all year', () => {
    for (let day = 0; day < 365; day += 7) {
      const morning = Date.UTC(2026, 0, 1, 10) + day * DAY_MS;
      const evening = Date.UTC(2026, 0, 1, 22) + day * DAY_MS;
      expect(skyPhaseAt(skyHourAt(morning, place))).toBe('day');
      expect(readerPaperOf({ instant: morning, place, systemScheme: 'light' })).toBe('day');
      expect(skyPhaseAt(skyHourAt(evening, place))).toBe('night');
      expect(readerPaperOf({ instant: evening, place, systemScheme: 'light' })).toBe('night');
    }
  });
});
