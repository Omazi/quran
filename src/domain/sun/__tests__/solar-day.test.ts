import { parseLocalDate } from '../../shared/local-date';
import { solarDateAt, solarDayOn, type GeoPosition } from '../index';

/**
 * Reference times: PyEphem 4.2.1 (full ephemeris), refraction of the standard atmosphere, the
 * sun's upper limb at 34' under the horizon for sunrise and sunset, its centre at 6° under it for
 * civil twilight. Written as the local clock of the place on that date.
 */
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
/** Allowed gap to the ephemeris (spec rule 2): measured under 15 seconds on every case here. */
const TOLERANCE_MINUTES = 1;
/**
 * At 64° N and beyond the sun crosses the horizon at a low angle, where a hundredth of a degree
 * is many seconds: the same tolerance would be luck, twice it is a margin.
 */
const HIGH_LATITUDE_TOLERANCE_MINUTES = 2;

const TORONTO: GeoPosition = { latitude: 43.65, longitude: -79.38 };
const PARIS: GeoPosition = { latitude: 48.87, longitude: 2.33 };
const MECCA: GeoPosition = { latitude: 21.42, longitude: 39.83 };
const JAKARTA: GeoPosition = { latitude: -6.17, longitude: 106.8 };
const REYKJAVIK: GeoPosition = { latitude: 64.15, longitude: -21.85 };
const LONGYEARBYEN: GeoPosition = { latitude: 78, longitude: 16 };

/** The instant of a local clock reading `YYYY-MM-DD HH:MM:SS` at a UTC offset in hours. */
function local(text: string, offsetHours: number): number {
  const [date, time] = text.split(' ') as [string, string];
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const [hours, minutes, seconds] = time.split(':').map(Number) as [number, number, number];
  return Date.UTC(year, month - 1, day, hours, minutes, seconds) - offsetHours * HOUR_MS;
}

function expectNear(actual: number | null, expected: number, toleranceMinutes: number): void {
  expect(actual).not.toBeNull();
  expect(Math.abs((actual as number) - expected) / MINUTE_MS).toBeLessThanOrEqual(toleranceMinutes);
}

interface Reference {
  readonly city: string;
  readonly place: GeoPosition;
  readonly date: string;
  readonly offset: number;
  readonly civilDawn: string;
  readonly sunrise: string;
  readonly noon: string;
  readonly sunset: string;
  readonly civilDusk: string;
  readonly tolerance: number;
}

const REFERENCES: readonly Reference[] = [
  {
    city: 'Toronto',
    place: TORONTO,
    date: '2026-11-27',
    offset: -5,
    civilDawn: '06:54:42',
    sunrise: '07:26:36',
    noon: '12:05:12',
    sunset: '16:43:29',
    civilDusk: '17:15:22',
    tolerance: TOLERANCE_MINUTES,
  },
  {
    city: 'Toronto',
    place: TORONTO,
    date: '2026-06-21',
    offset: -4,
    civilDawn: '05:00:03',
    sunrise: '05:36:06',
    noon: '13:19:23',
    sunset: '21:02:40',
    civilDusk: '21:38:43',
    tolerance: TOLERANCE_MINUTES,
  },
  {
    city: 'Toronto',
    place: TORONTO,
    date: '2026-12-21',
    offset: -5,
    civilDawn: '07:14:58',
    sunrise: '07:47:49',
    noon: '12:15:42',
    sunset: '16:43:35',
    civilDusk: '17:16:26',
    tolerance: TOLERANCE_MINUTES,
  },
  {
    city: 'Paris',
    place: PARIS,
    date: '2026-06-21',
    offset: 2,
    civilDawn: '05:04:17',
    sunrise: '05:47:00',
    noon: '13:52:28',
    sunset: '21:57:57',
    civilDusk: '22:40:40',
    tolerance: TOLERANCE_MINUTES,
  },
  {
    city: 'Paris',
    place: PARIS,
    date: '2026-12-21',
    offset: 1,
    civilDawn: '08:04:03',
    sunrise: '08:41:20',
    noon: '12:48:43',
    sunset: '16:56:06',
    civilDusk: '17:33:23',
    tolerance: TOLERANCE_MINUTES,
  },
  {
    city: 'Mecca',
    place: MECCA,
    date: '2026-06-21',
    offset: 3,
    civilDawn: '05:14:24',
    sunrise: '05:39:19',
    noon: '12:22:29',
    sunset: '19:05:39',
    civilDusk: '19:30:33',
    tolerance: TOLERANCE_MINUTES,
  },
  {
    city: 'Mecca',
    place: MECCA,
    date: '2026-12-21',
    offset: 3,
    civilDawn: '06:29:31',
    sunrise: '06:53:47',
    noon: '12:18:42',
    sunset: '17:43:36',
    civilDusk: '18:07:52',
    tolerance: TOLERANCE_MINUTES,
  },
  {
    city: 'Jakarta',
    place: JAKARTA,
    date: '2026-06-21',
    offset: 7,
    civilDawn: '05:38:57',
    sunrise: '06:01:36',
    noon: '11:54:33',
    sunset: '17:47:29',
    civilDusk: '18:10:08',
    tolerance: TOLERANCE_MINUTES,
  },
  {
    city: 'Jakarta',
    place: JAKARTA,
    date: '2026-12-21',
    offset: 7,
    civilDawn: '05:13:26',
    sunrise: '05:36:11',
    noon: '11:50:43',
    sunset: '18:05:15',
    civilDusk: '18:28:00',
    tolerance: TOLERANCE_MINUTES,
  },
  {
    city: 'Reykjavik',
    place: REYKJAVIK,
    date: '2026-12-21',
    offset: 0,
    civilDawn: '10:02:40',
    sunrise: '11:21:57',
    noon: '13:25:29',
    sunset: '15:29:01',
    civilDusk: '16:48:18',
    tolerance: HIGH_LATITUDE_TOLERANCE_MINUTES,
  },
];

describe('solarDayOn: sunrise, sunset and civil twilight of a local date (rule 2)', () => {
  it.each(REFERENCES)(
    'matches the ephemeris in $city on $date',
    ({ place, date, offset, civilDawn, sunrise, noon, sunset, civilDusk, tolerance }) => {
      const day = solarDayOn(parseLocalDate(date), place);
      expect(day.date).toBe(date);
      expect(day.sun).toBe('rises-and-sets');
      expect(day.civilTwilight).toBe('rises-and-sets');
      expectNear(day.civilDawn, local(`${date} ${civilDawn}`, offset), tolerance);
      expectNear(day.sunrise, local(`${date} ${sunrise}`, offset), tolerance);
      expectNear(day.solarNoon, local(`${date} ${noon}`, offset), tolerance);
      expectNear(day.sunset, local(`${date} ${sunset}`, offset), tolerance);
      expectNear(day.civilDusk, local(`${date} ${civilDusk}`, offset), tolerance);
    },
  );

  it('orders the events of an ordinary day: civil dawn, sunrise, noon, sunset, civil dusk', () => {
    const day = solarDayOn(parseLocalDate('2026-03-20'), PARIS);
    const events = [day.civilDawn, day.sunrise, day.solarNoon, day.sunset, day.civilDusk];
    expect(events.every((event) => event !== null)).toBe(true);
    expect([...events].sort((a, b) => (a as number) - (b as number))).toEqual(events);
  });
});

describe('solarDayOn: polar days and nights have no event, never a wrong one (rule 3)', () => {
  it('Reykjavik in June: the sun sets after local midnight and civil twilight lasts all night', () => {
    const day = solarDayOn(parseLocalDate('2026-06-21'), REYKJAVIK);
    expect(day.sun).toBe('rises-and-sets');
    expectNear(day.sunrise, local('2026-06-21 02:54:51', 0), HIGH_LATITUDE_TOLERANCE_MINUTES);
    expectNear(day.sunset, local('2026-06-22 00:03:33', 0), HIGH_LATITUDE_TOLERANCE_MINUTES);
    expect(day.civilTwilight).toBe('always-up');
    expect(day.civilDawn).toBeNull();
    expect(day.civilDusk).toBeNull();
  });

  it('polar day: the sun never sets at Longyearbyen on 21 June', () => {
    const day = solarDayOn(parseLocalDate('2026-06-21'), LONGYEARBYEN);
    expect(day.sun).toBe('always-up');
    expect(day.civilTwilight).toBe('always-up');
    expect([day.sunrise, day.sunset, day.civilDawn, day.civilDusk]).toEqual([
      null,
      null,
      null,
      null,
    ]);
    expectNear(day.solarNoon, local('2026-06-21 12:57:48', 2), TOLERANCE_MINUTES);
  });

  it('polar night: the sun never rises at Longyearbyen on 21 December, not even to civil twilight', () => {
    const day = solarDayOn(parseLocalDate('2026-12-21'), LONGYEARBYEN);
    expect(day.sun).toBe('always-down');
    expect(day.civilTwilight).toBe('always-down');
    expect([day.sunrise, day.sunset, day.civilDawn, day.civilDusk]).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });

  it('polar twilight: no sunrise at Longyearbyen on 10 November, but a civil dawn and dusk', () => {
    const day = solarDayOn(parseLocalDate('2026-11-10'), LONGYEARBYEN);
    expect(day.sun).toBe('always-down');
    expect(day.sunrise).toBeNull();
    expect(day.sunset).toBeNull();
    expect(day.civilTwilight).toBe('rises-and-sets');
    // The sun grazes 6° under the horizon: a tenth of a degree would be six minutes here.
    expectNear(day.civilDawn, local('2026-11-10 10:13:12', 1), HIGH_LATITUDE_TOLERANCE_MINUTES);
    expectNear(day.civilDusk, local('2026-11-10 13:04:47', 1), HIGH_LATITUDE_TOLERANCE_MINUTES);
  });

  it('the poles themselves give a polar day or night, never a number that is not one', () => {
    const june = parseLocalDate('2026-06-21');
    expect(solarDayOn(june, { latitude: 90, longitude: 0 }).sun).toBe('always-up');
    expect(solarDayOn(june, { latitude: -90, longitude: 0 }).sun).toBe('always-down');
    expect(Number.isFinite(solarDayOn(june, { latitude: 90, longitude: 0 }).solarNoon)).toBe(true);
  });
});

describe('the sun’s times are instants: a clock change (DST) does not move them (rule 4)', () => {
  it.each([
    ['Paris, spring', PARIS, '2026-03-28', 1, '06:36:57', '2026-03-29', 2, '07:34:51'],
    ['Paris, autumn', PARIS, '2026-10-24', 2, '08:24:48', '2026-10-25', 1, '07:26:22'],
    ['Toronto, spring', TORONTO, '2026-03-07', -5, '06:43:40', '2026-03-08', -4, '07:41:56'],
  ] as const)(
    '%s: the clock reading jumps an hour, the instant moves by a minute or two',
    (_name, place, before, offsetBefore, riseBefore, after, offsetAfter, riseAfter) => {
      const first = solarDayOn(parseLocalDate(before), place);
      const second = solarDayOn(parseLocalDate(after), place);
      expectNear(first.sunrise, local(`${before} ${riseBefore}`, offsetBefore), TOLERANCE_MINUTES);
      expectNear(second.sunrise, local(`${after} ${riseAfter}`, offsetAfter), TOLERANCE_MINUTES);
      const dayMs = 24 * HOUR_MS;
      const drift = Math.abs((second.sunrise as number) - (first.sunrise as number) - dayMs);
      expect(drift / MINUTE_MS).toBeLessThan(3);
    },
  );
});

describe('solarDateAt: the date of the place, by its own sun (rule 1)', () => {
  it('a moment just after midnight UTC is still the evening before in Reykjavik', () => {
    expect(solarDateAt(Date.UTC(2026, 5, 22, 0, 1), REYKJAVIK)).toBe('2026-06-21');
  });

  it('a moment in the evening UTC is already the next morning in the far east', () => {
    expect(solarDateAt(Date.UTC(2026, 5, 21, 20, 0), { latitude: 35.65, longitude: 139.74 })).toBe(
      '2026-06-22',
    );
  });

  it('the solar day of a moment contains that moment between its two solar midnights', () => {
    const moment = Date.UTC(2026, 10, 27, 21, 30);
    const day = solarDayOn(solarDateAt(moment, TORONTO), TORONTO);
    expect(Math.abs(moment - day.solarNoon)).toBeLessThan(12 * HOUR_MS + 20 * MINUTE_MS);
  });
});

describe('invalid input is refused (rule 6)', () => {
  const date = parseLocalDate('2026-06-21');
  it.each([
    { latitude: 91, longitude: 0 },
    { latitude: -90.5, longitude: 0 },
    { latitude: 0, longitude: 180.5 },
    { latitude: Number.NaN, longitude: 0 },
    { latitude: 0, longitude: Number.POSITIVE_INFINITY },
  ])('refuses the position %p', (position) => {
    expect(() => solarDayOn(date, position)).toThrow(RangeError);
    expect(() => solarDateAt(0, position)).toThrow(RangeError);
  });

  it('refuses a date that is not a calendar date, and a moment that is not a number', () => {
    // `as never`: the brand is bypassed on purpose, to feed the function what a caller should not.
    expect(() => solarDayOn('2026-02-30' as never, PARIS)).toThrow(RangeError);
    expect(() => solarDateAt(Number.NaN, PARIS)).toThrow(RangeError);
  });
});
