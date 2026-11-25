/**
 * Test support for the screens built on the store: a store with chosen data and no storage behind
 * it. The storage itself is tested with `loadAppStore` (src/store/__tests__).
 */

import { EMPTY_JOURNAL, type ReadingJournal } from '@/domain/khatm';

import type { SecondsByDay } from '@/domain/stats';

import { EMPTY_TIME_SPENT } from '../config';
import { createFirstLaunchSettings, createStateStore, type AppStore } from '../app-store';
import type { AppSettings, DataResetNotice } from '../types';

/** The seed of the test stores: any valid seed does, a fixed one keeps tests repeatable. */
export const TEST_USER_SEED = 42;

export interface TestStoreData {
  /** Changes to the settings of a first launch. */
  settings?: Partial<AppSettings>;
  journal?: ReadingJournal;
  timeSpent?: SecondsByDay;
  /** A notice about stored data that could not be read back, still to show. */
  dataResetNotice?: DataResetNotice | null;
}

/** A store as on a first launch, with the given changes. Nothing is written anywhere. */
export function createTestAppStore({
  settings,
  journal,
  timeSpent,
  dataResetNotice = null,
}: TestStoreData = {}): AppStore {
  const store = createStateStore(
    {
      settings: { ...createFirstLaunchSettings(TEST_USER_SEED), ...settings },
      journal: journal ?? EMPTY_JOURNAL,
      timeSpent: timeSpent ?? EMPTY_TIME_SPENT,
    },
    { dataResetNotice },
  );
  return Object.assign(store, {
    whenSaved: () => Promise.resolve(),
    whenBackedUp: () => Promise.resolve(),
  });
}
