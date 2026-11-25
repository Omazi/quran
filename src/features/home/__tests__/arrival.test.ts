import { quranStructure } from '@/data/quran';
import type { GardenState } from '@/domain/garden';
import { parseLocalDate } from '@/domain/shared/local-date';

import { buildReadingHistory, type ReadingHistoryName } from '../dev-preview/reading-histories';
import { newArrival } from '../arrival';
import { buildHomeModel } from '../home-model';

const TODAY = parseLocalDate('2026-11-24');
const RANGES = quranStructure.hizbPageRanges();

function gardenOf(history: ReadingHistoryName): GardenState {
  return buildHomeModel({
    ...buildReadingHistory(history, TODAY, RANGES),
    today: TODAY,
    hizbPageRanges: RANGES,
  }).garden;
}

describe('newArrival: the element to celebrate when a hizb is finished (nouveau.png)', () => {
  const thriving = gardenOf('thriving');

  it('is the element of the last finished hizb, with the next one to grow', () => {
    const before = { ...thriving, hizbCompleted: thriving.hizbCompleted - 1 };
    const arrival = newArrival(before, thriving);
    expect(arrival).toEqual({
      hizb: thriving.hizbCompleted,
      element: thriving.lastUnlocked,
      next: thriving.nextElement?.element ?? null,
    });
  });

  it('is nothing the first time the screen is seen: no hizb was finished in front of it', () => {
    expect(newArrival(null, thriving)).toBeNull();
  });

  it('is nothing while the number of finished hizb does not grow', () => {
    expect(newArrival(thriving, thriving)).toBeNull();
    const after = { ...thriving, hizbCompleted: thriving.hizbCompleted - 1 };
    expect(newArrival(thriving, after)).toBeNull();
  });

  it('is nothing for the last hizb: the completed khatma has a screen of its own', () => {
    const complete = gardenOf('khatma-complete');
    const before = { ...complete, hizbCompleted: 59, isComplete: false };
    expect(newArrival(before, complete)).toBeNull();
  });

  it('is nothing across two khatmas: a new garden is not a new element', () => {
    const otherCycle = { ...thriving, variant: { ...thriving.variant, cycle: 2 } };
    expect(newArrival({ ...thriving, hizbCompleted: 1 }, otherCycle)).toBeNull();
  });
});
