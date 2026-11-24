/**
 * The model of the home screen and the pure function that builds it (docs/specs/ui-lot1.md,
 * B.4). Every number comes from the public APIs of the khatm and garden modules: this file
 * passes values from one to the other and decides nothing about reading or about the garden.
 */

import { computeGardenState, gardenVariant, type GardenState } from '@/domain/garden';
import {
  estimateFinishDate,
  getCurrentKhatm,
  getGardenFeed,
  getKhatmProgress,
  getStreak,
  getTodayProgress,
  type HizbPageRange,
  type Pause,
  type ReadingJournal,
  type TodayProgress,
} from '@/domain/khatm';
import type { LocalDate } from '@/domain/shared/local-date';

/** What the home screen needs from the person's settings. */
export interface HomeSettings {
  /** Pages to read each day, chosen by the person. */
  readonly dailyGoalPages: number;
  /** Makes this person's gardens their own (`gardenVariant`). */
  readonly userSeed: number;
  /** Periods during which the garden is frozen. */
  readonly pauses: readonly Pause[];
}

/** Everything the model is built from. Nothing else is read: no clock, no storage. */
export interface HomeModelInput {
  readonly journal: ReadingJournal;
  readonly settings: HomeSettings;
  /** The calendar day in the person's time zone. */
  readonly today: LocalDate;
  /** The 60 hizb of the mushaf (`quranStructure.hizbPageRanges()`). */
  readonly hizbPageRanges: readonly HizbPageRange[];
}

/**
 * What the home screen reads from the app's data: the reading journal and three settings, as
 * the store holds them (see `home-source.ts`).
 */
export type HomeSource = Pick<HomeModelInput, 'journal' | 'settings'>;

/**
 * The message shown under the scene, in place of the water status, or none while the garden
 * thrives.
 * `recovering`: the garden still shows a drought, but the person read today, so it is told as
 * good news. `complete`: the khatma is finished and the next one has no page yet.
 */
export type HomeNotice =
  'bare' | 'thirsty' | 'wilting' | 'dying' | 'dead' | 'recovering' | 'complete';

/** What to read now. */
export interface HomeReading {
  /** Number of the khatma the next page belongs to. */
  readonly khatm: number;
  /** The first page of that khatma not read yet. */
  readonly nextPage: number;
  /** False while that khatma has no page: the person starts it, they do not resume it. */
  readonly hasStarted: boolean;
  /** The day that khatma would end at the pace of the daily goal, or null if unknown. */
  readonly estimatedFinishDate: LocalDate | null;
  /** True when that day is today. */
  readonly finishesToday: boolean;
}

export interface HomeReadyModel {
  readonly status: 'ready';
  /** The garden to show, for `GardenScene` and for its readout. */
  readonly garden: GardenState;
  readonly notice: HomeNotice | null;
  /** Days read in a row. 0 when there is no streak to show. */
  readonly streakDays: number;
  /** Pages read today out of the goal the person chose. */
  readonly today: TodayProgress;
  readonly reading: HomeReading;
}

/** The model could not be built: the screen says so instead of showing wrong numbers. */
export interface HomeUnavailableModel {
  readonly status: 'unavailable';
}

export type HomeModel = HomeReadyModel | HomeUnavailableModel;

export interface HomeActions {
  /** Opens the reader on the page to read. The one main action of the screen. */
  readonly readAndWater: () => void;
  /** Builds the model again. The action of the unavailable state. */
  readonly retry: () => void;
}

interface NoticeFacts {
  readonly garden: GardenState;
  readonly showsCompletedKhatma: boolean;
  readonly isWateredToday: boolean;
}

/**
 * Which message fits the garden. It only names what the garden module computed; the one thing
 * it adds is the tone: a drought seen on a day the person has read is a recovery, not a warning.
 */
function chooseNotice({
  garden,
  showsCompletedKhatma,
  isWateredToday,
}: NoticeFacts): HomeNotice | null {
  if (showsCompletedKhatma) return 'complete';
  if (garden.phase === 'thriving') return null;
  if (garden.phase === 'bare') return 'bare';
  return isWateredToday ? 'recovering' : garden.phase;
}

/**
 * Builds the model of the home screen: where the garden is, and what to read now.
 *
 * Pure: the same input always gives the same model. Invalid input (a damaged journal, a goal
 * below one page, incomplete hizb ranges) throws the error of the module that rejects it.
 */
export function buildHomeModel({
  journal,
  settings,
  today,
  hizbPageRanges,
}: HomeModelInput): HomeReadyModel {
  const { dailyGoalPages, userSeed, pauses } = settings;

  const feed = getGardenFeed(journal, hizbPageRanges);
  const garden = computeGardenState({
    hizbCompleted: feed.hizbCompleted,
    currentHizbProgress: feed.currentHizbProgress,
    wateredDays: feed.wateredDays,
    firstHizbCompletedOn: feed.firstHizbCompletedOn,
    completedOn: feed.completedOn,
    today,
    pauses,
    variant: gardenVariant(feed.khatm, userSeed),
  });

  // The khatma to read: the one in progress, or the next one when a khatma was just completed.
  const khatm = getCurrentKhatm(journal);
  const progress = getKhatmProgress(journal, khatm, hizbPageRanges);
  if (progress.firstUnreadPage === null) {
    throw new RangeError(`Khatma ${khatm} is the one to read, yet it has no unread page.`);
  }
  const estimatedFinishDate = estimateFinishDate(journal, khatm, today, {
    kind: 'daily-goal',
    dailyGoalPages,
  });

  return {
    status: 'ready',
    garden,
    notice: chooseNotice({
      garden,
      showsCompletedKhatma: feed.completedOn !== null,
      isWateredToday: feed.wateredDays.has(today),
    }),
    streakDays: getStreak(journal, today, pauses),
    today: getTodayProgress(journal, today, dailyGoalPages),
    reading: {
      khatm,
      nextPage: progress.firstUnreadPage,
      hasStarted: progress.pagesRead > 0,
      estimatedFinishDate,
      finishesToday: estimatedFinishDate === today,
    },
  };
}
