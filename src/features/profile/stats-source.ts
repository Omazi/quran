import type { ReadingJournal } from '@/domain/khatm';
import type { SecondsByDay } from '@/domain/stats';

/** What the statistics are computed from: the journal and the time the store keeps. */
export interface StatsSource {
  readonly journal: ReadingJournal;
  readonly timeSpent: SecondsByDay;
}
