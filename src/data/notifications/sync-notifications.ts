import { diffNotifications, type NotificationRef } from '@/domain/reminders';

import type {
  NotificationLabels,
  NotificationPermissions,
  NotificationScheduler,
  NotificationToSchedule,
} from './types';

export interface NotificationSyncDependencies {
  readonly permissions: NotificationPermissions;
  readonly scheduler: NotificationScheduler;
  /** The present instant. Defaults to the device clock. */
  readonly now?: () => Date;
}

/** What the notifications scheduled should become. */
export interface NotificationSyncRequest {
  /** Every notification wanted; an empty list means none, and cancels the app's. */
  readonly notifications: readonly NotificationToSchedule[];
  readonly labels: NotificationLabels;
}

/**
 * `scheduled`: the system holds the wanted notifications now. `no-permission`: the system does
 * not let the app notify, so none is held. `unknown`: the permission could not be read, nothing
 * was changed.
 */
export type NotificationSyncStatus = 'scheduled' | 'no-permission' | 'unknown';

export interface NotificationSyncResult {
  readonly status: NotificationSyncStatus;
  readonly scheduled: number;
  readonly cancelled: number;
}

export interface NotificationSync {
  /**
   * Makes the system hold the wanted notifications, no more and no fewer, only changing what
   * differs. Calls that overlap are merged: the last request wins, and every caller gets its
   * result. Rejects when the system fails; the next call starts again from what the system holds.
   */
  readonly sync: (request: NotificationSyncRequest) => Promise<NotificationSyncResult>;
}

interface Caller {
  resolve: (result: NotificationSyncResult) => void;
  reject: (error: unknown) => void;
}

function toRef({ id, signature }: NotificationToSchedule): NotificationRef {
  return { id, signature };
}

/**
 * Brings the notifications of the system to the wanted ones. Without the permission nothing is
 * wanted: the reminders the person switched on must not stay scheduled behind a blocked system,
 * and they come back by themselves once it allows them.
 */
export function createNotificationSync({
  permissions,
  scheduler,
  now = () => new Date(),
}: NotificationSyncDependencies): NotificationSync {
  async function run(request: NotificationSyncRequest): Promise<NotificationSyncResult> {
    let isAllowed: boolean;
    try {
      isAllowed = (await permissions.getStatus()) === 'granted';
    } catch {
      return { status: 'unknown', scheduled: 0, cancelled: 0 };
    }

    const instant = now().getTime();
    // A time already reached cannot be scheduled; the plan leaves them out, this is the net.
    const wanted = isAllowed
      ? request.notifications.filter(({ date }) => date.getTime() > instant)
      : [];
    const pending = await scheduler.getPending();
    const { cancel, schedule } = diffNotifications(pending, wanted.map(toRef));

    if (cancel.length > 0) await scheduler.cancel(cancel);
    if (wanted.length > 0 && schedule.length > 0) await scheduler.prepare(request.labels);
    const toSchedule = new Set(schedule);
    for (const notification of wanted) {
      if (toSchedule.has(notification.id)) await scheduler.schedule(notification);
    }
    return {
      status: isAllowed ? 'scheduled' : 'no-permission',
      scheduled: schedule.length,
      cancelled: cancel.length,
    };
  }

  // One run at a time: two runs that interleave could both see "nothing pending" and schedule
  // twice. While one runs, the latest request waits; older waiting ones are dropped.
  let running: Promise<void> | null = null;
  let waiting: { request: NotificationSyncRequest; callers: Caller[] } | null = null;

  async function drain(): Promise<void> {
    while (waiting !== null) {
      const { request, callers } = waiting;
      waiting = null;
      try {
        const result = await run(request);
        callers.forEach((caller) => caller.resolve(result));
      } catch (error) {
        callers.forEach((caller) => caller.reject(error));
      }
    }
    running = null;
  }

  return {
    sync: (request) =>
      new Promise<NotificationSyncResult>((resolve, reject) => {
        const caller = { resolve, reject };
        waiting = { request, callers: [...(waiting?.callers ?? []), caller] };
        running ??= drain();
      }),
  };
}
