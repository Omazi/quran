import type { ReminderSettings } from './types';

/**
 * Version of the stored document. Version 1 had no `fridayTime` and no `quietHours` in the
 * reminders: a version 1 document is upgraded when it is read (stored-data.ts). A document of
 * any other version is discarded.
 */
export const STORED_DATA_VERSION = 2;

/** The key of the stored document. */
export const STORED_DATA_KEY = 'app-data';

/** The daily goal the stepper allows (docs/specs/ui-lot1.md, A.3). */
export const DAILY_GOAL_RANGE = { min: 1, max: 60 } as const;

/**
 * The goal already in place at the first launch: half a hizb, the example of the specification.
 * The person changes it in the first-launch flow or in the settings.
 */
export const DEFAULT_DAILY_GOAL_PAGES = 5;

/** The reminders proposed at the first launch, as in the prototype the owner saw. */
export const DEFAULT_REMINDERS: ReminderSettings = Object.freeze({
  dailyEnabled: true,
  dailyTime: Object.freeze({ hour: 20, minute: 30 }),
  thirstyGardenEnabled: true,
  fridayKahfEnabled: true,
  fridayTime: Object.freeze({ hour: 9, minute: 0 }),
  quietHours: null,
});

/** Bounds of a time of day. */
export const LAST_HOUR = 23;
export const LAST_MINUTE = 59;

/** The garden module accepts a seed from 0 to 2^53 - 1: this is the number of possible seeds. */
export const USER_SEED_COUNT = Number.MAX_SAFE_INTEGER + 1;
