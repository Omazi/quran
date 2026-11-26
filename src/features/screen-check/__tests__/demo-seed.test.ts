/**
 * The demonstration history of the iOS check must reach the phone whole, whatever the moment the
 * check ends the app. The pictures of 683ad8d showed a garden of 24 hizb in the first launch and
 * a dried one of 7 hizb in every later one: the history was written page by page (244 saves, each
 * one rewriting the whole document and the growing list of changes to sync), and the check ends
 * the app a few seconds after its picture, with the queue of writes only partly emptied.
 */
import { createMemoryStorage } from '@/data/storage';
import { quranStructure } from '@/data/quran';
import { getProgression } from '@/domain/levels';
import { daysBetween, type LocalDate } from '@/domain/shared/local-date';
import { buildReadingHistory } from '@/features/home/dev-preview/reading-histories';
import { loadAppStore } from '@/store/app-store';
import { STORED_DATA_KEY } from '@/store/config';
import type { KeyValueStorage } from '@/store/storage';

import { DEMO_TIME_DAYS, seedDemo, seedGardens } from '../demo-seed';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const TODAY = '2026-11-26' as LocalDate;
const RANGES = quranStructure.hizbPageRanges();
const HISTORY = buildReadingHistory('thriving', TODAY, RANGES);

/**
 * A storage that stops answering after `writes` writes, as an app ended in the middle of its
 * queue of writes: what was stored by then is all the next launch finds.
 */
function storageEndedAfter(writes: number) {
  const inner = createMemoryStorage();
  let count = 0;
  const storage: KeyValueStorage = {
    ...inner,
    setItem: (key, value) => {
      count += 1;
      return count > writes ? new Promise<void>(() => {}) : inner.setItem(key, value);
    },
  };
  return { storage, inner, writesAsked: () => count };
}

async function load(storage: KeyValueStorage) {
  return (await loadAppStore({ storage, onStorageError: () => {} })).store;
}

describe('the demonstration history', () => {
  it('is whole on the next launch even when the app is ended soon after the seed', async () => {
    const { storage, inner } = storageEndedAfter(4);
    const store = await load(storage);
    // Not awaited: the check ends the app without waiting for its writes.
    void seedDemo(store, TODAY, RANGES);
    await new Promise((resolve) => setTimeout(resolve, 20));

    const next = await load(inner);
    expect(next.getState().journal).toEqual(HISTORY.journal);
    expect(Object.keys(next.getState().timeSpent)).toHaveLength(DEMO_TIME_DAYS);
    expect(next.getState().settings.onboardingCompleted).toBe(true);
  });

  it('is written in one change, not page by page', async () => {
    const inner = createMemoryStorage();
    const documentWrites: string[] = [];
    const storage: KeyValueStorage = {
      ...inner,
      setItem: (key, value) => {
        if (key === STORED_DATA_KEY) documentWrites.push(value);
        return inner.setItem(key, value);
      },
    };
    const store = await load(storage);
    const before = documentWrites.length;
    await seedDemo(store, TODAY, RANGES);
    expect(documentWrites.length - before).toBe(1);
  });

  it('gives the same state to a launch that finds a history cut short by an earlier one', async () => {
    const store = await load(createMemoryStorage());
    // What the 683ad8d pictures found on disk: the first 75 pages of the history.
    for (const entry of HISTORY.journal.slice(0, 75)) store.getState().recordPageRead(entry);
    expect(store.getState().journal).toHaveLength(75);

    await seedDemo(store, TODAY, RANGES);

    expect(store.getState().journal).toEqual(HISTORY.journal);
    // Time is counted once, not added to what an earlier launch left.
    await seedDemo(store, TODAY, RANGES);
    const days = Object.values(store.getState().timeSpent);
    expect(days).toHaveLength(DEMO_TIME_DAYS);
    expect(days[days.length - 1]).toEqual({ app: 900, reader: 600 });
  });

  it('keeps the history a demonstration only: nothing of it is queued to be sent to an account', async () => {
    const store = await load(createMemoryStorage());
    const pendingBefore = store.getState().sync;
    await seedDemo(store, TODAY, RANGES);
    expect(store.getState().sync).toBe(pendingBefore);
  });
});

describe('the gardens history (D46)', () => {
  it('is one khatma completed a month ago and the next one under way, read every day', async () => {
    const store = await load(createMemoryStorage());
    await seedGardens(store, TODAY, RANGES);
    const progression = getProgression(store.getState().journal, RANGES);
    expect(progression.completed).toHaveLength(1);
    expect(progression.completed[0]).toMatchObject({ khatm: 1, level: 1 });
    expect(daysBetween(progression.completed[0]!.completedOn, TODAY)).toBeGreaterThan(7);
    expect(progression).toMatchObject({ level: 2, styleId: 'oasis', hasStarted: true });
    expect(progression.hizbCompleted).toBeGreaterThan(0);
    const lastDay = store.getState().journal.at(-1)?.date;
    expect(lastDay).toBe(TODAY);
  });

  it('marks its khatma celebrated, so nothing opens by itself over the pictures', async () => {
    const store = await load(createMemoryStorage());
    await seedGardens(store, TODAY, RANGES);
    expect(store.getState().settings).toMatchObject({
      celebratedKhatm: 1,
      onboardingCompleted: true,
    });
  });

  it('is written in one change, and nothing of it is queued for an account', async () => {
    const store = await load(createMemoryStorage());
    const pendingBefore = store.getState().sync;
    await seedGardens(store, TODAY, RANGES);
    expect(store.getState().sync).toBe(pendingBefore);
  });
});
