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
