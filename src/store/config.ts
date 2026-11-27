import type { SecondsByDay } from '@/domain/stats';

import type { ReminderSettings } from './types';

/**
 * Version of the stored document. Version 1 had no `fridayTime` and no `quietHours` in the
 * reminders; version 2 had no `timeSpent` (the time counters, D37). Version 3 was written by two
 * lines of the app, one with `timeSpent` and one with `settings.lastOpenedPage`; version 4 has both.
 * Version 5 adds `settings.bookmarks`, the pages bookmarked in the reader. Version 6 adds
 * `settings.readerScript` and `settings.readerTextSize`, the script and the text size chosen in
 * the reader (D41): required settings, so the version changes and a version 5 document takes
 * their first-launch values. Documents of the older versions are upgraded when they are read
 * (stored-data.ts).
 *
 * The document may also hold a `sync` part (docs/specs/sync.md). It is optional, so it does not
 * change the version: an older build of the app (a TestFlight build installed over a newer one)
 * still reads the document, and only leaves the `sync` part out. A document of a newer version
 * is read like this one when its settings and journal pass the checks (a newer version only adds
 * parts); otherwise, like a document of an unknown version, it is discarded. A build of version 5
 * thus reads a version 6 document, without the reader's two choices.
 * Version 7 adds `settings.goalKind`, how the goal was chosen (1 month, 3 months, 1 year, own
 * pace): required, so a version 6 document takes `own-pace`, which is what its daily goal was.
 * Version 8 adds `settings.showLevel` and `settings.celebratedKhatm` (D46): a version 7 document
 * shows its level (the default) and has celebrated nothing, its journal untouched, so an existing
 * user keeps their progress and level.
 * Version 9 adds `settings.gender` and `settings.genderAsked` (the person says whether they are a
 * man or a woman, so that the words agree; asked once, optional): a version 8 document has not
 * said, and has not been asked.
 * Version 10 adds `settings.soundsEnabled` and `settings.hapticsEnabled`, the switches "Sons" and
 * "Vibrations" of the interface feedback (src/data/feedback): a version 9 document has both on,
 * which is the default.
 */
export const STORED_DATA_VERSION = 10;

/** The key of the stored document. */
export const STORED_DATA_KEY = 'app-data';

/**
 * The key of a second copy of the stored document, written right after each successful write of
 * the first. When the first cannot be read back, or holds a part that cannot be trusted, that part
 * is taken from this copy before anything starts again from nothing (docs/specs/sync.md, 1).
 */
export const STORED_DATA_BACKUP_KEY = 'app-data-backup';

/**
 * The key under which a stored text that could not be trusted is kept before it is replaced, so
 * that it is not lost for a later repair. One generation only: the next rejected text takes its
 * place. The app never reads it back by itself.
 */
export const REJECTED_DATA_KEY = 'app-data-rejected';

/** The key that remembers which parts were rejected, until the person has been told. */
export const RESET_NOTICE_KEY = 'app-data-reset-notice';

/**
 * The days a stored date may name. The rules of the garden and of the streak walk the calendar
 * day by day from the oldest date they are given: a date in year 100 costs them seven hundred
 * thousand steps. No reading can be older than the app (first built in 2026; 2020 leaves room for
 * a phone whose clock is a few years late), and the end of the century is further than any phone
 * in use will go. Dates outside are refused when written and rejected when read back.
 */
export const STORED_DATE_RANGE = { earliest: '2020-01-01', latest: '2099-12-31' } as const;

/**
 * The most pauses kept. Each pause is walked day by day too, so their number multiplies the
 * cost. A pause is a rare event (an illness, a journey): fifty leaves room for years of them.
 */
export const MAX_PAUSES = 50;

/**
 * The most days of time kept (docs/specs/stats.md, time counters): ten years of days with time.
 * The days are written in the progress backup too, which is small (a quarter of a megabyte); past
 * this number the oldest days are dropped, so the time of all time slowly forgets its first days.
 */
export const MAX_TIME_DAYS = 3660;

/** The scripts the reader can show (D41): the mushaf's Uthmani text, or the simple (imla'i) one. */
export const READER_SCRIPTS = ['uthmani', 'imlaei'] as const;

/** The script of a first launch: the Uthmani text of the mushaf. */
export const DEFAULT_READER_SCRIPT = 'uthmani';

/**
 * The steps of the reader's own text size control (D41), on top of the phone's text size: the
 * reader's configuration says what each step is. The first launch is on the step that leaves the
 * phone's text size as it is.
 */
export const READER_TEXT_SIZE_RANGE = { min: 0, max: 4 } as const;
export const DEFAULT_READER_TEXT_SIZE = 1;

/** The daily goal the stepper allows (docs/specs/ui-lot1.md, A.3). */
export const DAILY_GOAL_RANGE = { min: 1, max: 60 } as const;

/**
 * The goal already in place at the first launch: half a hizb, the example of the specification.
 * The person changes it in the first-launch flow or in the settings.
 */
export const DEFAULT_DAILY_GOAL_PAGES = 5;

/** A first launch shows the person's level to their friends (D46): they can hide it. */
export const DEFAULT_SHOW_LEVEL = true;

/** Nothing said about the gender yet: every text has its neutral wording (owner, 26 Nov 2026). */
export const DEFAULT_GENDER = null;

/** The question about the gender has not been asked yet. */
export const DEFAULT_GENDER_ASKED = false;

/** A first launch has the interface sounds on (they stay silent when the phone's switch is). */
export const DEFAULT_SOUNDS_ENABLED = true;

/** A first launch has the interface vibrations on (the system's own haptics setting still rules). */
export const DEFAULT_HAPTICS_ENABLED = true;

/** No khatma celebrated yet. */
export const NO_KHATMA_CELEBRATED = 0;

/** The goal kind of a first launch, and of a document from before the goal kinds: an own pace. */
export const DEFAULT_GOAL_KIND = 'own-pace';

/**
 * The reminders proposed at the first launch: the two about the person's own reading, and the
 * Friday Al-Kahf one. The Friday reminder was off until the person switched it on, because its
 * notification names a surah on a lock screen others can see (notifications.md › Best practices);
 * the owner decided on 25 November 2026 that it is on (deviation 23 changed). It is the default
 * of new installs only: what a person has already saved is read back as it was.
 */
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

/** No time counted yet: the state of a first launch, and of time that could not be read back. */
export const EMPTY_TIME_SPENT: SecondsByDay = Object.freeze({});
