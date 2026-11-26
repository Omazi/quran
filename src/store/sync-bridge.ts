/**
 * Between the store and the sync rules of the domain (docs/specs/sync.md): which settings
 * travel and how their choices are settled, what the store accepts, and the store's data seen as
 * `SyncedValues` and back.
 */

import { MAX_SECONDS_PER_DAY } from '@/domain/stats';
import { parseLocalDate } from '@/domain/shared/local-date';
import type { JsonValue, SyncRules, SyncedValues } from '@/domain/sync';
import { isSupportedLanguage } from '@/i18n';

import { MAX_PAUSES, MAX_TIME_DAYS, STORED_DATE_RANGE } from './config';
import {
  isBookmarkList,
  isCelebratedKhatm,
  isDailyGoalPages,
  isGoalKind,
  isStoredGender,
  isLastOpenedPage,
  isReaderScript,
  isReaderTextSize,
  isUserSeed,
  readReminders,
} from './stored-data';
import type { AppData, AppSettings } from './types';

/**
 * The settings that follow the person from phone to phone, with the rule that settles two
 * choices. The language travels too: it is the person's choice, and null ("the phone's
 * language") is a choice like the others. `bookmarks` and `pauses` travel on their own terms.
 */
export const SYNC_RULES: SyncRules = Object.freeze({
  settings: Object.freeze({
    language: {
      rule: 'latest',
      isValid: (value: unknown) =>
        value === null || (typeof value === 'string' && isSupportedLanguage(value)),
    },
    dailyGoalPages: { rule: 'latest', isValid: isDailyGoalPages },
    // How the goal was chosen (1 month, own pace...): travels with the daily goal it explains.
    goalKind: { rule: 'latest', isValid: isGoalKind },
    onboardingCompleted: {
      rule: 'true-wins',
      isValid: (value: unknown) => typeof value === 'boolean',
    },
    // The oldest seed wins: a new phone takes the account's gardens, never the other way round.
    userSeed: { rule: 'earliest', isValid: isUserSeed },
    lastOpenedPage: { rule: 'latest', isValid: isLastOpenedPage },
    reminders: { rule: 'latest', isValid: (value: unknown) => readReminders(value) !== null },
    // The reader's script and text size (D41): the person's last choice, on every phone.
    readerScript: { rule: 'latest', isValid: isReaderScript },
    readerTextSize: { rule: 'latest', isValid: isReaderTextSize },
    // Whether friends see the level (D46): the person's last choice, on every phone.
    showLevel: { rule: 'latest', isValid: (value: unknown) => typeof value === 'boolean' },
    // What the person says they are (null: "prefer not to say" is a choice like the others), and
    // whether they were asked: a question answered on one phone is not asked on the others.
    gender: { rule: 'latest', isValid: isStoredGender },
    genderAsked: { rule: 'true-wins', isValid: (value: unknown) => typeof value === 'boolean' },
    // A khatma celebrated on one phone is not celebrated again on another.
    celebratedKhatm: { rule: 'highest', isValid: isCelebratedKhatm },
  }),
  maxPauses: MAX_PAUSES,
  maxTimeDays: MAX_TIME_DAYS,
  maxSecondsPerDay: MAX_SECONDS_PER_DAY,
  earliestDate: parseLocalDate(STORED_DATE_RANGE.earliest),
  latestDate: parseLocalDate(STORED_DATE_RANGE.latest),
} satisfies SyncRules);

/** The store's data as the sync sees it. */
export function toSyncedValues({ settings, journal, timeSpent }: AppData): SyncedValues {
  return {
    journal,
    timeSpent,
    settings: {
      language: settings.language,
      dailyGoalPages: settings.dailyGoalPages,
      goalKind: settings.goalKind,
      onboardingCompleted: settings.onboardingCompleted,
      userSeed: settings.userSeed,
      lastOpenedPage: settings.lastOpenedPage,
      reminders: settings.reminders as unknown as JsonValue,
      readerScript: settings.readerScript,
      readerTextSize: settings.readerTextSize,
      showLevel: settings.showLevel,
      gender: settings.gender,
      genderAsked: settings.genderAsked,
      celebratedKhatm: settings.celebratedKhatm,
    },
    bookmarks: settings.bookmarks,
    pauses: settings.pauses,
  };
}

/**
 * The store's data after a merge. Every value was checked by the rules before being merged;
 * it is checked once more here, and a value the store would refuse keeps the current one.
 */
export function fromSyncedValues(current: AppData, values: SyncedValues): AppData {
  const { settings } = values;
  const keep = <Key extends keyof AppSettings>(key: Key, isValid: (value: unknown) => boolean) =>
    (isValid(settings[key]) ? settings[key] : current.settings[key]) as AppSettings[Key];
  const read = readReminders(settings.reminders);
  // The same reminders keep their object, so nothing that shows them renders again for nothing.
  const reminders =
    read === null || JSON.stringify(read) === JSON.stringify(current.settings.reminders)
      ? current.settings.reminders
      : read;
  return {
    journal: values.journal,
    timeSpent: values.timeSpent,
    settings: {
      ...current.settings,
      language: keep('language', SYNC_RULES.settings.language!.isValid),
      dailyGoalPages: keep('dailyGoalPages', isDailyGoalPages),
      goalKind: keep('goalKind', isGoalKind),
      onboardingCompleted: keep('onboardingCompleted', (value) => typeof value === 'boolean'),
      userSeed: keep('userSeed', isUserSeed),
      lastOpenedPage: keep('lastOpenedPage', isLastOpenedPage),
      reminders,
      readerScript: keep('readerScript', isReaderScript),
      readerTextSize: keep('readerTextSize', isReaderTextSize),
      showLevel: keep('showLevel', (value) => typeof value === 'boolean'),
      gender: keep('gender', isStoredGender),
      genderAsked: keep('genderAsked', (value) => typeof value === 'boolean'),
      celebratedKhatm: keep('celebratedKhatm', isCelebratedKhatm),
      bookmarks: isBookmarkList(values.bookmarks) ? values.bookmarks : current.settings.bookmarks,
      pauses: values.pauses,
    },
  };
}

/**
 * A new name for this phone (`DeviceId`): 20 random letters and digits. Not a secret and not a
 * tracker: it only tells this person's phones apart in their own account.
 */
export function drawDeviceId(random: () => number = Math.random): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let index = 0; index < 20; index += 1)
    id += alphabet[Math.floor(random() * alphabet.length)];
  return id;
}
