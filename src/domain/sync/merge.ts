import type { Pause, ReadingEntry, ReadingJournal } from '@/domain/khatm';
import { PAGE_COUNT } from '@/domain/quran/types';
import type { LocalDate } from '@/domain/shared/local-date';
import type { DaySeconds, SecondsByDay } from '@/domain/stats';

import { compareStamps, isSameJson, observeStamp, parseSyncEvent } from './events';
import { deriveTime, isSameTime, secondsOn, toSecondsByDay } from './time';
import type {
  BookmarkMark,
  DeviceId,
  JsonValue,
  MergeResult,
  RegisterRule,
  Stamp,
  SyncEvent,
  SyncMeta,
  SyncRules,
  SyncedValues,
} from './types';

export interface MergeContext {
  /** The device's clock, in milliseconds. */
  readonly now: number;
  /** A new random device name, used when this phone finds a twin (see below). */
  readonly newDeviceId: () => DeviceId;
}

/**
 * Keeps one khatma in progress at a time, as the khatm module requires: khatmas 1, 2, 3...
 * follow each other, and only the last one may be incomplete. Entries of a khatma that cannot
 * exist yet (only a damaged or forged event can make one) are dropped. The order of the entries
 * is kept.
 */
export function normalizeJournal(journal: ReadingJournal): ReadingJournal {
  const pagesByKhatm = new Map<number, number>();
  for (const { khatm } of journal) pagesByKhatm.set(khatm, (pagesByKhatm.get(khatm) ?? 0) + 1);
  let last = 1;
  while (pagesByKhatm.get(last) === PAGE_COUNT) last += 1;
  const kept = journal.filter((entry) => entry.khatm <= last);
  return kept.length === journal.length ? journal : kept;
}

/** Whether `incoming` beats `current` under the rule of the setting. */
function settingWins(
  rule: RegisterRule,
  current: { readonly value: JsonValue | undefined; readonly stamp: Stamp },
  incoming: { readonly value: JsonValue; readonly stamp: Stamp },
): boolean {
  switch (rule) {
    case 'latest':
      return compareStamps(incoming.stamp, current.stamp) > 0;
    case 'earliest':
      return compareStamps(incoming.stamp, current.stamp) < 0;
    case 'true-wins':
      if (incoming.value === current.value) return compareStamps(incoming.stamp, current.stamp) < 0;
      return incoming.value === true;
  }
}

const entryKey = (khatm: number, page: number) => `${khatm}:${page}`;
const pauseKey = ({ from, to }: Pause) => `${from}/${to}`;
const comparePauses = (a: Pause, b: Pause) =>
  a.from !== b.from ? (a.from < b.from ? -1 : 1) : a.to < b.to ? -1 : a.to > b.to ? 1 : 0;

/**
 * Applies events from elsewhere: the account's, the other phones'. The result does not depend
 * on the order of the events nor on how many times each one comes:
 * - pages: one entry per (khatm, page), the earliest day;
 * - time: each phone's highest counter per day, the phones added up;
 * - settings and bookmarks: by stamp, under the rule of each setting; a value the store would
 *   refuse, or a setting this version does not know, is ignored;
 * - pauses: all of them, the first `maxPauses` by date.
 *
 * Every event is checked again first: anything the store could not take is skipped. The clock
 * moves past the stamps seen. A time counter of this phone's own name that is ahead of its own
 * means a twin (a phone restored from this one's backup, used beside it): this phone then takes
 * a new name, so that their time adds up again.
 */
export function mergeRemoteEvents(
  meta: SyncMeta,
  values: SyncedValues,
  events: readonly SyncEvent[],
  rules: SyncRules,
  { now, newDeviceId }: MergeContext,
): MergeResult {
  let clock = meta.clock;

  const entries = new Map<string, ReadingEntry>();
  for (const entry of values.journal) entries.set(entryKey(entry.khatm, entry.page), entry);
  let journalChanged = false;

  const time: Record<DeviceId, Record<LocalDate, DaySeconds>> = {};
  const counterOf = (device: DeviceId) =>
    (time[device] ??= { ...(meta.time[device] ?? {}) }) as Record<LocalDate, DaySeconds>;
  let hasTwin = false;

  const settings: Record<string, JsonValue> = { ...values.settings };
  const settingStamps: Record<string, Stamp> = { ...meta.settingStamps };
  let settingsChanged = false;

  const marks: Record<string, BookmarkMark> = { ...meta.bookmarkMarks };
  const bookmarks = new Set(values.bookmarks);
  let bookmarksChanged = false;

  const pauses = new Map(values.pauses.map((pause) => [pauseKey(pause), pause]));
  let pausesChanged = false;

  for (const candidate of events) {
    const event = parseSyncEvent(candidate, rules);
    if (event === null) continue;
    switch (event.kind) {
      case 'page': {
        const key = entryKey(event.khatm, event.page);
        const known = entries.get(key);
        if (known === undefined || event.date < known.date) {
          entries.set(key, { khatm: event.khatm, page: event.page, date: event.date });
          journalChanged = true;
        }
        break;
      }
      case 'time': {
        const own =
          event.device === meta.deviceId ? secondsOn(meta.time[meta.deviceId], event.date) : null;
        if (own !== null && (event.app > own.app || event.reader > own.reader)) hasTwin = true;
        const counters = counterOf(event.device);
        const known = secondsOn(counters, event.date);
        if (event.app > known.app || event.reader > known.reader) {
          counters[event.date] = {
            app: Math.max(known.app, event.app),
            reader: Math.max(known.reader, event.reader),
          };
        }
        break;
      }
      case 'setting': {
        clock = observeStamp(clock, event.at, now);
        const setting = Object.prototype.hasOwnProperty.call(rules.settings, event.key)
          ? rules.settings[event.key]
          : undefined;
        if (setting === undefined || !setting.isValid(event.value)) break;
        const current = {
          value: settings[event.key],
          stamp: settingStamps[event.key] ?? { at: 0, device: '' },
        };
        const incoming = { value: event.value, stamp: { at: event.at, device: event.device } };
        if (!settingWins(setting.rule, current, incoming)) break;
        settingStamps[event.key] = incoming.stamp;
        if (!isSameJson(current.value, event.value)) {
          settings[event.key] = event.value;
          settingsChanged = true;
        }
        break;
      }
      case 'bookmark': {
        clock = observeStamp(clock, event.at, now);
        const key = String(event.page);
        const current = marks[key] ?? {
          on: bookmarks.has(event.page),
          at: 0,
          device: '',
        };
        if (compareStamps(event, current) <= 0) break;
        marks[key] = { on: event.on, at: event.at, device: event.device };
        if (event.on !== bookmarks.has(event.page)) {
          if (event.on) bookmarks.add(event.page);
          else bookmarks.delete(event.page);
          bookmarksChanged = true;
        }
        break;
      }
      case 'pause': {
        const key = pauseKey(event);
        if (!pauses.has(key)) {
          pauses.set(key, { from: event.from, to: event.to });
          pausesChanged = true;
        }
        break;
      }
    }
  }

  // Values ---------------------------------------------------------------------------------
  let journal = values.journal;
  if (journalChanged) {
    journal = normalizeJournal([...entries.values()]);
  }

  const mergedTime: Record<DeviceId, SecondsByDay> = { ...meta.time };
  for (const [device, counters] of Object.entries(time)) {
    mergedTime[device] = toSecondsByDay(Object.entries(counters) as [LocalDate, DaySeconds][]);
  }
  const deviceId = hasTwin ? newDeviceId() : meta.deviceId;
  const derived = deriveTime(mergedTime, deviceId, meta.timeBaseline, rules);
  const timeChanged = !isSameTime(derived.timeSpent, values.timeSpent);

  // Always the same canonical list (once each, by date, the first `maxPauses`), whatever the
  // phone held: a pause added twice on one phone must not keep two phones apart.
  const canonicalPauses = [...pauses.values()].sort(comparePauses).slice(0, rules.maxPauses);
  const isSamePauses =
    !pausesChanged &&
    canonicalPauses.length === values.pauses.length &&
    canonicalPauses.every((pause, index) => pauseKey(pause) === pauseKey(values.pauses[index]!));
  const nextPauses = isSamePauses ? values.pauses : canonicalPauses;

  const changed =
    journal !== values.journal ||
    timeChanged ||
    settingsChanged ||
    bookmarksChanged ||
    nextPauses !== values.pauses;

  return {
    changed,
    meta: {
      ...meta,
      deviceId,
      clock,
      settingStamps,
      bookmarkMarks: marks,
      time: derived.time,
      timeBaseline: derived.timeBaseline,
    },
    values: {
      journal,
      timeSpent: timeChanged ? derived.timeSpent : values.timeSpent,
      settings: settingsChanged ? settings : values.settings,
      bookmarks: bookmarksChanged ? [...bookmarks].sort((a, b) => a - b) : values.bookmarks,
      pauses: nextPauses,
    },
  };
}
