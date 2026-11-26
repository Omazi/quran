/**
 * Test kit of the sync module: rules like the store's, devices that read and change settings,
 * and a server that keeps every event it receives, in order, as the real one does.
 */
import { recordPageRead, type Pause, type ReadingJournal } from '@/domain/khatm';
import { parseLocalDate, type LocalDate } from '@/domain/shared/local-date';
import type { SecondsByDay } from '@/domain/stats';

import {
  acknowledgePushed,
  createSyncMeta,
  mergeRemoteEvents,
  recordLocalChanges,
  settleTimeBaseline,
  startAccount,
  type JsonValue,
  type SyncEvent,
  type SyncMeta,
  type SyncRules,
  type SyncedValues,
} from '..';

export function day(value: string): LocalDate {
  return parseLocalDate(value);
}

const isWhole = (value: unknown, min: number, max: number) =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

/** Rules shaped like the store's (src/store/sync-bridge.ts), kept small. */
export const RULES: SyncRules = {
  settings: {
    language: {
      rule: 'latest',
      isValid: (value) => value === null || value === 'fr' || value === 'en' || value === 'ar',
    },
    dailyGoalPages: { rule: 'latest', isValid: (value) => isWhole(value, 1, 60) },
    onboardingCompleted: { rule: 'true-wins', isValid: (value) => typeof value === 'boolean' },
    userSeed: { rule: 'earliest', isValid: (value) => isWhole(value, 0, Number.MAX_SAFE_INTEGER) },
    celebratedKhatm: {
      rule: 'highest',
      isValid: (value) => isWhole(value, 0, Number.MAX_SAFE_INTEGER),
    },
  },
  maxPauses: 3,
  maxTimeDays: 5,
  maxSecondsPerDay: 90_000,
  earliestDate: day('2020-01-01'),
  latestDate: day('2099-12-31'),
};

export const NO_TIME: SecondsByDay = {};

export function values(change: Partial<SyncedValues> = {}): SyncedValues {
  return {
    journal: [],
    timeSpent: NO_TIME,
    settings: {
      language: null,
      dailyGoalPages: 5,
      onboardingCompleted: false,
      userSeed: 7,
      celebratedKhatm: 0,
    },
    bookmarks: [],
    pauses: [],
    ...change,
  };
}

/**
 * One phone: its values (what the store shows) and its sync metadata, changed only through the
 * functions of the module, as the store and the engine do.
 */
export class Device {
  values: SyncedValues;
  meta: SyncMeta;
  clock: number;
  private nextId = 0;

  constructor(
    readonly name: string,
    { start = values(), now = 1_000 }: { start?: SyncedValues; now?: number } = {},
  ) {
    this.values = start;
    this.clock = now;
    this.meta = createSyncMeta(start, RULES, { deviceId: name, now });
  }

  /** Every change goes through here: the values change, and the metadata records it. */
  change(next: Partial<SyncedValues>): void {
    const after = { ...this.values, ...next };
    this.meta = recordLocalChanges(this.meta, this.values, after, this.clock, RULES);
    this.values = after;
  }

  read(pages: readonly number[], date: string): void {
    let journal: ReadingJournal = this.values.journal;
    for (const page of pages) journal = recordPageRead(journal, { page, date: day(date) });
    this.change({ journal });
  }

  set(key: string, value: JsonValue): void {
    this.change({ settings: { ...this.values.settings, [key]: value } });
  }

  addTime(date: string, app: number, reader = 0): void {
    const before = this.values.timeSpent[day(date)] ?? { app: 0, reader: 0 };
    this.change({
      timeSpent: {
        ...this.values.timeSpent,
        [day(date)]: { app: before.app + app, reader: before.reader + reader },
      },
    });
  }

  toggleBookmark(page: number): void {
    const { bookmarks } = this.values;
    this.change({
      bookmarks: bookmarks.includes(page)
        ? bookmarks.filter((other) => other !== page)
        : [...bookmarks, page].sort((a, b) => a - b),
    });
  }

  /** Like the store: no more than the most pauses kept. */
  addPause(pause: Pause): void {
    if (this.values.pauses.length >= RULES.maxPauses) return;
    this.change({ pauses: [...this.values.pauses, pause] });
  }

  signIn(account: string): void {
    this.meta = startAccount(this.meta, this.values, account);
  }

  /** Applies events from elsewhere, as a pull does. */
  receive(events: readonly SyncEvent[]): boolean {
    const merged = mergeRemoteEvents(this.meta, this.values, events, RULES, {
      now: this.clock,
      newDeviceId: () => `${this.name}-${(this.nextId += 1)}`,
    });
    this.meta = merged.meta;
    this.values = merged.values;
    return merged.changed;
  }

  settle(): void {
    const settled = settleTimeBaseline(this.meta, this.values, RULES);
    this.meta = settled.meta;
    this.values = settled.values;
  }

  /** Sends the outbox to the server and forgets what it sent. */
  push(server: Server): void {
    const sent = this.meta.outbox;
    server.receive(sent);
    this.meta = acknowledgePushed(this.meta, sent);
  }

  /** Takes what the server has after this device's cursor. */
  pull(server: Server): void {
    const { events, cursor } = server.after(this.meta.cursor);
    this.receive(events);
    this.meta = { ...this.meta, cursor };
  }

  sync(server: Server): void {
    this.pull(server);
    this.settle();
    this.push(server);
    this.pull(server);
  }
}

/** The server: every event once, by id, with a sequence number, as the migration keeps them. */
export class Server {
  readonly log: { seq: number; event: SyncEvent }[] = [];
  private readonly ids = new Set<string>();
  private seq = 0;

  constructor(private readonly idOf: (event: SyncEvent) => string) {}

  receive(events: readonly SyncEvent[]): void {
    for (const event of events) {
      const id = this.idOf(event);
      if (this.ids.has(id)) continue;
      this.ids.add(id);
      this.log.push({ seq: (this.seq += 1), event });
    }
  }

  after(cursor: number): { events: SyncEvent[]; cursor: number } {
    const rows = this.log.filter((row) => row.seq > cursor);
    return { events: rows.map((row) => row.event), cursor: rows.at(-1)?.seq ?? cursor };
  }
}

/** The values, written so that two devices with the same progress compare equal. */
export function comparable(data: SyncedValues) {
  return {
    journal: [...data.journal].map((entry) => `${entry.khatm}:${entry.page}:${entry.date}`).sort(),
    timeSpent: Object.entries(data.timeSpent).sort(([a], [b]) => (a < b ? -1 : 1)),
    settings: data.settings,
    bookmarks: data.bookmarks,
    pauses: [...data.pauses].map((pause) => `${pause.from}/${pause.to}`).sort(),
  };
}

export function pages(first: number, last: number): number[] {
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}
