import { compareLocalDates, type LocalDate } from '@/domain/shared/local-date';
import { DEFAULT_KHATM_CONFIG, FIRST_KHATM } from './config';
import { selectWateredDays } from './daily';
import { summarizeJournal, type KhatmSummary } from './journal-summary';
import { measureKhatmProgress } from './progress';
import type { GardenFeed, HizbPageRange, KhatmConfig, ReadingJournal } from './types';
import { assertConfig, assertHizbPageRanges } from './validation';

const NO_PAGE_READ: ReadonlySet<number> = new Set<number>();

function keepDaysFrom(days: ReadonlySet<LocalDate>, firstDay: LocalDate): Set<LocalDate> {
  const kept = new Set<LocalDate>();
  for (const day of days) {
    if (compareLocalDates(day, firstDay) >= 0) kept.add(day);
  }
  return kept;
}

/**
 * The date of each page read in a khatma. The journal has already been checked by
 * `summarizeJournal`: a page has at most one entry per khatma.
 */
function collectPageDates(journal: ReadingJournal, khatm: number): Map<number, LocalDate> {
  const pageDates = new Map<number, LocalDate>();
  for (const entry of journal) {
    if (entry.khatm === khatm) pageDates.set(entry.page, entry.date);
  }
  return pageDates;
}

/**
 * The day a hizb was completed: the most recent date among its pages (spec rule 10), or
 * null while one of its pages is not read. Dates are compared, not the order of the
 * entries: a page can be recorded for a past day.
 */
function findHizbCompletionDay(
  pageDates: ReadonlyMap<number, LocalDate>,
  range: HizbPageRange,
): LocalDate | null {
  let latest: LocalDate | null = null;
  for (let page = range.firstPage; page <= range.lastPage; page += 1) {
    const date = pageDates.get(page);
    if (date === undefined) return null;
    if (latest === null || compareLocalDates(date, latest) > 0) latest = date;
  }
  return latest;
}

/** The earliest completion day over the completed hizb, or null while no hizb is completed. */
function findFirstHizbCompletionDay(
  pageDates: ReadonlyMap<number, LocalDate>,
  hizbPageRanges: readonly HizbPageRange[],
): LocalDate | null {
  let earliest: LocalDate | null = null;
  for (const range of hizbPageRanges) {
    const completedOn = findHizbCompletionDay(pageDates, range);
    if (completedOn === null) continue;
    if (earliest === null || compareLocalDates(completedOn, earliest) < 0) earliest = completedOn;
  }
  return earliest;
}

/**
 * Spec rule 10, the complete garden stays on display: while the khatma in progress has no
 * page yet, the garden to show is the one of the khatma just completed. It only gives way
 * to the next garden with the first page of the next khatma.
 */
function findKhatmOnDisplay(
  khatmas: ReadonlyMap<number, KhatmSummary>,
  currentKhatm: number,
): number {
  const hasCurrentKhatmStarted = khatmas.has(currentKhatm);
  const hasCompletedKhatm = currentKhatm > FIRST_KHATM;
  return !hasCurrentKhatmStarted && hasCompletedKhatm ? currentKhatm - 1 : currentKhatm;
}

/**
 * Everything the garden on display needs from the journal, in one call (spec rule 10;
 * inputs of docs/specs/garden.md: `hizbCompleted`, `currentHizbProgress`, `wateredDays`,
 * `startDate`).
 *
 * There is one garden per khatma (docs/DECISIONS.md, D9). The feed describes the khatma in
 * progress; right after a khatma is completed it keeps describing that khatma, with its 60
 * hizb, until the next one gets its first page. For an empty journal it is the bare ground
 * of khatma 1, with no start date.
 *
 * `wateredDays` holds the watered days from `startDate` onwards. Whether a day is watered
 * is decided once, for all khatmas together (the same days as `getWateredDays` and the
 * streak): the day a khatma ends and the next one starts is one watered day, not two
 * half-days. Earlier days belong to previous gardens and are left out, so the set stays
 * small however many khatmas the user has completed.
 *
 * `firstHizbCompletedOn` and `completedOn` tell the garden when it starts to dry (the day
 * its first hizb is completed) and when it stops changing (the day the khatma is completed).
 */
export function getGardenFeed(
  journal: ReadingJournal,
  hizbPageRanges: readonly HizbPageRange[],
  config: KhatmConfig = DEFAULT_KHATM_CONFIG,
): GardenFeed {
  assertHizbPageRanges(hizbPageRanges);
  assertConfig(config);
  const { khatmas, newPagesByDay, currentKhatm } = summarizeJournal(journal);

  const khatm = findKhatmOnDisplay(khatmas, currentKhatm);
  // Undefined only for an empty journal: no page has ever been read.
  const started = khatmas.get(khatm);
  const readPages = started?.readPages ?? NO_PAGE_READ;
  const progress = measureKhatmProgress(khatm, readPages, hizbPageRanges);
  const startDate = started?.firstDate ?? null;
  const wateredDays =
    startDate === null
      ? new Set<LocalDate>()
      : keepDaysFrom(selectWateredDays(newPagesByDay, config), startDate);
  const isComplete = started !== undefined && progress.isComplete;

  return {
    khatm,
    hizbCompleted: progress.hizbCompleted,
    currentHizbProgress: progress.currentHizbProgress,
    startDate,
    wateredDays,
    firstHizbCompletedOn: findFirstHizbCompletionDay(
      collectPageDates(journal, khatm),
      hizbPageRanges,
    ),
    // The latest reading date of a completed khatma: the same day as on its badge.
    completedOn: isComplete ? started.lastDate : null,
  };
}
