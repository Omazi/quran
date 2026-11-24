import AsyncStorage from '@react-native-async-storage/async-storage';

import type { KeyValueStorage } from '@/store';

/**
 * The storage of the device, through AsyncStorage: unencrypted text, private to the app, that
 * never leaves the phone. It holds settings and the reading journal, no secret.
 */
export const deviceStorage: KeyValueStorage = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: async (key, value) => {
    await AsyncStorage.setItem(key, value);
  },
  removeItem: async (key) => {
    await AsyncStorage.removeItem(key);
  },
};
