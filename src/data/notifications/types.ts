import type { NotificationTarget } from '@/domain/reminders';

/**
 * Whether the system lets the app show notifications.
 * `undetermined`: the person has not been asked yet, so asking shows the system's alert.
 * `denied`: asking again shows nothing; only the system's settings can change it.
 */
export type NotificationPermissionStatus = 'granted' | 'denied' | 'undetermined';

/**
 * The permission to notify, as the app needs it: reading its state and asking for it. Reminders
 * are local notifications; scheduling them is not part of this interface yet.
 */
export interface NotificationPermissions {
  /** The current state. It has no effect the person can see. */
  getStatus: () => Promise<NotificationPermissionStatus>;
  /**
   * Asks the person, with the system's own alert, the first time; afterwards it only reports
   * their answer. Call it right after the screen that says why (privacy.md › Requesting
   * permission).
   */
  request: () => Promise<NotificationPermissionStatus>;
}

/** A notification to schedule, as the data layer receives it: text already in the person's language. */
export interface NotificationToSchedule {
  /** Stable (see the reminders module): scheduling it again replaces it. */
  readonly id: string;
  /** The moment it is delivered. */
  readonly date: Date;
  readonly title: string;
  readonly body: string;
  /** Where a tap leads. Travels with the notification, so a tap works after a restart. */
  readonly target: NotificationTarget;
  /** What it was built from; a pending notification with another one is replaced. */
  readonly signature: string;
}

/** A notification the system holds, as far as the difference with the wanted ones is concerned. */
export interface PendingNotification {
  readonly id: string;
  /** Null for a notification that carries none. */
  readonly signature: string | null;
}

/** Words the system shows about the app's notifications, in the person's language. */
export interface NotificationLabels {
  /** Android: the name of the channel in the system settings. */
  readonly channelName: string;
  /** iOS: what the lock screen shows instead of the Friday reminder when previews are hidden. */
  readonly hiddenPreview: string;
}

/**
 * The notifications the system holds for the app, as the app needs them. Local notifications
 * only: nothing is sent to or received from a server.
 */
export interface NotificationScheduler {
  /** Makes the system ready to show them (the channel on Android, the hidden-preview text). */
  prepare: (labels: NotificationLabels) => Promise<void>;
  /** Every notification scheduled, whoever scheduled it. */
  getPending: () => Promise<readonly PendingNotification[]>;
  /** Schedules one; one with the same identifier is replaced. */
  schedule: (notification: NotificationToSchedule) => Promise<void>;
  /** Cancels these; an identifier that is not scheduled is ignored. */
  cancel: (ids: readonly string[]) => Promise<void>;
}

/** A tap on a notification of the app, or on the one that opened it. */
export interface NotificationTap {
  /** Identifies the tapped notification, so that a tap reported twice is handled once. */
  readonly key: string;
  readonly target: NotificationTarget;
}

/** Calls `onTap` for every tap on a notification, and returns how to stop. */
export type SubscribeToNotificationTaps = (onTap: (tap: NotificationTap) => void) => () => void;
