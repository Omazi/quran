/**
 * Where a tap on a notification leads: the reader where the person left off, Al-Kahf, or home.
 */
import { act } from '@testing-library/react-native';

import type { NotificationTap, SubscribeToNotificationTaps } from '@/data/notifications';
import { EMPTY_JOURNAL, recordPageRead } from '@/domain/khatm';
import { parseLocalDate } from '@/domain/shared/local-date';
import { renderWithStore } from '@/features/settings/test-support/render-with-store';

import { useNotificationTaps } from '../use-notification-taps';

const mockPush = jest.fn();
const mockRouter = { push: mockPush };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('expo-notifications', () =>
  jest
    .requireActual<typeof import('@/data/notifications/test-support/quiet-expo-notifications')>(
      '@/data/notifications/test-support/quiet-expo-notifications',
    )
    .loadQuietly(),
);

let tap: (value: NotificationTap) => void = () => {};
const stop = jest.fn();
const subscribe: SubscribeToNotificationTaps = (onTap) => {
  tap = onTap;
  return stop;
};

function Probe() {
  useNotificationTaps({ subscribe });
  return null;
}

async function open(data: Parameters<typeof renderWithStore>[1] = {}) {
  const store = await renderWithStore(<Probe />, data);
  // The subscription is made in an effect: let it run before the test taps.
  await act(async () => {});
  return store;
}

beforeEach(() => {
  mockPush.mockClear();
});

it('opens Al-Kahf for the Friday reminder', async () => {
  await open();
  await act(async () => tap({ key: 'a', target: 'al-kahf' }));
  expect(mockPush).toHaveBeenCalledWith('/reader/293');
});

it('opens the home screen for a dead garden', async () => {
  await open();
  await act(async () => tap({ key: 'a', target: 'home' }));
  expect(mockPush).toHaveBeenCalledWith('/(tabs)');
});

it('opens the first page when nothing was read or opened', async () => {
  await open();
  await act(async () => tap({ key: 'a', target: 'resume' }));
  expect(mockPush).toHaveBeenCalledWith('/reader/1');
});

it('opens the page the reader was left on, as it is at the moment of the tap', async () => {
  const store = await open({ settings: { lastOpenedPage: 212 } });
  await act(async () => tap({ key: 'a', target: 'resume' }));
  expect(mockPush).toHaveBeenLastCalledWith('/reader/212');
  await act(async () => store.getState().setLastOpenedPage(300));
  await act(async () => tap({ key: 'b', target: 'resume' }));
  expect(mockPush).toHaveBeenLastCalledWith('/reader/300');
});

it('resumes at the first unread page when the reader was never opened', async () => {
  let journal = EMPTY_JOURNAL;
  for (let page = 1; page <= 4; page += 1) {
    journal = recordPageRead(journal, { page, date: parseLocalDate('2026-11-24') });
  }
  await open({ journal });
  await act(async () => tap({ key: 'a', target: 'resume' }));
  expect(mockPush).toHaveBeenCalledWith('/reader/5');
});
