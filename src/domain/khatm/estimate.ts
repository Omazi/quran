import { PAGE_COUNT } from '@/domain/quran/types';
import { addDays, type LocalDate } from '@/domain/shared/local-date';
import { DEFAULT_KHATM_CONFIG } from './config';
import { countPagesReadInLastDays } from './daily';
import { getReadPages } from './journal';
import type { KhatmConfig, PaceSource, ReadingJournal } from './types';
import { assertConfig, assertLocalDate } from './validation';

/** A reading pace kept as "pages over days" so the estimate stays in whole-number maths. */
interface Pace {
  readonly pages: number;
  readonly days: number;
}

function getPace(
  journal: ReadingJournal,
  today: LocalDate,
  paceSource: PaceSource,
  config: KhatmConfig,
): Pace {
  switch (paceSource) {
    case 'daily-goal':
      return { pages: config.dailyGoalPages, days: 1 };
    case 'recent-average': {
      const windowDays = config.averagePaceWindowDays;
      return { pages: countPagesReadInLastDays(journal, today, windowDays), days: windowDays };
    }
    default:
      throw new TypeError(`Unknown pace source: "${String(paceSource)}"`);
  }
}

/**
 * Spec rule 8: the day the khatma would be finished at the given pace, that is today plus
 * `pages remaining / pace` days, rounded up to a whole day.
 *
 * Returns null when there is nothing to estimate: the pace is zero (no reading in the
 * recent days), or the khatma is already complete.
 */
export function estimateFinishDate(
  journal: ReadingJournal,
  khatm: number,
  today: LocalDate,
  paceSource: PaceSource = 'daily-goal',
  config: KhatmConfig = DEFAULT_KHATM_CONFIG,
): LocalDate | null {
  assertLocalDate(today, 'today');
  assertConfig(config);
  const pagesRemaining = PAGE_COUNT - getReadPages(journal, khatm).size;
  const pace = getPace(journal, today, paceSource, config);
  if (pagesRemaining === 0 || pace.pages === 0) return null;

  const daysNeeded = Math.ceil((pagesRemaining * pace.days) / pace.pages);
  return addDays(today, daysNeeded);
}
