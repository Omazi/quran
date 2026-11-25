import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { quranStructure } from '@/data/quran';
import {
  createNotificationSync,
  deviceNotificationPermissions,
  deviceNotificationScheduler,
  subscribeToPermissionChanges,
  type NotificationSync,
} from '@/data/notifications';
import { parseLocalDate } from '@/domain/shared/local-date';
import type { LocalMoment } from '@/domain/reminders';
import { getDisplayedLanguage } from '@/i18n';
import { useAppStore } from '@/store';

import { CLOCK_CHECK_INTERVAL_MS } from './config';
import { buildReminderInput } from './reminder-input';
import { buildWantedNotifications, notificationLabels } from './wanted-notifications';

/** Gives the present instant. Injected so that tests choose the time. */
export type Clock = () => Date;

export interface ReminderSyncDependencies {
  /** Schedules the notifications. Defaults to the phone's. */
  readonly sync?: NotificationSync['sync'];
  /** Defaults to the device clock. */
  readonly clock?: Clock;
  /** The time zone of the phone. Defaults to the one the system reports. */
  readonly getTimeZone?: () => string;
  /** Tells when the person answered the system's alert. Defaults to the phone's. */
  readonly subscribeToPermission?: typeof subscribeToPermissionChanges;
}

const systemClock: Clock = () => new Date();
const systemTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

let deviceSync: NotificationSync | null = null;
/** One scheduler for the whole app, so that two screens can never schedule at once. */
function getDeviceSync(): NotificationSync['sync'] {
  deviceSync ??= createNotificationSync({
    permissions: deviceNotificationPermissions,
    scheduler: deviceNotificationScheduler,
  });
  return deviceSync.sync;
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

/** An instant as the phone's clock shows it: the day and the time of day, to the minute. */
export function momentOf(instant: Date): LocalMoment {
  const date = parseLocalDate(
    `${instant.getFullYear()}-${twoDigits(instant.getMonth() + 1)}-${twoDigits(instant.getDate())}`,
  );
  return { date, time: { hour: instant.getHours(), minute: instant.getMinutes() } };
}

/**
 * Keeps the reminders scheduled on the phone equal to the plan of the reminders module (decision
 * D13). It plans again, and only changes what differs, when:
 * - a setting changes (the reminders, the goal, the pauses, the language);
 * - a page is read (the day's reminder goes away once the goal is met, the garden's move back);
 * - the app comes back to the foreground;
 * - the person answers the system's alert;
 * - the day or the time zone changes while the app is open.
 * Nothing is scheduled before the introduction is finished, and without the permission nothing
 * stays scheduled.
 */
export function useReminderSync({
  sync = getDeviceSync(),
  clock = systemClock,
  getTimeZone = systemTimeZone,
  subscribeToPermission = subscribeToPermissionChanges,
}: ReminderSyncDependencies = {}): void {
  const isIntroductionFinished = useAppStore((state) => state.settings.onboardingCompleted);
  const reminders = useAppStore((state) => state.settings.reminders);
  const dailyGoalPages = useAppStore((state) => state.settings.dailyGoalPages);
  const userSeed = useAppStore((state) => state.settings.userSeed);
  const pauses = useAppStore((state) => state.settings.pauses);
  const journal = useAppStore((state) => state.journal);
  const savedLanguage = useAppStore((state) => state.settings.language);
  const hizbPageRanges = useMemo(() => quranStructure.hizbPageRanges(), []);
  // Bumped by what the store does not tell: the foreground, the system's answer, a new day.
  const [wakeUps, setWakeUps] = useState(0);

  useEffect(() => {
    const wakeUp = () => setWakeUps((count) => count + 1);
    const whereAndWhen = () => `${momentOf(clock()).date}|${getTimeZone()}`;
    let known = whereAndWhen();
    const timer = setInterval(() => {
      const now = whereAndWhen();
      if (now === known) return;
      known = now;
      wakeUp();
    }, CLOCK_CHECK_INTERVAL_MS);
    const appState = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      known = whereAndWhen();
      wakeUp();
    });
    const stopListening = subscribeToPermission(wakeUp);
    return () => {
      clearInterval(timer);
      appState.remove();
      stopListening();
    };
  }, [clock, getTimeZone, subscribeToPermission]);

  useEffect(() => {
    if (!isIntroductionFinished) return;
    // The language shown, not the saved choice: "follow the phone" has no language of its own.
    const language = getDisplayedLanguage();
    let notifications;
    try {
      const input = buildReminderInput(
        { journal, dailyGoalPages, userSeed, pauses, reminders },
        momentOf(clock()),
        hizbPageRanges,
      );
      notifications = buildWantedNotifications(input, language);
    } catch (error) {
      // A journal that cannot be read must not wipe the reminders the person already has.
      console.warn('The reminders could not be planned.', error);
      return;
    }
    sync({ notifications, labels: notificationLabels(language) }).catch((error: unknown) => {
      console.warn('The reminders could not be scheduled.', error);
    });
    // `savedLanguage` is not read: a new language is what asks for new texts.
    // `wakeUps` is not read either: a wake-up is what asks for a new plan.
  }, [
    isIntroductionFinished,
    reminders,
    dailyGoalPages,
    userSeed,
    pauses,
    journal,
    savedLanguage,
    wakeUps,
    clock,
    sync,
    hizbPageRanges,
  ]);
}
