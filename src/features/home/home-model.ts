/**
 * The model of the home screen and the pure function that builds it (docs/specs/ui-lot1.md,
 * B.4). Every number comes from the public APIs of the khatm and garden modules: this file
 * passes values from one to the other and decides nothing about reading or about the garden.
 */

import {
  computeGardenState,
  DEFAULT_GARDEN_CONFIG,
  forecastGardenWithoutReading,
  gardenVariant,
  type GardenInput,
  type GardenPhase,
  type GardenState,
} from '@/domain/garden';
import {
  estimateFinishDate,
  getBadges,
  getCurrentKhatm,
  getGardenFeed,
  getKhatmProgress,
  getReadPages,
  getStreak,
  getTodayProgress,
  type HizbPageRange,
  type Pause,
  type ReadingJournal,
  type TodayProgress,
} from '@/domain/khatm';
import { assertPageNumber, HIZB_COUNT, PAGE_COUNT } from '@/domain/quran';
import type { LocalDate } from '@/domain/shared/local-date';

/** What the home screen needs from the person's settings. */
export interface HomeSettings {
  /** Pages to read each day, chosen by the person. */
  readonly dailyGoalPages: number;
  /** Makes this person's gardens their own (`gardenVariant`). */
  readonly userSeed: number;
  /** The last page opened in the reader, or null: the page to resume starts from it. */
  readonly lastOpenedPage: number | null;
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

/**
 * Which of the validated home screens fits the garden (docs/design): `growing` (accueil.png: the
 * bare earth, a thriving garden, a garden watered again today), `thirsty` (soif.png: thirsty,
 * wilting or dying), `dead` (mort.png), `complete` (khatm.png).
 */
export type HomeLayout = 'growing' | 'thirsty' | 'dead' | 'complete';

/** "24 hizb sur 60", and the hizb being read: "Encore 3 pages pour finir le hizb 25". */
export interface HomeHizb {
  readonly completed: number;
  readonly total: number;
  /** The first unfinished hizb of the khatma, or null once it is complete. */
  readonly inProgress: number | null;
  /** Its pages not read yet, or null once the khatma is complete. */
  readonly pagesLeft: number | null;
}

/**
 * The water beside the hizb count: watered for the days of the streak ("Arrosé depuis 12 j"),
 * still or dry since the days missed in a row ("À sec depuis 3 j"), or no water yet.
 */
export type HomeWaterRun =
  { readonly kind: 'watered' | 'still' | 'dry'; readonly days: number } | { readonly kind: 'none' };

/** A drought told in words: "Trois jours sans lecture", and the next change if nothing is read. */
export interface HomeDrought {
  readonly daysWithoutReading: number;
  /** The next phase the garden reaches without reading, and in how many days; null when dead. */
  readonly next: { readonly phase: GardenPhase; readonly inDays: number } | null;
}

/** The khatma just completed, while the next one has no page: khatm.png. */
export interface HomeCompletedKhatma {
  readonly khatm: number;
  readonly hizb: number;
  readonly pages: number;
  /** Calendar days from its first page to its last, both included. */
  readonly days: number;
  /** Where "Nouvelle khatma" opens: the first page of the next one. */
  readonly nextKhatmaFirstPage: number;
}

export interface HomeReadyModel {
  readonly status: 'ready';
  readonly layout: HomeLayout;
  readonly hizb: HomeHizb;
  readonly waterRun: HomeWaterRun;
  /** Only in the `thirsty` and `dead` layouts. */
  readonly drought: HomeDrought | null;
  /** Only in the `complete` layout. */
  readonly completedKhatma: HomeCompletedKhatma | null;
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
  /** The avatar of the header: opens the profile. */
  readonly openProfile: () => void;
  /** "Tout voir" under "Jardins voisins": opens the Proches tab. */
  readonly openFriends: () => void;
  /** A friend's garden: opens the friend's page. */
  readonly openFriend: (userId: string) => void;
  /** "Nouvelle khatma": opens the reader on the first page of the next khatma. */
  readonly startNewKhatma: (page: number) => void;
  /** Opens the system's share sheet with a sentence (activity-views.md). */
  readonly share: (message: string) => void;
  /** Closes the sheet of a hizb just finished. */
  readonly dismissArrival: () => void;
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

const LAYOUT_OF_NOTICE: Readonly<Record<HomeNotice, HomeLayout>> = {
  bare: 'growing',
  recovering: 'growing',
  thirsty: 'thirsty',
  wilting: 'thirsty',
  dying: 'thirsty',
  dead: 'dead',
  complete: 'complete',
};

function layoutOf(notice: HomeNotice | null): HomeLayout {
  return notice === null ? 'growing' : LAYOUT_OF_NOTICE[notice];
}

function waterRunOf(garden: GardenState, streakDays: number): HomeWaterRun {
  if (garden.phase === 'bare') return { kind: 'none' };
  if (streakDays > 0) return { kind: 'watered', days: streakDays };
  if (garden.missedDaysInARow > 0) {
    return { kind: garden.water === 'dry' ? 'dry' : 'still', days: garden.missedDaysInARow };
  }
  return { kind: 'none' };
}

/** The phases a drought goes through, in order: the forecast only looks for a worse one. */
const DROUGHT_ORDER: readonly GardenPhase[] = ['thirsty', 'wilting', 'dying', 'dead'];

/**
 * The days without reading, and the next phase the garden module forecasts if nothing is read.
 * The forecast stops at death: no garden lasts longer than that without water.
 */
function droughtOf(garden: GardenState, input: GardenInput, deathDays: number): HomeDrought {
  const rank = DROUGHT_ORDER.indexOf(garden.phase);
  let next: HomeDrought['next'] = null;
  if (rank >= 0 && garden.phase !== 'dead') {
    const forecast = forecastGardenWithoutReading(input, deathDays);
    const index = forecast.findIndex(({ state }) => DROUGHT_ORDER.indexOf(state.phase) > rank);
    const day = forecast[index];
    if (day !== undefined) next = { phase: day.state.phase, inDays: index + 1 };
  }
  return { daysWithoutReading: garden.missedDaysInARow, next };
}

/** Pages of a hizb not read yet in a khatma. */
function pagesLeftIn(
  hizb: number,
  readPages: ReadonlySet<number>,
  hizbPageRanges: readonly HizbPageRange[],
): number {
  const range = hizbPageRanges.find((candidate) => candidate.hizb === hizb);
  if (range === undefined) throw new RangeError(`There is no hizb ${hizb} in the page ranges.`);
  let left = 0;
  for (let page = range.firstPage; page <= range.lastPage; page += 1) {
    if (!readPages.has(page)) left += 1;
  }
  return left;
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
  const { dailyGoalPages, userSeed, pauses, lastOpenedPage } = settings;

  const feed = getGardenFeed(journal, hizbPageRanges);
  const gardenInput: GardenInput = {
    hizbCompleted: feed.hizbCompleted,
    currentHizbProgress: feed.currentHizbProgress,
    wateredDays: feed.wateredDays,
    firstHizbCompletedOn: feed.firstHizbCompletedOn,
    completedOn: feed.completedOn,
    today,
    pauses,
    variant: gardenVariant(feed.khatm, userSeed),
  };
  const garden = computeGardenState(gardenInput);

  // The khatma to read: the one in progress, or the next one when a khatma was just completed.
  const khatm = getCurrentKhatm(journal);
  const progress = getKhatmProgress(journal, khatm, hizbPageRanges);
  if (progress.firstUnreadPage === null) {
    throw new RangeError(`Khatma ${khatm} is the one to read, yet it has no unread page.`);
  }
  // The page to resume is the reader's (docs/specs/reader.md, section 1): the last page opened,
  // else the first unread page. The row and the button "Lire et arroser" must name the same page.
  if (lastOpenedPage !== null) assertPageNumber(lastOpenedPage);
  const estimatedFinishDate = estimateFinishDate(journal, khatm, today, {
    kind: 'daily-goal',
    dailyGoalPages,
  });

  const notice = chooseNotice({
    garden,
    showsCompletedKhatma: feed.completedOn !== null,
    isWateredToday: feed.wateredDays.has(today),
  });
  const layout = layoutOf(notice);
  const streakDays = getStreak(journal, today, pauses);
  // The garden on display is that of the khatma just completed while the next one has no page.
  const shownProgress =
    feed.khatm === khatm ? progress : getKhatmProgress(journal, feed.khatm, hizbPageRanges);
  const inProgress = shownProgress.currentHizb;
  const badge = getBadges(journal).find((candidate) => candidate.khatm === feed.khatm);

  return {
    status: 'ready',
    layout,
    hizb: {
      completed: garden.hizbCompleted,
      total: HIZB_COUNT,
      inProgress,
      pagesLeft:
        inProgress === null
          ? null
          : pagesLeftIn(inProgress, getReadPages(journal, feed.khatm), hizbPageRanges),
    },
    waterRun: waterRunOf(garden, streakDays),
    drought:
      layout === 'thirsty' || layout === 'dead'
        ? droughtOf(garden, gardenInput, DEFAULT_GARDEN_CONFIG.droughtDaysToDeath)
        : null,
    completedKhatma:
      layout === 'complete' && badge !== undefined
        ? {
            khatm: badge.khatm,
            hizb: HIZB_COUNT,
            pages: PAGE_COUNT,
            days: badge.daysTaken,
            nextKhatmaFirstPage: progress.firstUnreadPage,
          }
        : null,
    garden,
    notice,
    streakDays,
    today: getTodayProgress(journal, today, dailyGoalPages),
    reading: {
      khatm,
      nextPage: lastOpenedPage ?? progress.firstUnreadPage,
      hasStarted: progress.pagesRead > 0 || lastOpenedPage !== null,
      estimatedFinishDate,
      finishesToday: estimatedFinishDate === today,
    },
  };
}
