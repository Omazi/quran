import {
  addNotificationResponseReceivedListener,
  clearLastNotificationResponse,
  DEFAULT_ACTION_IDENTIFIER,
  getLastNotificationResponseAsync,
  cancelScheduledNotificationAsync,
  getAllScheduledNotificationsAsync,
  scheduleNotificationAsync,
  setNotificationCategoryAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
  type NotificationResponse,
} from 'expo-notifications';

import { announcePermissionChange } from '../permission-changes';
import { expoNotificationPermissions } from '../expo-notification-permissions';
import {
  expoNotificationScheduler,
  FRIDAY_CATEGORY_ID,
  READING_CATEGORY_ID,
  REMINDERS_CHANNEL_ID,
} from '../expo-notification-scheduler';
import { subscribeToExpoNotificationTaps, tapOf } from '../expo-notification-taps';
import { subscribeToPermissionChanges } from '..';

jest.mock('expo-notifications', () => ({
  ...jest
    .requireActual<typeof import('../test-support/quiet-expo-notifications')>(
      '../test-support/quiet-expo-notifications',
    )
    .loadQuietly(),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
  getAllScheduledNotificationsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  setNotificationCategoryAsync: jest.fn(async () => ({})),
  setNotificationHandler: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  getLastNotificationResponseAsync: jest.fn(),
  clearLastNotificationResponse: jest.fn(),
  requestPermissionsAsync: jest.fn(),
}));

const DATE = new Date(2026, 10, 27, 9, 0);

beforeEach(() => jest.clearAllMocks());

describe('the scheduler of the phone', () => {
  it('schedules a local notification at an absolute date, under its stable identifier', async () => {
    await expoNotificationScheduler.schedule({
      id: 'reminder.2026-11-27.reading',
      date: DATE,
      title: 'Ton jardin a soif',
      body: 'Ses plantes attendent un peu d’eau.',
      target: 'resume',
      signature: 'thirsty@09:00@fr',
    });
    expect(scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: 'reminder.2026-11-27.reading',
      content: {
        title: 'Ton jardin a soif',
        body: 'Ses plantes attendent un peu d’eau.',
        data: { target: 'resume', signature: 'thirsty@09:00@fr' },
        interruptionLevel: 'active',
        categoryIdentifier: READING_CATEGORY_ID,
      },
      trigger: { type: 'date', date: DATE, channelId: REMINDERS_CHANNEL_ID },
    });
  });

  it('gives the Friday reminder its hidden-preview category', async () => {
    await expoNotificationScheduler.schedule({
      id: 'reminder.2026-11-27.friday',
      date: DATE,
      title: 'C’est vendredi',
      body: 'Un moment pour la sourate Al-Kahf ?',
      target: 'al-kahf',
      signature: 'friday-kahf@09:00@fr',
    });
    const request = jest.mocked(scheduleNotificationAsync).mock.calls[0]?.[0];
    expect(request?.content.categoryIdentifier).toBe(FRIDAY_CATEGORY_ID);
  });

  it('reads the signature of what is pending, null when there is none', async () => {
    jest.mocked(getAllScheduledNotificationsAsync).mockResolvedValue([
      { identifier: 'a', content: { data: { signature: 's' } }, trigger: null },
      { identifier: 'b', content: { data: {} }, trigger: null },
      { identifier: 'c', content: { data: undefined }, trigger: null },
    ] as never);
    expect(await expoNotificationScheduler.getPending()).toEqual([
      { id: 'a', signature: 's' },
      { id: 'b', signature: null },
      { id: 'c', signature: null },
    ]);
  });

  it('cancels each identifier', async () => {
    await expoNotificationScheduler.cancel(['a', 'b']);
    expect(cancelScheduledNotificationAsync).toHaveBeenCalledWith('a');
    expect(cancelScheduledNotificationAsync).toHaveBeenCalledWith('b');
  });

  it('prepares the Android channel and the hidden-preview text, and stays quiet in the foreground', async () => {
    await expoNotificationScheduler.prepare({ channelName: 'Rappels', hiddenPreview: 'Un rappel' });
    expect(setNotificationChannelAsync).toHaveBeenCalledWith(
      REMINDERS_CHANNEL_ID,
      expect.objectContaining({ name: 'Rappels' }),
    );
    // Every reminder names a sourate: each kind has the hidden-preview text.
    for (const category of [FRIDAY_CATEGORY_ID, READING_CATEGORY_ID]) {
      expect(setNotificationCategoryAsync).toHaveBeenCalledWith(category, [], {
        previewPlaceholder: 'Un rappel',
      });
    }
    expect(setNotificationHandler).toHaveBeenCalledTimes(1);
    const handler = jest.mocked(setNotificationHandler).mock.calls[0]?.[0];
    await expect(handler?.handleNotification({} as never)).resolves.toMatchObject({
      shouldShowBanner: false,
      shouldPlaySound: false,
    });
  });
});

function response(
  target: unknown,
  { action = DEFAULT_ACTION_IDENTIFIER, id = 'n1', date = 1 } = {},
): NotificationResponse {
  return {
    actionIdentifier: action,
    notification: { date, request: { identifier: id, content: { data: { target } } } },
  } as unknown as NotificationResponse;
}

describe('taps on a notification', () => {
  it('reads the target of a tap on the notification itself', () => {
    expect(tapOf(response('al-kahf'))).toEqual({ key: 'n1@1', target: 'al-kahf' });
  });

  it('ignores another action, an unknown target and a notification without one', () => {
    expect(tapOf(response('home', { action: 'dismiss' }))).toBeNull();
    expect(tapOf(response('settings'))).toBeNull();
    expect(tapOf(response(undefined))).toBeNull();
  });

  it('reports a tap once even when the listener and the launch both give it', async () => {
    let listener: (event: NotificationResponse) => void = () => {};
    const remove = jest.fn();
    jest.mocked(addNotificationResponseReceivedListener).mockImplementation((next) => {
      listener = next;
      return { remove };
    });
    jest.mocked(getLastNotificationResponseAsync).mockResolvedValue(response('resume'));
    const onTap = jest.fn();
    const stop = subscribeToExpoNotificationTaps(onTap);
    await Promise.resolve();
    listener(response('resume'));
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap).toHaveBeenCalledWith({ key: 'n1@1', target: 'resume' });
    expect(clearLastNotificationResponse).toHaveBeenCalled();
    stop();
    expect(remove).toHaveBeenCalled();
    listener(response('home', { id: 'n2' }));
    expect(onTap).toHaveBeenCalledTimes(1);
  });
});

describe('the answer to the system alert', () => {
  it('tells the listeners, so the reminders are planned again', async () => {
    const { requestPermissionsAsync } = jest.requireMock<{
      requestPermissionsAsync: jest.Mock;
    }>('expo-notifications');
    requestPermissionsAsync.mockResolvedValue({ status: 'granted', granted: true });
    const listener = jest.fn();
    const stop = subscribeToPermissionChanges(listener);
    await expoNotificationPermissions.request();
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
    announcePermissionChange();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
