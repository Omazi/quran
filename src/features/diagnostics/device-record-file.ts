import { File, Paths } from 'expo-file-system';

import type { RecordFile } from './record-file';

/**
 * The record on the phone: a small file in the app's document folder, written and read
 * synchronously (see record-file.ts). It stays on the phone; the person is the only one who can
 * send it anywhere.
 */
export function createDeviceRecordFile(): RecordFile {
  const open = () => new File(Paths.document, 'last-closure.json');
  return {
    read: () => {
      const file = open();
      return file.exists ? file.textSync() : null;
    },
    write: (text) => {
      const file = open();
      if (!file.exists) file.create();
      file.writeSync(text);
    },
    remove: () => {
      const file = open();
      if (file.exists) file.delete();
    },
  };
}
