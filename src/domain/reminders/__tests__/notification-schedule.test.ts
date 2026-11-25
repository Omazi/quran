/**
 * From the plan to the notifications to schedule (docs/specs/reminders.md, "Programmation"):
 * stable identifiers, the iOS limit of pending notifications, where a tap leads, and the
 * difference between what is scheduled and what is wanted. The clock is the fake one of the kit.
 */
import {
  buildNotificationSlots,
  diffNotifications,
  isNotificationTarget,
  isReminderIdentifier,
  notificationSignature,
  notificationTargetOf,
  planReminders,
  REMINDERS_CONFIG,
  type ReminderKind,
} from '../index';
import {
  ALL_REMINDERS_ON,
  at,
  bareEarth,
  DAILY_REMINDER_ONLY,
  day,
  FRIDAY_TIME,
  gardenLastReadDaysAgo,
  planned,
  remindersInput,
  TODAY,
} from '../test-support/reminders-test-kit';

describe('identifiers', () => {
  it('are stable: the same plan always gives the same identifiers', () => {
    const plan = planReminders(remindersInput());
    expect(buildNotificationSlots(plan).map((slot) => slot.id)).toEqual(
      buildNotificationSlots(plan).map((slot) => slot.id),
    );
  });

  it('name the day and the slot, so a reminder keeps its identifier when its kind changes', () => {
    const slots = buildNotificationSlots([
      planned(day(1), at(20, 30), 'daily-goal'),
      planned(day(3), at(9, 0), 'friday-kahf'),
      planned(day(3), at(20, 30), 'thirsty'),
    ]);
    expect(slots.map((slot) => slot.id)).toEqual([
      'reminder.2026-11-25.reading',
      'reminder.2026-11-27.friday',
      'reminder.2026-11-27.reading',
    ]);
  });

  it('are all recognised as ours, and nothing else is', () => {
    const slots = buildNotificationSlots(planReminders(remindersInput()));
    expect(slots.every((slot) => isReminderIdentifier(slot.id))).toBe(true);
    expect(isReminderIdentifier('something-else')).toBe(false);
    expect(isReminderIdentifier('reminders')).toBe(false);
  });

  it('are unique in a full plan', () => {
    const slots = buildNotificationSlots(planReminders(remindersInput()));
    expect(new Set(slots.map((slot) => slot.id)).size).toBe(slots.length);
  });
});

describe('the limit of pending notifications (64 on iOS)', () => {
  it('keeps the whole plan: it holds at most 35 reminders, well under the limit', () => {
    const plan = planReminders(remindersInput({ garden: bareEarth() }));
    expect(plan.length).toBeLessThanOrEqual(35);
    expect(buildNotificationSlots(plan)).toHaveLength(plan.length);
  });

  it('never exceeds the limit, keeping the earliest', () => {
    const many = Array.from({ length: 100 }, (_, offset) =>
      planned(day(offset), at(20, 30), 'daily-goal'),
    );
    const slots = buildNotificationSlots(many);
    expect(slots).toHaveLength(REMINDERS_CONFIG.maxPendingNotifications);
    expect(REMINDERS_CONFIG.maxPendingNotifications).toBeLessThan(64);
    expect(slots[0]?.date).toBe(day(0));
    expect(slots.at(-1)?.date).toBe(day(REMINDERS_CONFIG.maxPendingNotifications - 1));
  });

  it('gives nothing for an empty plan', () => {
    expect(buildNotificationSlots([])).toEqual([]);
  });
});

describe('where a tap leads', () => {
  const resume: ReminderKind[] = [
    'daily-goal',
    'water-stopped',
    'thirsty',
    'wilting',
    'dying',
    'last-chance',
  ];

  it.each(resume)('%s opens the reader where the person left off', (kind) => {
    expect(notificationTargetOf(kind)).toBe('resume');
  });

  it('friday-kahf opens the reader on Al-Kahf', () => {
    expect(notificationTargetOf('friday-kahf')).toBe('al-kahf');
  });

  it.each<ReminderKind>(['dead', 'come-back'])('%s opens the home screen', (kind) => {
    expect(notificationTargetOf(kind)).toBe('home');
  });

  it('is carried by every slot', () => {
    const [slot] = buildNotificationSlots([planned(day(3), FRIDAY_TIME, 'friday-kahf')]);
    expect(slot?.target).toBe('al-kahf');
  });
});

describe('with a fake clock: what is planned when', () => {
  it('a day whose goal is met gets no reminder; tomorrow still does', () => {
    const slots = buildNotificationSlots(
      planReminders(
        remindersInput({
          garden: gardenLastReadDaysAgo(0),
          pagesReadToday: 5,
          settings: DAILY_REMINDER_ONLY,
        }),
      ),
    );
    expect(slots[0]?.date).toBe(day(1));
    expect(slots.some((slot) => slot.date === TODAY)).toBe(false);
  });

  it('reading part of the goal keeps today’s reminder, reading all of it removes it', () => {
    const base = { garden: gardenLastReadDaysAgo(0), settings: DAILY_REMINDER_ONLY };
    const some = buildNotificationSlots(
      planReminders(remindersInput({ ...base, pagesReadToday: 2 })),
    );
    const all = buildNotificationSlots(
      planReminders(remindersInput({ ...base, pagesReadToday: 5 })),
    );
    expect(some[0]?.date).toBe(TODAY);
    expect(all[0]?.date).toBe(day(1));
  });

  it('a reminder whose time has passed is not scheduled in the past', () => {
    const slots = buildNotificationSlots(
      planReminders(
        remindersInput({
          now: { date: TODAY, time: at(21, 0) },
          settings: DAILY_REMINDER_ONLY,
        }),
      ),
    );
    expect(slots[0]?.date).toBe(day(1));
  });

  it('a thirsty day carries one reading slot, not two: the thirst replaces the daily reminder', () => {
    const plan = planReminders(remindersInput({ garden: gardenLastReadDaysAgo(3) }));
    const slots = buildNotificationSlots(plan);
    const readingSlotsByDay = new Map<string, number>();
    for (const slot of slots) {
      if (slot.kind === 'friday-kahf') continue;
      readingSlotsByDay.set(slot.date, (readingSlotsByDay.get(slot.date) ?? 0) + 1);
    }
    expect(Math.max(...readingSlotsByDay.values())).toBe(1);
    expect(slots.find((slot) => slot.date === day(1))?.kind).toBe('thirsty');
  });

  it('every reminder off gives no slot', () => {
    const plan = planReminders(
      remindersInput({
        settings: {
          ...ALL_REMINDERS_ON,
          dailyEnabled: false,
          thirstyGardenEnabled: false,
          fridayKahfEnabled: false,
        },
      }),
    );
    expect(buildNotificationSlots(plan)).toEqual([]);
  });
});

describe('the signature of a notification', () => {
  const [slot] = buildNotificationSlots([planned(day(1), at(20, 30), 'daily-goal')]);

  it('changes with the time, the kind and the language, the things the text and the moment depend on', () => {
    const [later] = buildNotificationSlots([planned(day(1), at(21, 0), 'daily-goal')]);
    const [other] = buildNotificationSlots([planned(day(1), at(20, 30), 'thirsty')]);
    if (!slot || !later || !other) throw new Error('slots expected');
    const base = notificationSignature(slot, 'fr');
    expect(notificationSignature(later, 'fr')).not.toBe(base);
    expect(notificationSignature(other, 'fr')).not.toBe(base);
    expect(notificationSignature(slot, 'en')).not.toBe(base);
    expect(notificationSignature(slot, 'fr')).toBe(base);
  });
});

describe('what to cancel and what to schedule', () => {
  const wanted = [
    { id: 'reminder.2026-11-25.reading', signature: 'a' },
    { id: 'reminder.2026-11-26.reading', signature: 'b' },
  ];

  it('schedules everything when nothing is pending', () => {
    expect(diffNotifications([], wanted)).toEqual({
      cancel: [],
      schedule: ['reminder.2026-11-25.reading', 'reminder.2026-11-26.reading'],
    });
  });

  it('is idempotent: what is already scheduled as wanted is left alone', () => {
    expect(diffNotifications(wanted, wanted)).toEqual({ cancel: [], schedule: [] });
  });

  it('replaces a pending notification whose signature changed', () => {
    const pending = [wanted[0]!, { id: wanted[1]!.id, signature: 'old' }];
    expect(diffNotifications(pending, wanted)).toEqual({
      cancel: ['reminder.2026-11-26.reading'],
      schedule: ['reminder.2026-11-26.reading'],
    });
  });

  it('replaces a pending notification that has no signature', () => {
    const result = diffNotifications([{ id: wanted[0]!.id, signature: null }], [wanted[0]!]);
    expect(result.schedule).toEqual([wanted[0]!.id]);
  });

  it('cancels what is no longer wanted, and only ours', () => {
    const pending = [
      ...wanted,
      { id: 'reminder.2026-11-27.friday', signature: 'c' },
      { id: 'other.thing', signature: 'z' },
    ];
    expect(diffNotifications(pending, wanted)).toEqual({
      cancel: ['reminder.2026-11-27.friday'],
      schedule: [],
    });
  });

  it('cancels everything of ours when nothing is wanted', () => {
    expect(diffNotifications(wanted, [])).toEqual({
      cancel: wanted.map((w) => w.id),
      schedule: [],
    });
  });

  it('cancels a duplicate pending identifier once', () => {
    expect(diffNotifications([wanted[0]!, wanted[0]!], [])).toEqual({
      cancel: [wanted[0]!.id],
      schedule: [],
    });
  });
});

describe('the target read back from a notification', () => {
  it('accepts the three targets and nothing else', () => {
    expect(['resume', 'al-kahf', 'home'].every((value) => isNotificationTarget(value))).toBe(true);
    expect(isNotificationTarget('settings')).toBe(false);
    expect(isNotificationTarget(undefined)).toBe(false);
    expect(isNotificationTarget(3)).toBe(false);
  });
});
