/**
 * From the plan to what the data layer schedules: stable identifiers, the limit of pending
 * notifications, where a tap leads, and the difference between what is scheduled and what is
 * wanted. Pure, like the rest of the module: it knows no notification system.
 */
import type { LocalDate } from '@/domain/shared/local-date';

import { REMINDERS_CONFIG } from './config';
import type { Reminder, ReminderKind, ReminderPlan, TimeOfDay } from './types';

/**
 * Where a tap on a notification leads. `resume`: the reader, on the page the person left off.
 * `al-kahf`: the reader, on Al-Kahf. `home`: the home screen, where a dead garden is revived.
 */
export type NotificationTarget = 'resume' | 'al-kahf' | 'home';

const NOTIFICATION_TARGETS: readonly NotificationTarget[] = ['resume', 'al-kahf', 'home'];

/** One notification to schedule: a reminder of the plan with its identifier and its target. */
export interface NotificationSlot {
  /** Stable: the same day and the same slot always give the same identifier. */
  readonly id: string;
  readonly date: LocalDate;
  readonly time: TimeOfDay;
  readonly kind: ReminderKind;
  readonly target: NotificationTarget;
}

/** What is scheduled, or wanted, as far as the difference is concerned. */
export interface NotificationRef {
  readonly id: string;
  /** What the notification was built from (see `notificationSignature`); null when unknown. */
  readonly signature: string | null;
}

export interface NotificationDiff {
  /** Identifiers to cancel: no longer wanted, or wanted with another signature. Each once. */
  readonly cancel: readonly string[];
  /** Identifiers to schedule: not pending yet, or just cancelled to be replaced. */
  readonly schedule: readonly string[];
}

const IDENTIFIER_PREFIX = 'reminder.';

/**
 * Where the garden reminders send the person. A dead garden is revived from the home screen,
 * which says what happened; every other reminder asks for a page, so it opens the reader.
 */
const TARGET_OF_KIND: Readonly<Record<ReminderKind, NotificationTarget>> = Object.freeze({
  'daily-goal': 'resume',
  'water-stopped': 'resume',
  thirsty: 'resume',
  wilting: 'resume',
  dying: 'resume',
  'last-chance': 'resume',
  dead: 'home',
  'come-back': 'home',
  'friday-kahf': 'al-kahf',
});

/** Whether a value read back from a notification is one of the targets. */
export function isNotificationTarget(value: unknown): value is NotificationTarget {
  return typeof value === 'string' && (NOTIFICATION_TARGETS as readonly string[]).includes(value);
}

export function notificationTargetOf(kind: ReminderKind): NotificationTarget {
  return TARGET_OF_KIND[kind];
}

/** A day holds one reading reminder and one Friday reminder: the slot tells them apart. */
function identifierOf(reminder: Reminder): string {
  const slot = reminder.kind === 'friday-kahf' ? 'friday' : 'reading';
  return `${IDENTIFIER_PREFIX}${reminder.date}.${slot}`;
}

/** Whether a scheduled notification is one of the reminders (and not something else). */
export function isReminderIdentifier(identifier: string): boolean {
  return identifier.startsWith(IDENTIFIER_PREFIX);
}

/**
 * The notifications to schedule for a plan: the earliest ones, at most
 * `REMINDERS_CONFIG.maxPendingNotifications`, each with its stable identifier. The identifier
 * names the day and the slot, not the kind: a day whose reminder changes keeps its identifier,
 * so scheduling again replaces it instead of adding a second one.
 */
export function buildNotificationSlots(plan: ReminderPlan): readonly NotificationSlot[] {
  return plan.slice(0, REMINDERS_CONFIG.maxPendingNotifications).map((reminder) => ({
    id: identifierOf(reminder),
    date: reminder.date,
    time: reminder.time,
    kind: reminder.kind,
    target: notificationTargetOf(reminder.kind),
  }));
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * What a scheduled notification was built from: its kind, its time and the language of its
 * text. A pending notification with another signature is out of date and gets replaced.
 */
export function notificationSignature(slot: NotificationSlot, language: string): string {
  return `${slot.kind}@${twoDigits(slot.time.hour)}:${twoDigits(slot.time.minute)}@${language}`;
}

/**
 * What to cancel and what to schedule so that the pending notifications become the wanted ones.
 * Idempotent: with nothing out of date, both lists are empty. Notifications that are not ours
 * are never cancelled.
 */
export function diffNotifications(
  pending: readonly NotificationRef[],
  wanted: readonly NotificationRef[],
): NotificationDiff {
  const wantedById = new Map(wanted.map((ref) => [ref.id, ref]));
  const pendingById = new Map<string, NotificationRef>();
  const cancel = new Set<string>();

  for (const ref of pending) {
    if (!isReminderIdentifier(ref.id)) continue;
    const target = wantedById.get(ref.id);
    const isCurrent =
      target !== undefined && target.signature === ref.signature && ref.signature !== null;
    if (isCurrent) pendingById.set(ref.id, ref);
    else cancel.add(ref.id);
  }

  const schedule = wanted.filter((ref) => !pendingById.has(ref.id)).map((ref) => ref.id);
  return { cancel: [...cancel], schedule };
}
