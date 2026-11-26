import type { Pause, ReadingJournal } from '@/domain/khatm';
import type { LocalDate } from '@/domain/shared/local-date';
import type { SecondsByDay } from '@/domain/stats';

/** A value that survives `JSON.stringify` and `JSON.parse` unchanged: what a setting holds. */
export type JsonValue =
  null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };

/**
 * The name a phone gives itself, drawn at random once (letters, digits, `-` and `_`, 1 to 40).
 * It is not a secret and says nothing about the phone: it only tells two phones apart.
 */
export type DeviceId = string;

/**
 * When a change was made, and where. `at` is the device's clock in milliseconds, kept monotonic
 * and pushed past every stamp the device has seen (a hybrid logical clock): a change made after
 * seeing another always wins over it, whatever the phones' clocks say.
 */
export interface Stamp {
  readonly at: number;
  readonly device: DeviceId;
}

/** A page first read in a khatma: one journal entry. Merged by (khatm, page), the earliest day. */
export interface PageEvent {
  readonly kind: 'page';
  readonly khatm: number;
  readonly page: number;
  readonly date: LocalDate;
}

/**
 * The time one phone counted on one day, all of it so far (not an increase). Merged by
 * (device, day) keeping the highest; the day's time is the sum over the phones.
 */
export interface TimeEvent {
  readonly kind: 'time';
  readonly device: DeviceId;
  readonly date: LocalDate;
  readonly app: number;
  readonly reader: number;
}

/** A setting chosen: the last choice wins (see `RegisterRule` for the exceptions). */
export interface SettingEvent extends Stamp {
  readonly kind: 'setting';
  readonly key: string;
  readonly value: JsonValue;
}

/** A bookmark put on (`on`) or taken off a page: the last change of each page wins. */
export interface BookmarkEvent extends Stamp {
  readonly kind: 'bookmark';
  readonly page: number;
  readonly on: boolean;
}

/** A pause of the garden: pauses are only ever added, so they are a growing set. */
export interface PauseEvent {
  readonly kind: 'pause';
  readonly from: LocalDate;
  readonly to: LocalDate;
}

/**
 * One change of the person's progress, as it travels between the phones and the server. Events
 * are facts: never changed, never removed, and applying one twice is applying it once.
 */
export type SyncEvent = PageEvent | TimeEvent | SettingEvent | BookmarkEvent | PauseEvent;

/** The last change of one bookmark. */
export interface BookmarkMark extends Stamp {
  readonly on: boolean;
}

/**
 * What the sync sees of the person's progress: the values the store keeps and shows. The store
 * turns its own data into these and back (src/store/sync-bridge.ts).
 */
export interface SyncedValues {
  readonly journal: ReadingJournal;
  /** The time of every phone added up (the store's `timeSpent`). */
  readonly timeSpent: SecondsByDay;
  /** The settings that travel, by key: only keys named by `SyncRules.settings`. */
  readonly settings: Readonly<Record<string, JsonValue>>;
  /** Bookmarked pages, each once, in increasing order. */
  readonly bookmarks: readonly number[];
  readonly pauses: readonly Pause[];
}

/**
 * What a phone remembers to sync, kept in the same stored document as the progress so that the
 * two are always written together.
 */
export interface SyncMeta {
  readonly deviceId: DeviceId;
  /** The last stamp this phone gave or saw (see `Stamp`). */
  readonly clock: number;
  /** When each setting was last chosen. A setting never chosen has `{ at: 0, device: '' }`. */
  readonly settingStamps: Readonly<Record<string, Stamp>>;
  /** The last change of each bookmarked or unbookmarked page, by page number. */
  readonly bookmarkMarks: Readonly<Record<string, BookmarkMark>>;
  /** The time counted by each phone, this one included, by day. */
  readonly time: Readonly<Record<DeviceId, SecondsByDay>>;
  /**
   * Time found on the phone when the sync started (an update of the app, a copy brought back by
   * iCloud), not yet compared with the account's: it is only sent once the account's time is
   * known, for what goes beyond it, so that the same time is never counted twice.
   */
  readonly timeBaseline: SecondsByDay | null;
  /** The account the phone syncs with, or null before the first sign-in. */
  readonly account: string | null;
  /** The last server sequence number received. */
  readonly cursor: number;
  /** When the last sync finished, in milliseconds since 1970, or null. */
  readonly lastSyncedAt: number | null;
  /** Changes not yet received by the server. Empty while there is no account. */
  readonly outbox: readonly SyncEvent[];
}

/**
 * How two choices of one setting are settled: the newest (`latest`), the oldest (`earliest`:
 * the seed of the gardens, so that an account keeps its look), or `true` over `false`
 * (`true-wins`: an introduction once finished stays finished), or the highest number (`highest`:
 * a count that only goes up, such as the last khatma celebrated, so that a phone that is behind
 * never takes it back).
 */
export type RegisterRule = 'latest' | 'earliest' | 'true-wins' | 'highest';

export interface SettingRule {
  readonly rule: RegisterRule;
  /** Whether the store accepts this value. A value it would refuse is never applied. */
  readonly isValid: (value: unknown) => boolean;
}

/** What the store accepts, given to the sync so that it never builds data the store would refuse. */
export interface SyncRules {
  readonly settings: Readonly<Record<string, SettingRule>>;
  readonly maxPauses: number;
  readonly maxTimeDays: number;
  readonly maxSecondsPerDay: number;
  readonly earliestDate: LocalDate;
  readonly latestDate: LocalDate;
}

/** The result of applying events from elsewhere. */
export interface MergeResult {
  readonly meta: SyncMeta;
  readonly values: SyncedValues;
  /** False when the events brought nothing new to the values. */
  readonly changed: boolean;
}
