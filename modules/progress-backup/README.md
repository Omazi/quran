# progress-backup

Local Expo module (iOS only): reads and writes one text in the person's iCloud key-value store
(`NSUbiquitousKeyValueStore`). It is the native side of the copy of the progress described in
`docs/specs/backup.md`; the JavaScript side is `src/data/storage/icloud-progress-backup.ts`.

**Never compiled or run**: no Mac was available when it was written. It is therefore **kept out
of native builds**: `package.json` lists it under `expo.autolinking.exclude`. Without it the app
uses the inert copy (`src/data/storage/inert-progress-backup.ts`) and everything else works.

To activate it, follow `docs/specs/backup.md`, section « Activation », which is the reference.
In short: the iCloud capability with key-value storage on the app identifier, the
module taken out of `expo.autolinking.exclude`, the entitlement
`com.apple.developer.ubiquity-kvstore-identifier` under `ios.entitlements` in `app.json`
(`ios.usesIcloudStorage` does not add it), a build on a Mac, then the test on a real iPhone.

Once it is in a build, `ICLOUD_BACKUP_ENABLED` in `src/data/storage/icloud-progress-backup.ts`
switches the JavaScript side off without removing the module.
