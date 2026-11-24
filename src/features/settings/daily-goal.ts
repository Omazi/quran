import { HIZB_COUNT, HIZB_PER_JUZ, PAGE_COUNT } from '@/domain/quran';
import { DAILY_GOAL_RANGE, useAppStore } from '@/store';

/** A daily goal that readers know by a name: half a hizb, a hizb, a juz. */
export type GoalLandmark = 'half-hizb' | 'hizb' | 'juz';

/** What a daily goal means over time. */
export interface DailyGoalPace {
  /** Days needed to read the whole Quran at this goal, the last and shorter day included. */
  readonly khatmaDays: number;
  /** The name readers give to this number of pages, when it has one. */
  readonly landmark: GoalLandmark | null;
}

/** What the goal row shows. */
export interface DailyGoalModel extends DailyGoalPace {
  readonly pages: number;
  readonly min: number;
  readonly max: number;
}

/** A hizb is 604 pages over 60, about ten pages: readers count it as ten. */
const PAGES_PER_HIZB = Math.round(PAGE_COUNT / HIZB_COUNT);
const PAGES_PER_HALF_HIZB = PAGES_PER_HIZB / 2;
const PAGES_PER_JUZ = PAGES_PER_HIZB * HIZB_PER_JUZ;

function landmarkOf(pages: number): GoalLandmark | null {
  if (pages === PAGES_PER_HALF_HIZB) return 'half-hizb';
  if (pages === PAGES_PER_HIZB) return 'hizb';
  if (pages === PAGES_PER_JUZ) return 'juz';
  return null;
}

/** The pace of a daily goal: 5 pages a day is half a hizb, and a khatma in 121 days. */
export function describeDailyGoal(pages: number): DailyGoalPace {
  if (!Number.isInteger(pages) || pages < 1) {
    throw new RangeError(`The daily goal must be a whole number of at least 1, received ${pages}.`);
  }
  return { khatmaDays: Math.ceil(PAGE_COUNT / pages), landmark: landmarkOf(pages) };
}

/** The daily goal of the person, ready for `DailyGoalSection`, and the way to change it. */
export function useDailyGoal(): { model: DailyGoalModel; setPages: (pages: number) => void } {
  const pages = useAppStore((state) => state.settings.dailyGoalPages);
  const setPages = useAppStore((state) => state.setDailyGoalPages);
  return {
    model: { pages, ...DAILY_GOAL_RANGE, ...describeDailyGoal(pages) },
    setPages,
  };
}
