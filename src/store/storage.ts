/**
 * What the store needs from the device: named pieces of text kept between two launches.
 * Declared here, implemented in `src/data/storage`, so the storage can change without the store.
 * Nothing kept through it leaves the device.
 */
export interface KeyValueStorage {
  /** The text kept under `key`, or null when there is none. */
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}
