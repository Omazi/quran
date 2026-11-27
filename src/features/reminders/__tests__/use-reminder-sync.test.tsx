/**
 * When the reminders are planned again (docs/specs/reminders.md, "Programmation"): setting
 * change, page read, foreground, system answer, new day or time zone. The scheduler is a spy and
 * the clock is the test's.
 */
import { act } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { quranStructure } from '@/data/quran';
import type { NotificationSyncRequest, NotificationSyncResult } from '@/data/notifications';
import { initI18n, setDisplayedLanguage } from '@/i18n';
import { renderWithStore } from '@/features/settings/test-support/render-with-store';
import { buildReadingHistory } from '@/features/home/dev-preview/reading-histories';
import { parseLocalDate } from '@/domain/shared/local-date';

import { useReminderSync } from '../use-reminder-sync';

jest.mock('expo-notifications', () =>
  jest
    .requireActual<typeof import('@/data/notifications/test-support/quiet-expo-notifications')>(
      '@/data/notifications/test-support/quiet-expo-notifications',
    )
    .loadQuietly(),
);

const TODAY = parseLocalDate('2026-11-24');
const RANGES = quranStructure.hizbPageRanges();

let now = new Date(2026, 10, 24, 8, 0);
let timeZone = 'Europe/Paris';
const clock = () => now;
const getTimeZone = () => timeZone;

type Sync = jest.Mock<Promise<NotificationSyncResult>, [NotificationSyncRequest]>;
let sync: Sync;
let permissionListeners: (() => void)[];
const subscribeToPermission = (listener: () => void) => {
  permissionListeners.push(listener);
  return () => {
    permissionListeners = permissionListeners.filter((other) => other !== listener);
  };
};

let appStateListener: (state: string) => void = () => {};

function Probe() {
  useReminderSync({ sync, clock, getTimeZone, subscribeToPermission });
  return null;
}

const finished = { onboardingCompleted: true };
function lastRequest(): NotificationSyncRequest {
  const call = sync.mock.calls.at(-1);
  if (!call) throw new Error('no sync yet');
  return call[0];
}
const ids = () => lastRequest().notifications.map((notification) => notification.id);

beforeEach(() => {
  jest.useFakeTimers();
  now = new Date(2026, 10, 24, 8, 0);
  timeZone = 'Europe/Paris';
  sync = jest.fn(async (_request: NotificationSyncRequest) => ({
    status: 'scheduled' as const,
    scheduled: 0,
    cancelled: 0,
  }));
  permissionListeners = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appStateListener = listener as (state: string) => void;
    return { remove: jest.fn() };
  });
  initI18n('fr');
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('what starts the planning', () => {
  it('plans nothing until the introduction is finished', async () => {
    await renderWithStore(<Probe />, { settings: { onboardingCompleted: false } });
    expect(sync).not.toHaveBeenCalled();
  });

  it('plans once the introduction is finished, with the texts of the language', async () => {
    await renderWithStore(<Probe />, { settings: finished });
    expect(sync).toHaveBeenCalledTimes(1);
    expect(lastRequest().labels.channelName).toBe('Rappels');
    expect(lastRequest().notifications[0]?.title).toBe('Chaque lettre lue, dix hasanat');
  });

  it('plans again, with nothing, when the person switches every reminder off', async () => {
    const store = await renderWithStore(<Probe />, { settings: finished });
    expect(ids().length).toBeGreaterThan(0);
    await act(async () => {
      store.getState().updateReminders({
        dailyEnabled: false,
        thirstyGardenEnabled: false,
        fridayKahfEnabled: false,
      });
    });
    expect(ids()).toEqual([]);
  });

  it('plans again at the new time when the person moves the reminder', async () => {
    const store = await renderWithStore(<Probe />, { settings: finished });
    await act(async () => {
      store.getState().updateReminders({ dailyTime: { hour: 21, minute: 15 } });
    });
    const first = lastRequest().notifications[0];
    expect([first?.date.getHours(), first?.date.getMinutes()]).toEqual([21, 15]);
    expect(first?.signature).toContain('21:15');
  });

  it('plans the Friday reminder from the first launch, and drops it when it is switched off', async () => {
    const store = await renderWithStore(<Probe />, { settings: finished });
    expect(ids().some((id) => id.endsWith('.friday'))).toBe(true);
    await act(async () => {
      store.getState().updateReminders({ fridayKahfEnabled: false });
    });
    expect(ids().some((id) => id.endsWith('.friday'))).toBe(false);
  });

  it('takes today out once the page that meets the goal is read', async () => {
    const { journal } = buildReadingHistory('thriving', TODAY, RANGES);
    const store = await renderWithStore(<Probe />, {
      settings: { ...finished, dailyGoalPages: 5 },
      journal,
    });
    expect(ids()).toContain('reminder.2026-11-24.reading');
    const lastPage = Math.max(...journal.map((entry) => entry.page));
    await act(async () => {
      store.getState().recordPageRead({ page: lastPage + 1, date: TODAY });
      store.getState().recordPageRead({ page: lastPage + 2, date: TODAY });
    });
    expect(ids()).not.toContain('reminder.2026-11-24.reading');
    expect(ids()).toContain('reminder.2026-11-25.reading');
  });

  it('plans again with the new place to resume when the reader moves to another page', async () => {
    const store = await renderWithStore(<Probe />, { settings: finished });
    expect(lastRequest().notifications[0]?.body).toContain('Commence à la première page.');
    await act(async () => {
      store.getState().setLastOpenedPage(40);
    });
    expect(lastRequest().notifications[0]?.body).toContain('Reprends Al-Baqarah, page 40.');
  });

  it('plans again with the texts of the new language', async () => {
    const store = await renderWithStore(<Probe />, { settings: finished });
    await act(async () => {
      store.getState().setLanguage('en');
      setDisplayedLanguage('en');
    });
    expect(lastRequest().notifications[0]?.title).toBe('Every letter read: ten hasanat');
  });

  it('plans again when the person says what they are: the Arabic texts agree with them', async () => {
    const store = await renderWithStore(<Probe />, { settings: finished });
    const before = sync.mock.calls.length;
    await act(async () => {
      store.getState().setGender('female');
    });
    expect(sync.mock.calls.length).toBe(before + 1);
    // Nothing the French says to the person depends on gender: the words are the same.
    expect(lastRequest().notifications[0]?.title).toBe('Chaque lettre lue, dix hasanat');
    // The same answer again plans nothing more.
    await act(async () => {
      store.getState().setGender('female');
    });
    expect(sync.mock.calls.length).toBe(before + 1);
  });

  it('plans again when the app comes back to the foreground, not when it leaves', async () => {
    await renderWithStore(<Probe />, { settings: finished });
    await act(async () => appStateListener('background'));
    expect(sync).toHaveBeenCalledTimes(1);
    now = new Date(2026, 10, 24, 20, 31);
    await act(async () => appStateListener('active'));
    expect(sync).toHaveBeenCalledTimes(2);
    // 20:30 has passed: today's reminder is no longer asked for.
    expect(ids()).not.toContain('reminder.2026-11-24.reading');
  });

  it('plans again when the person answers the system alert', async () => {
    await renderWithStore(<Probe />, { settings: finished });
    await act(async () => permissionListeners.forEach((listener) => listener()));
    expect(sync).toHaveBeenCalledTimes(2);
  });

  it('plans again when the day changes while the app is open', async () => {
    await renderWithStore(<Probe />, { settings: finished });
    now = new Date(2026, 10, 25, 0, 1);
    await act(async () => jest.advanceTimersByTime(60_000));
    expect(sync).toHaveBeenCalledTimes(2);
    expect(ids()[0]).toBe('reminder.2026-11-25.reading');
  });

  it('plans again when the time zone changes while the app is open', async () => {
    await renderWithStore(<Probe />, { settings: finished });
    await act(async () => jest.advanceTimersByTime(60_000));
    expect(sync).toHaveBeenCalledTimes(1);
    timeZone = 'America/Toronto';
    await act(async () => jest.advanceTimersByTime(60_000));
    expect(sync).toHaveBeenCalledTimes(2);
  });
});

describe('when the plan cannot be made or scheduled', () => {
  it('leaves the reminders as they are when the journal is damaged', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const badJournal = [{ khatm: 1, page: 9999, date: TODAY }] as never;
    await renderWithStore(<Probe />, { settings: finished, journal: badJournal });
    expect(sync).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it('logs a system failure and keeps working', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    sync.mockRejectedValueOnce(new Error('boom'));
    const store = await renderWithStore(<Probe />, { settings: finished });
    await act(async () => {});
    expect(warn).toHaveBeenCalled();
    await act(async () => {
      store.getState().updateReminders({ fridayKahfEnabled: false });
    });
    expect(sync).toHaveBeenCalledTimes(2);
  });
});
