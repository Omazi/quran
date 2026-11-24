import {
  getPermissionsAsync,
  IosAuthorizationStatus,
  PermissionStatus,
  requestPermissionsAsync,
  type NotificationPermissionsStatus,
} from 'expo-notifications';

import { createInertNotificationPermissions, deviceNotificationPermissions } from '..';
import { expoNotificationPermissions } from '../expo-notification-permissions';
import { deviceNotificationPermissions as webNotificationPermissions } from '../device-notification-permissions.web';

jest.mock('expo-notifications', () => ({
  ...jest
    .requireActual<typeof import('../test-support/quiet-expo-notifications')>(
      '../test-support/quiet-expo-notifications',
    )
    .loadQuietly(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
}));

function response(
  status: PermissionStatus,
  iosStatus?: IosAuthorizationStatus,
): NotificationPermissionsStatus {
  const base = {
    status,
    granted: status === PermissionStatus.GRANTED,
    canAskAgain: status !== PermissionStatus.DENIED,
    expires: 'never' as const,
  };
  if (iosStatus === undefined) return base;
  return {
    ...base,
    ios: {
      status: iosStatus,
      allowsDisplayInNotificationCenter: null,
      allowsDisplayOnLockScreen: null,
      allowsDisplayInCarPlay: null,
      allowsAlert: null,
      allowsBadge: null,
      allowsSound: null,
      allowsCriticalAlerts: null,
      alertStyle: 0,
      allowsPreviews: null,
      providesAppNotificationSettings: null,
      allowsAnnouncements: null,
    },
  };
}

describe('permission to notify, through expo-notifications', () => {
  it('is the one a phone uses', () => {
    expect(deviceNotificationPermissions).toBe(expoNotificationPermissions);
  });

  it.each([
    ['granted', response(PermissionStatus.GRANTED), 'granted'],
    ['denied', response(PermissionStatus.DENIED), 'denied'],
    ['not asked yet', response(PermissionStatus.UNDETERMINED), 'undetermined'],
    [
      'granted on iOS',
      response(PermissionStatus.GRANTED, IosAuthorizationStatus.AUTHORIZED),
      'granted',
    ],
    [
      'provisional on iOS, which notifies quietly',
      response(PermissionStatus.UNDETERMINED, IosAuthorizationStatus.PROVISIONAL),
      'granted',
    ],
    [
      'ephemeral on iOS',
      response(PermissionStatus.UNDETERMINED, IosAuthorizationStatus.EPHEMERAL),
      'granted',
    ],
    ['denied on iOS', response(PermissionStatus.DENIED, IosAuthorizationStatus.DENIED), 'denied'],
    [
      'not asked yet on iOS',
      response(PermissionStatus.UNDETERMINED, IosAuthorizationStatus.NOT_DETERMINED),
      'undetermined',
    ],
  ])('reads the state: %s', async (_name, systemResponse, expected) => {
    jest.mocked(getPermissionsAsync).mockResolvedValue(systemResponse);
    await expect(expoNotificationPermissions.getStatus()).resolves.toBe(expected);
  });

  it('asks for alerts and sounds, not for a badge, and reports the answer', async () => {
    jest.mocked(requestPermissionsAsync).mockResolvedValue(response(PermissionStatus.DENIED));
    await expect(expoNotificationPermissions.request()).resolves.toBe('denied');
    expect(requestPermissionsAsync).toHaveBeenCalledWith({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });

    jest.mocked(requestPermissionsAsync).mockResolvedValue(response(PermissionStatus.GRANTED));
    await expect(expoNotificationPermissions.request()).resolves.toBe('granted');
  });

  it('passes a failure of the system on to its caller', async () => {
    const failure = new Error('unavailable');
    jest.mocked(getPermissionsAsync).mockRejectedValue(failure);
    await expect(expoNotificationPermissions.getStatus()).rejects.toBe(failure);
  });
});

describe('inert permission to notify', () => {
  it('reports that nothing can be shown, and asking changes nothing', async () => {
    const permissions = createInertNotificationPermissions();
    await expect(permissions.getStatus()).resolves.toBe('denied');
    await expect(permissions.request()).resolves.toBe('denied');
    await expect(permissions.getStatus()).resolves.toBe('denied');
  });

  it('is what the web uses', async () => {
    await expect(webNotificationPermissions.getStatus()).resolves.toBe('denied');
    await expect(webNotificationPermissions.request()).resolves.toBe('denied');
  });

  it.each(['granted', 'denied'] as const)(
    'lets a test choose the answer to the first request: %s',
    async (answer) => {
      const permissions = createInertNotificationPermissions({ status: 'undetermined', answer });
      await expect(permissions.getStatus()).resolves.toBe('undetermined');
      await expect(permissions.request()).resolves.toBe(answer);
      await expect(permissions.getStatus()).resolves.toBe(answer);
    },
  );

  it('does not ask again once the person has answered', async () => {
    const permissions = createInertNotificationPermissions({ status: 'granted', answer: 'denied' });
    await expect(permissions.request()).resolves.toBe('granted');
  });
});
