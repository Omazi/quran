/**
 * Test support: the real `expo-notifications` package, loaded without its import-time warning.
 * Under Jest the package believes it runs in Expo Go and warns that push notifications are not
 * available there. The app uses local notifications only, so the warning is noise in every test
 * that loads a route.
 *
 * Use it as the factory of a module mock:
 * `jest.mock('expo-notifications', () => jest.requireActual('@/data/notifications/test-support/quiet-expo-notifications').loadQuietly());`
 */
export function loadQuietly(): typeof import('expo-notifications') {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    return jest.requireActual<typeof import('expo-notifications')>('expo-notifications');
  } finally {
    warn.mockRestore();
  }
}
