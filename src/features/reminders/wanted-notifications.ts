import type { Gender } from '@/domain/shared/gender';
import { parseLocalDate } from '@/domain/shared/local-date';
import {
  buildNotificationSlots,
  notificationSignature,
  planReminders,
  readingGoalOn,
  type NotificationSlot,
  type RemindersInput,
} from '@/domain/reminders';
import type { NotificationLabels, NotificationToSchedule } from '@/data/notifications';
import { getTranslator, type AppLanguage } from '@/i18n';

import { reminderText, type ReminderResume } from './reminder-copy';

/** The moment of a slot on the clock of the phone, as an absolute date. */
export function slotMoment({ date, time }: Pick<NotificationSlot, 'date' | 'time'>): Date {
  const [year, month, day] = parseLocalDate(date).split('-').map(Number);
  // `month` is 1-based in a LocalDate, 0-based in a Date. A moment skipped by a change of
  // summer time is moved by the system to the next valid one.
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, time.hour, time.minute);
}

/**
 * A short fingerprint of a text (FNV-1a, 32 bits). It only has to change when the words change, so
 * that a notification whose words are out of date (a new page to resume, a new goal) is replaced.
 */
function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function notificationLabels(language: AppLanguage): NotificationLabels {
  const t = getTranslator(language, 'notifications');
  return { channelName: t('channel'), hiddenPreview: t('hiddenPreview') };
}

/**
 * The notifications to schedule for an input: the plan of the reminders module, placed on the
 * clock of the phone and written in the language of the app, each day with its own variant, the
 * place to resume (`buildReminderResume`), what is left of that day's goal and, in Arabic, what
 * the person says they are
 * (docs/specs/reminders-copy.md). The signature carries a fingerprint of the words, so changing
 * them replaces the notification.
 */
export function buildWantedNotifications(
  input: RemindersInput,
  language: AppLanguage,
  resume: ReminderResume | null,
  gender: Gender | null = null,
): readonly NotificationToSchedule[] {
  return buildNotificationSlots(planReminders(input)).map((slot: NotificationSlot) => {
    const { title, body } = reminderText(slot.kind, slot.date, language, {
      resume,
      goal: readingGoalOn(input, slot.date),
      gender,
    });
    return {
      id: slot.id,
      date: slotMoment(slot),
      title,
      body,
      target: slot.target,
      signature: `${notificationSignature(slot, language)}#${fingerprint(`${title}\n${body}`)}`,
    };
  });
}
