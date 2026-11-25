/**
 * The phone's own backups carry the stored progress (docs/specs/sync.md, 4). Two lines of
 * app.json decide it; removing one would silently leave the progress out of every backup.
 */
import appConfig from '../../../../app.json';

describe('the backups of the phone', () => {
  it('iOS: the storage of the app stays in iCloud and computer backups', () => {
    // AsyncStorage 2.x leaves its folder out of the backups unless this key says false.
    expect(appConfig.expo.ios.infoPlist.RCTAsyncStorageExcludeFromBackup).toBe(false);
  });

  it('Android: Auto Backup is on, with no rule that would leave the storage out', () => {
    expect(appConfig.expo.android.allowBackup).toBe(true);
    const android: Record<string, unknown> = appConfig.expo.android;
    expect(android.fullBackupContent).toBeUndefined();
    expect(android.dataExtractionRules).toBeUndefined();
  });
});
