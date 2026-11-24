/**
 * Calendar days as the user lives them, in their own time zone.
 *
 * Streaks and the garden reason in "days the user read", not in instants.
 * A LocalDate is a plain `YYYY-MM-DD` string so it is trivially comparable,
 * serialisable and free of time-zone surprises. Converting an instant to a
 * LocalDate happens once, at the edge of the app (where the device time zone
 * is known); the domain only ever manipulates LocalDate values.
 */
export type LocalDate = string & { readonly __brand: 'LocalDate' };

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

interface DateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

/** Splits "YYYY-MM-DD" into numbers, or returns null when the shape is wrong. */
function splitDate(value: string): DateParts | null {
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** Days since 1970-01-01 of a calendar date, computed in UTC to stay DST-proof. */
function toEpochDay(date: LocalDate): number {
  const parts = splitDate(date);
  if (!parts) throw new RangeError(`Invalid local date: "${date}"`);
  return Math.round(Date.UTC(parts.year, parts.month - 1, parts.day) / MS_PER_DAY);
}

function fromEpochDay(epochDay: number): LocalDate {
  return new Date(epochDay * MS_PER_DAY).toISOString().slice(0, 10) as LocalDate;
}

export function isLocalDate(value: string): value is LocalDate {
  const parts = splitDate(value);
  if (!parts) return false;
  const probe = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  // Rejects impossible dates such as 2026-02-30, which Date would silently roll over.
  return (
    probe.getUTCFullYear() === parts.year &&
    probe.getUTCMonth() === parts.month - 1 &&
    probe.getUTCDate() === parts.day
  );
}

/** Parses a `YYYY-MM-DD` string. Throws on anything that is not a real calendar date. */
export function parseLocalDate(value: string): LocalDate {
  if (!isLocalDate(value)) {
    throw new RangeError(`Invalid local date: "${value}" (expected a real YYYY-MM-DD date)`);
  }
  return value;
}

export function addDays(date: LocalDate, days: number): LocalDate {
  if (!Number.isInteger(days)) throw new RangeError(`addDays expects whole days, got ${days}`);
  const result = fromEpochDay(toEpochDay(date) + days);
  // Beyond year 9999 the calendar no longer fits the YYYY-MM-DD shape: refuse rather than
  // return a string that only looks like a date.
  if (!isLocalDate(result)) {
    throw new RangeError(`addDays(${date}, ${days}) falls outside the years 0001 to 9999`);
  }
  return result;
}

/** Whole days from `from` to `to`. Negative when `to` is before `from`. */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return toEpochDay(to) - toEpochDay(from);
}

export function compareLocalDates(a: LocalDate, b: LocalDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * The calendar day of an instant in a given IANA time zone (e.g. "America/Toronto").
 * This is the only function here that looks at a clock zone; call it at the app edge.
 */
export function localDateInTimeZone(instant: Date, timeZone: string): LocalDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return parseLocalDate(`${get('year')}-${get('month')}-${get('day')}`);
}
