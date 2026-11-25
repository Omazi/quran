import type { Pause, ReadingEntry } from '@/domain/khatm';
import { PAGE_COUNT } from '@/domain/quran/types';
import type { LocalDate } from '@/domain/shared/local-date';
import type { DaySeconds, SecondsByDay } from '@/domain/stats';

import { SYNC_CONFIG } from './config';
import {
  eventId,
  isDayOfTime,
  isDeviceId,
  isRecord,
  isSameJson,
  isSettingKey,
  isStamp,
  isSyncDate,
  isWholeNumber,
  nextStamp,
  parseSyncEvent,
} from './events';
import { daysOf, deriveTime, pruneDays, pruneRecord, secondsOn, toSecondsByDay } from './time';
import type {
  BookmarkMark,
  DeviceId,
  MergeResult,
  Stamp,
  SyncEvent,
  SyncMeta,
  SyncRules,
  SyncedValues,
  TimeEvent,
} from './types';

export interface NewMetaOptions {
  /** A new random device name (`DeviceId`). */
  readonly deviceId: DeviceId;
  /** The device's clock, in milliseconds. */
  readonly now: number;
}

/**
 * The sync metadata of a phone that has none yet: a first launch, or an update from a version of
 * the app without sync. What the phone holds is taken as never chosen (it gives way to any choice
 * made elsewhere), except the settings settled by the oldest choice, stamped now. The time found
 * on the phone becomes the baseline (`SyncMeta.timeBaseline`).
 */
export function createSyncMeta(
  values: SyncedValues,
  rules: SyncRules,
  { deviceId, now }: NewMetaOptions,
): SyncMeta {
  const at = Math.floor(now);
  const settingStamps = Object.fromEntries(
    Object.entries(rules.settings).map(([key, { rule }]) => [
      key,
      { at: rule === 'earliest' ? at : 0, device: deviceId },
    ]),
  );
  const bookmarkMarks = Object.fromEntries(
    values.bookmarks.map((page) => [String(page), { on: true, at: 0, device: deviceId }]),
  );
  return {
    deviceId,
    clock: at,
    settingStamps,
    bookmarkMarks,
    time: {},
    timeBaseline: daysOf(values.timeSpent).length === 0 ? null : values.timeSpent,
    account: null,
    cursor: 0,
    lastSyncedAt: null,
    outbox: [],
  };
}

const entryKey = ({ khatm, page }: Pick<ReadingEntry, 'khatm' | 'page'>) => `${khatm}:${page}`;
const pauseKey = ({ from, to }: Pause) => `${from}/${to}`;

/** The outbox, changed by adding events; an event replaces the older ones it supersedes. */
class OutboxDraft {
  private events: SyncEvent[];
  changed = false;

  constructor(
    initial: readonly SyncEvent[],
    private readonly isOpen: boolean,
  ) {
    this.events = [...initial];
  }

  add(event: SyncEvent, supersedes?: (other: SyncEvent) => boolean): void {
    if (!this.isOpen) return;
    if (supersedes !== undefined) this.events = this.events.filter((other) => !supersedes(other));
    this.events.push(event);
    this.changed = true;
  }

  result(): readonly SyncEvent[] {
    return this.events;
  }
}

/**
 * Records a change made on this phone (`before` to `after`): new stamps for the settings and
 * bookmarks that changed, the time added to this phone's own counter, and events in the outbox
 * once there is an account. Returns the very same metadata when nothing that syncs changed.
 * Values that went away (a journal discarded on reading, days of time dropped as too old) are not
 * changes to send: they are never events.
 */
export function recordLocalChanges(
  meta: SyncMeta,
  before: SyncedValues,
  after: SyncedValues,
  now: number,
  rules: SyncRules,
): SyncMeta {
  const device = meta.deviceId;
  const outbox = new OutboxDraft(meta.outbox, meta.account !== null);
  let clock = meta.clock;
  const stamp = (): Stamp => {
    clock = nextStamp(clock, now);
    return { at: clock, device };
  };
  let changed = false;

  if (after.journal !== before.journal) {
    const known = new Set(before.journal.map(entryKey));
    for (const { khatm, page, date } of after.journal) {
      if (!known.has(entryKey({ khatm, page }))) outbox.add({ kind: 'page', khatm, page, date });
    }
  }

  let settingStamps = meta.settingStamps;
  if (after.settings !== before.settings) {
    for (const key of Object.keys(rules.settings)) {
      const value = after.settings[key];
      if (value === undefined || isSameJson(before.settings[key], value)) continue;
      const next = stamp();
      settingStamps = { ...settingStamps, [key]: next };
      outbox.add(
        { kind: 'setting', key, value, ...next },
        (other) => other.kind === 'setting' && other.key === key,
      );
      changed = true;
    }
  }

  let bookmarkMarks = meta.bookmarkMarks;
  if (after.bookmarks !== before.bookmarks) {
    const wasOn = new Set(before.bookmarks);
    const isOn = new Set(after.bookmarks);
    for (const page of new Set([...wasOn, ...isOn])) {
      const on = isOn.has(page);
      if (on === wasOn.has(page)) continue;
      const next = stamp();
      bookmarkMarks = { ...bookmarkMarks, [String(page)]: { on, ...next } };
      outbox.add(
        { kind: 'bookmark', page, on, ...next },
        (other) => other.kind === 'bookmark' && other.page === page,
      );
      changed = true;
    }
  }

  if (after.pauses !== before.pauses) {
    const known = new Set(before.pauses.map(pauseKey));
    for (const { from, to } of after.pauses) {
      if (!known.has(pauseKey({ from, to }))) outbox.add({ kind: 'pause', from, to });
    }
  }

  let time = meta.time;
  let timeBaseline = meta.timeBaseline;
  if (after.timeSpent !== before.timeSpent) {
    const own: Record<LocalDate, DaySeconds> = { ...(time[device] ?? {}) };
    let ownChanged = false;
    for (const date of daysOf(after.timeSpent)) {
      const was = secondsOn(before.timeSpent, date);
      const is = secondsOn(after.timeSpent, date);
      const addedApp = Math.max(0, is.app - was.app);
      const addedReader = Math.max(0, is.reader - was.reader);
      if (addedApp === 0 && addedReader === 0) continue;
      const mine = secondsOn(own, date);
      const app = Math.min(rules.maxSecondsPerDay, mine.app + addedApp);
      const counted = { app, reader: Math.min(app, mine.reader + addedReader) };
      own[date] = counted;
      ownChanged = true;
      outbox.add(
        { kind: 'time', device, date, ...counted },
        (other) => other.kind === 'time' && other.device === device && other.date === date,
      );
    }
    if (ownChanged) {
      time = {
        ...time,
        [device]: toSecondsByDay(Object.entries(own) as [LocalDate, DaySeconds][]),
      };
      changed = true;
    }
    // Days the store no longer keeps leave the counters too.
    const kept = new Set(daysOf(after.timeSpent));
    const dropped = daysOf(before.timeSpent).filter((date) => !kept.has(date));
    if (dropped.length > 0) {
      time = pruneDays(time, kept);
      timeBaseline = timeBaseline === null ? null : pruneRecord(timeBaseline, kept);
      changed = true;
    }
  }

  if (!changed && !outbox.changed && clock === meta.clock) return meta;
  return {
    ...meta,
    clock,
    settingStamps,
    bookmarkMarks,
    time,
    timeBaseline,
    outbox: outbox.result(),
  };
}

/** Everything the phone holds, as events: what a first sign-in sends to the account. */
export function fullStateEvents(meta: SyncMeta, values: SyncedValues): SyncEvent[] {
  const events: SyncEvent[] = values.journal.map(({ khatm, page, date }) => ({
    kind: 'page',
    khatm,
    page,
    date,
  }));
  for (const [device, counters] of Object.entries(meta.time)) {
    for (const date of daysOf(counters)) {
      const { app, reader } = secondsOn(counters, date);
      events.push({ kind: 'time', device, date, app, reader });
    }
  }
  for (const [key, stamp] of Object.entries(meta.settingStamps)) {
    const value = values.settings[key];
    if (value !== undefined) events.push({ kind: 'setting', key, value, ...stamp });
  }
  for (const [page, mark] of Object.entries(meta.bookmarkMarks)) {
    events.push({ kind: 'bookmark', page: Number(page), ...mark });
  }
  for (const { from, to } of values.pauses) events.push({ kind: 'pause', from, to });
  return events;
}

/**
 * Ties the phone to an account. The same account changes nothing. Another one (the first
 * sign-in, or a different person) starts reading the account from its beginning, and sends all
 * of the phone's progress: it is merged with the account's, never put in its place.
 */
export function startAccount(meta: SyncMeta, values: SyncedValues, account: string): SyncMeta {
  if (meta.account === account) return meta;
  return {
    ...meta,
    account,
    cursor: 0,
    lastSyncedAt: null,
    outbox: fullStateEvents(meta, values),
  };
}

/** Forgets the events the server has received. An event added during the sending stays. */
export function acknowledgePushed(meta: SyncMeta, sent: readonly SyncEvent[]): SyncMeta {
  if (sent.length === 0) return meta;
  const received = new Set(sent.map(eventId));
  const outbox = meta.outbox.filter((event) => !received.has(eventId(event)));
  return outbox.length === meta.outbox.length ? meta : { ...meta, outbox };
}

/**
 * Once the account's time is known (a complete pull), the baseline turns into this phone's own
 * time, for what it holds beyond the other phones' (`deriveTime`). The time shown does not move.
 */
export function settleTimeBaseline(
  meta: SyncMeta,
  values: SyncedValues,
  rules: SyncRules,
): Omit<MergeResult, 'changed'> {
  const baseline = meta.timeBaseline;
  if (baseline === null) return { meta, values };
  const device = meta.deviceId;
  const own: Record<LocalDate, DaySeconds> = { ...(meta.time[device] ?? {}) };
  const sent: TimeEvent[] = [];
  for (const date of daysOf(baseline)) {
    let othersApp = 0;
    let othersReader = 0;
    for (const [other, counters] of Object.entries(meta.time)) {
      if (other === device) continue;
      othersApp += secondsOn(counters, date).app;
      othersReader += secondsOn(counters, date).reader;
    }
    const base = secondsOn(baseline, date);
    const extraApp = Math.max(0, base.app - othersApp);
    const extraReader = Math.max(0, base.reader - othersReader);
    if (extraApp === 0 && extraReader === 0) continue;
    const mine = secondsOn(own, date);
    const app = Math.min(rules.maxSecondsPerDay, mine.app + extraApp);
    own[date] = { app, reader: Math.min(app, mine.reader + extraReader) };
    sent.push({ kind: 'time', device, date, ...own[date] });
  }
  const time = {
    ...meta.time,
    [device]: toSecondsByDay(Object.entries(own) as [LocalDate, DaySeconds][]),
  };
  if (Object.keys(own).length === 0) delete (time as Record<string, SecondsByDay>)[device];
  const derived = deriveTime(time, device, null, rules);
  const sentDays = new Set(sent.map((event) => event.date));
  const outbox =
    meta.account === null
      ? meta.outbox
      : [
          ...meta.outbox.filter(
            (event) =>
              !(event.kind === 'time' && event.device === device && sentDays.has(event.date)),
          ),
          ...sent,
        ];
  return {
    meta: { ...meta, time: derived.time, timeBaseline: null, outbox },
    values: { ...values, timeSpent: derived.timeSpent },
  };
}

// --- Reading the stored metadata back ---------------------------------------------------------

function readTimeRecord(value: unknown, rules: SyncRules): SecondsByDay | null {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value);
  if (entries.length > rules.maxTimeDays) return null;
  const days: [LocalDate, DaySeconds][] = [];
  for (const [date, seconds] of entries) {
    if (!isSyncDate(date, rules) || !isRecord(seconds)) return null;
    if (!isDayOfTime(seconds.app, seconds.reader, rules)) return null;
    days.push([date, { app: seconds.app, reader: seconds.reader as number }]);
  }
  return toSecondsByDay(days);
}

function readStamps(value: unknown, rules: SyncRules): Record<string, Stamp> | null {
  if (!isRecord(value)) return null;
  const stamps: [string, Stamp][] = [];
  for (const [key, stamp] of Object.entries(value)) {
    if (!isSettingKey(key) || !isStamp(stamp)) return null;
    // A key this version does not know (written by a newer one) is left aside.
    if (Object.prototype.hasOwnProperty.call(rules.settings, key)) {
      stamps.push([key, { at: stamp.at, device: stamp.device }]);
    }
  }
  return Object.fromEntries(stamps);
}

function readMarks(value: unknown): Record<string, BookmarkMark> | null {
  if (!isRecord(value)) return null;
  const marks: [string, BookmarkMark][] = [];
  for (const [page, mark] of Object.entries(value)) {
    if (!/^[1-9][0-9]{0,2}$/.test(page) || Number(page) > PAGE_COUNT) return null;
    if (!isStamp(mark) || !isRecord(mark) || typeof mark.on !== 'boolean') return null;
    marks.push([page, { on: mark.on, at: mark.at, device: mark.device }]);
  }
  return Object.fromEntries(marks);
}

function readDeviceTimes(value: unknown, rules: SyncRules): Record<DeviceId, SecondsByDay> | null {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value);
  if (entries.length > SYNC_CONFIG.maxDevices) return null;
  const devices: [DeviceId, SecondsByDay][] = [];
  for (const [device, counters] of entries) {
    const record = readTimeRecord(counters, rules);
    if (!isDeviceId(device) || record === null) return null;
    devices.push([device, record]);
  }
  return Object.fromEntries(devices);
}

/**
 * The sync metadata read back from the stored document, checked like everything stored. Null
 * when any part is damaged: the store then starts the metadata again (`createSyncMeta`). A
 * damaged event of the outbox is only dropped: it can be sent again by a later full sending.
 */
export function readSyncMeta(value: unknown, rules: SyncRules): SyncMeta | null {
  if (!isRecord(value)) return null;
  const { deviceId, clock, account, cursor, lastSyncedAt, outbox } = value;
  if (!isDeviceId(deviceId) || !isWholeNumber(clock, 0, Number.MAX_SAFE_INTEGER)) return null;
  if (
    account !== null &&
    (typeof account !== 'string' ||
      account.length === 0 ||
      account.length > SYNC_CONFIG.maxAccountLength)
  ) {
    return null;
  }
  if (!isWholeNumber(cursor, 0, Number.MAX_SAFE_INTEGER)) return null;
  if (lastSyncedAt !== null && !isWholeNumber(lastSyncedAt, 0, Number.MAX_SAFE_INTEGER)) {
    return null;
  }
  if (!Array.isArray(outbox)) return null;
  const settingStamps = readStamps(value.settingStamps, rules);
  const bookmarkMarks = readMarks(value.bookmarkMarks);
  const time = readDeviceTimes(value.time, rules);
  const timeBaseline =
    value.timeBaseline === null ? null : readTimeRecord(value.timeBaseline, rules);
  if (settingStamps === null || bookmarkMarks === null || time === null) return null;
  if (value.timeBaseline !== null && timeBaseline === null) return null;
  return {
    deviceId,
    clock,
    settingStamps,
    bookmarkMarks,
    time,
    timeBaseline,
    account: account as string | null,
    cursor,
    lastSyncedAt: lastSyncedAt as number | null,
    // Without an account nothing waits to be sent: a first sign-in sends everything anyway.
    outbox:
      account === null
        ? []
        : outbox
            .map((event) => parseSyncEvent(event, rules))
            .filter((event): event is SyncEvent => event !== null),
  };
}
