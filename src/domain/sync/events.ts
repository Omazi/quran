import { PAGE_COUNT } from '@/domain/quran/types';
import { isLocalDate, type LocalDate } from '@/domain/shared/local-date';

import { DEVICE_ID_PATTERN, SETTING_KEY_PATTERN, SYNC_CONFIG } from './config';
import type { JsonValue, Stamp, SyncEvent, SyncRules } from './types';

/**
 * The id of an event: its content, written out. The same reading recorded on two phones is
 * one event; sending an event again is harmless, because the server keeps one row per id.
 * Only letters, digits, `.`, `-` and `_` (what the server accepts).
 */
export function eventId(event: SyncEvent): string {
  switch (event.kind) {
    case 'page':
      return `p.${event.khatm}.${event.page}.${event.date}`;
    case 'time':
      return `t.${event.device}.${event.date}.${event.app}.${event.reader}`;
    case 'setting':
      return `s.${event.key}.${event.device}.${event.at}`;
    case 'bookmark':
      return `b.${event.page}.${event.device}.${event.at}`;
    case 'pause':
      return `pa.${event.from}.${event.to}`;
  }
}

/**
 * Orders two stamps: by time, then by device name, so that every phone settles a tie the same
 * way. Negative when `a` is older.
 */
export function compareStamps(a: Stamp, b: Stamp): number {
  if (a.at !== b.at) return a.at < b.at ? -1 : 1;
  if (a.device === b.device) return 0;
  return a.device < b.device ? -1 : 1;
}

/** The next stamp of a device: its clock, never going back, and past every stamp it has seen. */
export function nextStamp(clock: number, now: number): number {
  return Math.max(Math.floor(now), clock + 1);
}

/** The clock after seeing a stamp from elsewhere, moved at most `maxClockLeadMs` past `now`. */
export function observeStamp(clock: number, at: number, now: number): number {
  return Math.max(clock, Math.min(at, Math.floor(now) + SYNC_CONFIG.maxClockLeadMs));
}

type UnknownRecord = Readonly<Record<string, unknown>>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isWholeNumber(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

export function isDeviceId(value: unknown): value is string {
  return typeof value === 'string' && DEVICE_ID_PATTERN.test(value);
}

export function isSettingKey(value: unknown): value is string {
  return typeof value === 'string' && SETTING_KEY_PATTERN.test(value);
}

export function isStamp(value: unknown): value is Stamp {
  return (
    isRecord(value) &&
    isWholeNumber(value.at, 0, Number.MAX_SAFE_INTEGER) &&
    isDeviceId(value.device)
  );
}

/** A real day inside the window the store accepts. */
export function isSyncDate(value: unknown, rules: SyncRules): value is LocalDate {
  return (
    typeof value === 'string' &&
    isLocalDate(value) &&
    value >= rules.earliestDate &&
    value <= rules.latestDate
  );
}

const MAX_JSON_DEPTH = 8;

/** A value made of JSON only (no `undefined`, function or infinite number), not too deep. */
export function isJsonValue(value: unknown, depth = 0): value is JsonValue {
  if (depth > MAX_JSON_DEPTH) return false;
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((item) => isJsonValue(item, depth + 1));
  if (isRecord(value)) return Object.values(value).every((item) => isJsonValue(item, depth + 1));
  return false;
}

/** Seconds of one day: whole, the reader's no more than the app's, the app's within a day. */
export function isDayOfTime(app: unknown, reader: unknown, rules: SyncRules): app is number {
  return isWholeNumber(app, 0, rules.maxSecondsPerDay) && isWholeNumber(reader, 0, app as number);
}

/**
 * An event received from elsewhere (the server, the stored outbox), checked field by field and
 * copied with its known fields only. Null for anything the store could not take. Whether the
 * value of a setting suits the store is checked when it is applied (`SyncRules.settings`).
 */
export function parseSyncEvent(value: unknown, rules: SyncRules): SyncEvent | null {
  if (!isRecord(value)) return null;
  switch (value.kind) {
    case 'page': {
      const { khatm, page, date } = value;
      if (!isWholeNumber(khatm, 1, SYNC_CONFIG.maxKhatm) || !isWholeNumber(page, 1, PAGE_COUNT)) {
        return null;
      }
      return isSyncDate(date, rules) ? { kind: 'page', khatm, page, date } : null;
    }
    case 'time': {
      const { device, date, app, reader } = value;
      if (!isDeviceId(device) || !isSyncDate(date, rules) || !isDayOfTime(app, reader, rules)) {
        return null;
      }
      return { kind: 'time', device, date, app, reader: reader as number };
    }
    case 'setting': {
      const { key, value: setting } = value;
      if (!isSettingKey(key) || !isStamp(value) || !isJsonValue(setting)) return null;
      return { kind: 'setting', key, value: setting, at: value.at, device: value.device };
    }
    case 'bookmark': {
      const { page, on } = value;
      if (!isWholeNumber(page, 1, PAGE_COUNT) || typeof on !== 'boolean' || !isStamp(value)) {
        return null;
      }
      return { kind: 'bookmark', page, on, at: value.at, device: value.device };
    }
    case 'pause': {
      const { from, to } = value;
      if (!isSyncDate(from, rules) || !isSyncDate(to, rules) || to < from) return null;
      return { kind: 'pause', from, to };
    }
    default:
      return null;
  }
}

/** Two JSON values compare by their text: settings hold plain data only. */
export function isSameJson(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}
