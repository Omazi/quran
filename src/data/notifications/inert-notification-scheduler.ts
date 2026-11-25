import type {
  NotificationLabels,
  NotificationScheduler,
  NotificationToSchedule,
  PendingNotification,
} from './types';

/** What an inert scheduler holds and was asked, for tests to read. */
export interface InertNotificationScheduler extends NotificationScheduler {
  /** The notifications currently scheduled, by identifier. */
  readonly scheduled: ReadonlyMap<string, NotificationToSchedule>;
  /** Every call, in order, as `schedule:<id>` or `cancel:<id>`. */
  readonly calls: readonly string[];
  /** The labels of the last `prepare`, or null before it. */
  readonly labels: NotificationLabels | null;
}

/**
 * A scheduler that reaches no system: for the web, where the app sends no notification, and for
 * tests, which read what was scheduled. `others` are notifications the app did not schedule.
 */
export function createInertNotificationScheduler(
  others: readonly PendingNotification[] = [],
): InertNotificationScheduler {
  const scheduled = new Map<string, NotificationToSchedule>();
  const calls: string[] = [];
  let labels: NotificationLabels | null = null;
  return {
    scheduled,
    calls,
    get labels() {
      return labels;
    },
    prepare: async (next) => {
      labels = next;
    },
    getPending: async () => [
      ...others,
      ...[...scheduled.values()].map(({ id, signature }) => ({ id, signature })),
    ],
    schedule: async (notification) => {
      calls.push(`schedule:${notification.id}`);
      scheduled.set(notification.id, notification);
    },
    cancel: async (ids) => {
      for (const id of ids) {
        calls.push(`cancel:${id}`);
        scheduled.delete(id);
      }
    },
  };
}
