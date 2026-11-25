import { parseLocalDate } from '@/domain/shared/local-date';
import {
  buildNotificationSlots,
  notificationSignature,
  planReminders,
  type NotificationSlot,
  type RemindersInput,
} from '@/domain/reminders';
import type { NotificationLabels, NotificationToSchedule } from '@/data/notifications';
import { getTranslator, type AppLanguage } from '@/i18n';

/** The moment of a slot on the clock of the phone, as an absolute date. */
export function slotMoment({ date, time }: Pick<NotificationSlot, 'date' | 'time'>): Date {
  const [year, month, day] = parseLocalDate(date).split('-').map(Number);
  // `month` is 1-based in a LocalDate, 0-based in a Date. A moment skipped by a change of
  // summer time is moved by the system to the next valid one.
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, time.hour, time.minute);
}

/** The text of a notification, in a language. French is the fallback of a missing key. */
function textOf(slot: NotificationSlot, language: AppLanguage) {
  const t = getTranslator(language, 'notifications');
  return {
    title: t(`kinds.${slot.kind}.title`),
    body: t(`kinds.${slot.kind}.body`),
  };
}

export function notificationLabels(language: AppLanguage): NotificationLabels {
  const t = getTranslator(language, 'notifications');
  return { channelName: t('channel'), hiddenPreview: t('hiddenPreview') };
}

/**
 * The notifications to schedule for an input: the plan of the reminders module, placed on the
 * clock of the phone and written in the language of the app.
 */
export function buildWantedNotifications(
  input: RemindersInput,
  language: AppLanguage,
): readonly NotificationToSchedule[] {
  return buildNotificationSlots(planReminders(input)).map((slot) => ({
    id: slot.id,
    date: slotMoment(slot),
    ...textOf(slot, language),
    target: slot.target,
    signature: notificationSignature(slot, language),
  }));
}
