import { createInertNotificationPermissions } from '../inert-notification-permissions';
import { createInertNotificationScheduler } from '../inert-notification-scheduler';
import { createNotificationSync } from '../sync-notifications';
import type { NotificationLabels, NotificationToSchedule } from '../types';

const LABELS: NotificationLabels = { channelName: 'Rappels', hiddenPreview: 'Un rappel' };
const NOW = new Date(2026, 10, 24, 8, 0);

function notification(
  id: string,
  overrides: Partial<NotificationToSchedule> = {},
): NotificationToSchedule {
  return {
    id,
    date: new Date(2026, 10, 24, 20, 30),
    title: 'Ton jardin t’attend',
    body: 'Quelques pages, et l’eau continue de couler.',
    target: 'resume',
    signature: 'daily-goal@20:30@fr',
    ...overrides,
  };
}

const TODAY = notification('reminder.2026-11-24.reading');
const TOMORROW = notification('reminder.2026-11-25.reading', {
  date: new Date(2026, 10, 25, 20, 30),
});

function setup(status: 'granted' | 'denied' | 'undetermined' = 'granted') {
  const scheduler = createInertNotificationScheduler();
  const permissions = createInertNotificationPermissions({ status });
  const { sync } = createNotificationSync({ permissions, scheduler, now: () => NOW });
  return { scheduler, sync };
}

describe('scheduling the reminders', () => {
  it('schedules what is wanted, with its target and its signature', async () => {
    const { scheduler, sync } = setup();
    const result = await sync({ notifications: [TODAY, TOMORROW], labels: LABELS });
    expect(result).toEqual({ status: 'scheduled', scheduled: 2, cancelled: 0 });
    expect([...scheduler.scheduled.keys()]).toEqual([TODAY.id, TOMORROW.id]);
    expect(scheduler.scheduled.get(TODAY.id)?.target).toBe('resume');
    expect(scheduler.labels).toEqual(LABELS);
  });

  it('is idempotent: the same request twice changes nothing the second time', async () => {
    const { scheduler, sync } = setup();
    await sync({ notifications: [TODAY, TOMORROW], labels: LABELS });
    const callsAfterFirst = scheduler.calls.length;
    const result = await sync({ notifications: [TODAY, TOMORROW], labels: LABELS });
    expect(result).toEqual({ status: 'scheduled', scheduled: 0, cancelled: 0 });
    expect(scheduler.calls).toHaveLength(callsAfterFirst);
  });

  it('drops a reminder that is no longer wanted (the goal was met) and keeps the others', async () => {
    const { scheduler, sync } = setup();
    await sync({ notifications: [TODAY, TOMORROW], labels: LABELS });
    const result = await sync({ notifications: [TOMORROW], labels: LABELS });
    expect(result).toEqual({ status: 'scheduled', scheduled: 0, cancelled: 1 });
    expect([...scheduler.scheduled.keys()]).toEqual([TOMORROW.id]);
  });

  it('replaces a reminder whose time or language changed, under the same identifier', async () => {
    const { scheduler, sync } = setup();
    await sync({ notifications: [TODAY], labels: LABELS });
    const moved = notification(TODAY.id, {
      date: new Date(2026, 10, 24, 21, 0),
      signature: 'daily-goal@21:00@fr',
    });
    const result = await sync({ notifications: [moved], labels: LABELS });
    expect(result).toEqual({ status: 'scheduled', scheduled: 1, cancelled: 1 });
    expect(scheduler.scheduled.get(TODAY.id)?.date).toEqual(moved.date);
    expect(scheduler.scheduled.size).toBe(1);
  });

  it('cancels all of its own when nothing is wanted (every reminder switched off)', async () => {
    const { scheduler, sync } = setup();
    await sync({ notifications: [TODAY, TOMORROW], labels: LABELS });
    const result = await sync({ notifications: [], labels: LABELS });
    expect(result).toEqual({ status: 'scheduled', scheduled: 0, cancelled: 2 });
    expect(scheduler.scheduled.size).toBe(0);
  });

  it('never touches a notification that is not one of its own', async () => {
    const scheduler = createInertNotificationScheduler([{ id: 'other.thing', signature: null }]);
    const { sync } = createNotificationSync({
      permissions: createInertNotificationPermissions({ status: 'granted' }),
      scheduler,
      now: () => NOW,
    });
    await sync({ notifications: [], labels: LABELS });
    expect(scheduler.calls).toEqual([]);
  });

  it('leaves out a moment that is already over', async () => {
    const { scheduler, sync } = setup();
    const past = notification('reminder.2026-11-24.friday', { date: new Date(2026, 10, 24, 7, 0) });
    const result = await sync({ notifications: [past, TODAY], labels: LABELS });
    expect(result.scheduled).toBe(1);
    expect([...scheduler.scheduled.keys()]).toEqual([TODAY.id]);
  });
});

describe('without the permission', () => {
  it.each(['denied', 'undetermined'] as const)('%s: schedules nothing', async (status) => {
    const { scheduler, sync } = setup(status);
    const result = await sync({ notifications: [TODAY], labels: LABELS });
    expect(result).toEqual({ status: 'no-permission', scheduled: 0, cancelled: 0 });
    expect(scheduler.scheduled.size).toBe(0);
  });

  it('cancels what was scheduled when the person withdraws the permission', async () => {
    const scheduler = createInertNotificationScheduler();
    let status: 'granted' | 'denied' = 'granted';
    const { sync } = createNotificationSync({
      permissions: { getStatus: async () => status, request: async () => status },
      scheduler,
      now: () => NOW,
    });
    await sync({ notifications: [TODAY, TOMORROW], labels: LABELS });
    status = 'denied';
    const result = await sync({ notifications: [TODAY, TOMORROW], labels: LABELS });
    expect(result).toEqual({ status: 'no-permission', scheduled: 0, cancelled: 2 });
    expect(scheduler.scheduled.size).toBe(0);
  });

  it('changes nothing when the permission cannot be read', async () => {
    const scheduler = createInertNotificationScheduler();
    const { sync } = createNotificationSync({
      permissions: {
        getStatus: async () => {
          throw new Error('no system');
        },
        request: async () => 'denied',
      },
      scheduler,
      now: () => NOW,
    });
    expect(await sync({ notifications: [TODAY], labels: LABELS })).toEqual({
      status: 'unknown',
      scheduled: 0,
      cancelled: 0,
    });
    expect(scheduler.calls).toEqual([]);
  });
});

describe('requests that overlap', () => {
  it('are merged: the last one wins and nothing is scheduled twice', async () => {
    const { scheduler, sync } = setup();
    const results = await Promise.all([
      sync({ notifications: [TODAY], labels: LABELS }),
      sync({ notifications: [TODAY, TOMORROW], labels: LABELS }),
      sync({ notifications: [TOMORROW], labels: LABELS }),
    ]);
    expect([...scheduler.scheduled.keys()]).toEqual([TOMORROW.id]);
    expect(scheduler.calls.filter((call) => call === `schedule:${TOMORROW.id}`)).toHaveLength(1);
    expect(results).toHaveLength(3);
  });

  it('reject every waiting caller when the system fails, and recover on the next call', async () => {
    const scheduler = createInertNotificationScheduler();
    const failing = {
      ...scheduler,
      getPending: jest
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockImplementation(scheduler.getPending),
    };
    const { sync } = createNotificationSync({
      permissions: createInertNotificationPermissions({ status: 'granted' }),
      scheduler: failing,
      now: () => NOW,
    });
    await expect(sync({ notifications: [TODAY], labels: LABELS })).rejects.toThrow('boom');
    await expect(sync({ notifications: [TODAY], labels: LABELS })).resolves.toMatchObject({
      status: 'scheduled',
    });
  });
});
