import { I18nManager } from 'react-native';

import { createMemoryStorage } from '@/data/storage';

import {
  DIRECTION_RESTART_KEY,
  RESTART_GRACE_MS,
  alignDirectionAtStartup,
  chooseDirectionFor,
  deviceWritingDirection,
  isLaidOutFor,
  type WritingDirectionPlatform,
} from '../writing-direction';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo', () => ({
  ...jest.requireActual<typeof import('expo')>('expo'),
  reloadAppAsync: jest.fn(() => Promise.resolve()),
}));

/**
 * A phone: its direction is fixed while the app runs, a recorded direction applies at the next
 * start. `restartsApply: false` is a platform where restarting changes nothing.
 */
function createPhone(startsRightToLeft: boolean, { restartsApply = true } = {}) {
  let running = startsRightToLeft;
  let recorded = startsRightToLeft;
  const platform: WritingDirectionPlatform = {
    isRightToLeft: () => running,
    setRightToLeft: jest.fn((rightToLeft: boolean) => {
      recorded = rightToLeft;
    }),
    restart: jest.fn(async () => {}),
  };
  return {
    platform,
    /** What a restart does: the app starts again with the recorded direction. */
    startAgain: () => {
      if (restartsApply) running = recorded;
    },
    recorded: () => recorded,
  };
}

function startupWith(phone: ReturnType<typeof createPhone>, storage = createMemoryStorage()) {
  const wait = jest.fn(async () => {});
  return { storage, wait, dependencies: { platform: phone.platform, storage, wait } };
}

describe('writing direction on a phone', () => {
  it('reads the direction React Native was started with', () => {
    jest.replaceProperty(I18nManager, 'isRTL', true);
    expect(deviceWritingDirection.isRightToLeft()).toBe(true);
    jest.replaceProperty(I18nManager, 'isRTL', false);
    expect(deviceWritingDirection.isRightToLeft()).toBe(false);
    jest.restoreAllMocks();
  });

  it.each([true, false])(
    'records a direction by both allowing and forcing it (right to left: %p)',
    (rightToLeft) => {
      const allowRTL = jest.spyOn(I18nManager, 'allowRTL').mockImplementation(() => {});
      const forceRTL = jest.spyOn(I18nManager, 'forceRTL').mockImplementation(() => {});
      deviceWritingDirection.setRightToLeft(rightToLeft);
      expect(allowRTL).toHaveBeenCalledWith(rightToLeft);
      expect(forceRTL).toHaveBeenCalledWith(rightToLeft);
      jest.restoreAllMocks();
    },
  );

  it('restarts through Expo, which reloads the app in release builds too', async () => {
    const { reloadAppAsync } = jest.requireMock<typeof import('expo')>('expo');
    await deviceWritingDirection.restart();
    expect(reloadAppAsync).toHaveBeenCalledTimes(1);
  });
});

describe('direction of a chosen language', () => {
  it('is in place when the app already runs in that direction', () => {
    expect(isLaidOutFor('ar', createPhone(true).platform)).toBe(true);
    expect(isLaidOutFor('fr', createPhone(false).platform)).toBe(true);
    expect(isLaidOutFor('en', createPhone(true).platform)).toBe(false);
    expect(isLaidOutFor('ar', createPhone(false).platform)).toBe(false);
  });

  it('is recorded for the next start, and reported as not yet in place', () => {
    const phone = createPhone(false);
    expect(chooseDirectionFor('ar', phone.platform)).toBe(false);
    expect(phone.recorded()).toBe(true);
    expect(phone.platform.restart).not.toHaveBeenCalled();
  });

  it('cancels a change recorded earlier when the person comes back to their first choice', () => {
    const phone = createPhone(false);
    chooseDirectionFor('ar', phone.platform);
    expect(chooseDirectionFor('en', phone.platform)).toBe(true);
    expect(phone.recorded()).toBe(false);
  });
});

describe('direction at start-up', () => {
  it('does nothing when the app already runs in the direction of its language', async () => {
    const phone = createPhone(false);
    const { storage, dependencies } = startupWith(phone);
    await expect(alignDirectionAtStartup('fr', dependencies)).resolves.toBe(true);
    expect(phone.platform.setRightToLeft).not.toHaveBeenCalled();
    expect(phone.platform.restart).not.toHaveBeenCalled();
    expect(storage.peek(DIRECTION_RESTART_KEY)).toBeNull();
  });

  it('restarts once when Arabic starts in a left-to-right app, and is then in place', async () => {
    const phone = createPhone(false);
    const { storage, wait, dependencies } = startupWith(phone);

    // First start: the direction is recorded, remembered, and the app restarts.
    await alignDirectionAtStartup('ar', dependencies);
    expect(phone.recorded()).toBe(true);
    expect(phone.platform.restart).toHaveBeenCalledTimes(1);
    expect(wait).toHaveBeenCalledWith(RESTART_GRACE_MS);
    expect(storage.peek(DIRECTION_RESTART_KEY)).toBe('rtl');

    // Second start, after the restart.
    phone.startAgain();
    await expect(alignDirectionAtStartup('ar', dependencies)).resolves.toBe(true);
    expect(phone.platform.restart).toHaveBeenCalledTimes(1);
    expect(storage.peek(DIRECTION_RESTART_KEY)).toBeNull();
  });

  it('restarts back to left to right when a right-to-left app starts in French', async () => {
    const phone = createPhone(true);
    const { dependencies } = startupWith(phone);
    await alignDirectionAtStartup('fr', dependencies);
    expect(phone.recorded()).toBe(false);
    expect(phone.platform.restart).toHaveBeenCalledTimes(1);
    phone.startAgain();
    await expect(alignDirectionAtStartup('fr', dependencies)).resolves.toBe(true);
  });

  it('never restarts twice for the same direction when restarting does not help', async () => {
    const phone = createPhone(false, { restartsApply: false });
    const { dependencies } = startupWith(phone);
    await expect(alignDirectionAtStartup('ar', dependencies)).resolves.toBe(false);
    for (let start = 0; start < 3; start += 1) {
      phone.startAgain();
      await expect(alignDirectionAtStartup('ar', dependencies)).resolves.toBe(false);
    }
    expect(phone.platform.restart).toHaveBeenCalledTimes(1);
  });

  it('needs no restart on a platform that applies the direction at once', async () => {
    let rightToLeft = false;
    const platform: WritingDirectionPlatform = {
      isRightToLeft: () => rightToLeft,
      setRightToLeft: (next) => {
        rightToLeft = next;
      },
      restart: jest.fn(async () => {}),
    };
    const storage = createMemoryStorage();
    const wait = jest.fn(async () => {});
    await expect(alignDirectionAtStartup('ar', { platform, storage, wait })).resolves.toBe(true);
    expect(platform.restart).not.toHaveBeenCalled();
  });

  it('does not restart when it cannot remember having done so', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const phone = createPhone(false);
    const storage = createMemoryStorage();
    jest.spyOn(storage, 'setItem').mockRejectedValue(new Error('full'));
    const wait = jest.fn(async () => {});
    const dependencies = { platform: phone.platform, storage, wait };
    await expect(alignDirectionAtStartup('ar', dependencies)).resolves.toBe(false);
    expect(phone.platform.restart).not.toHaveBeenCalled();
    // The direction still applies at the next start.
    expect(phone.recorded()).toBe(true);
    warn.mockRestore();
  });

  it('carries on in the direction it has when the restart fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const phone = createPhone(false);
    jest.mocked(phone.platform.restart).mockRejectedValue(new Error('no reload'));
    const { dependencies } = startupWith(phone);
    await expect(alignDirectionAtStartup('ar', dependencies)).resolves.toBe(false);
    warn.mockRestore();
  });
});
