/** Settings of the sync (docs/specs/sync.md). */
export const SYNC_CONFIG = Object.freeze({
  /**
   * How far ahead of this phone's clock a stamp seen elsewhere may move it: a day. A phone set to
   * a far year cannot freeze the settings of all the others; the server clamps the same way.
   */
  maxClockLeadMs: 24 * 60 * 60 * 1000,
  /** First wait after a failed sync, doubled at each failure. */
  retryBaseMs: 2_000,
  /** Longest wait between two attempts. */
  retryMaxMs: 5 * 60 * 1000,
  /** Wait after a change on the phone before sending it: changes close together go together. */
  changeDelayMs: 5_000,
  /** While the app is in the foreground, how often it asks the account for other phones' changes. */
  pollIntervalMs: 2 * 60 * 1000,
  /** Events sent in one request: the server refuses more (sync_push). */
  pushBatchSize: 200,
  /** Events asked for in one request: the server gives no more (sync_pull). */
  pullPageSize: 500,
  /** The longest device name and setting key. */
  maxNameLength: 40,
  /** The most phones whose time is kept: far more than one person uses. */
  maxDevices: 50,
  /** The longest account id kept (a uuid has 36 characters). */
  maxAccountLength: 64,
  /** The highest khatma number accepted from elsewhere. */
  maxKhatm: 10_000,
});

/** Letters, digits, `-` and `_`: a device name. */
export const DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

/** A setting key: a letter, then letters, digits and `_`. Never `__proto__`. */
export const SETTING_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
