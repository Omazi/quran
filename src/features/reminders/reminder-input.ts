import { gardenVariant } from '@/domain/garden';
import {
  getGardenFeed,
  getTodayProgress,
  type HizbPageRange,
  type Pause,
  type ReadingJournal,
} from '@/domain/khatm';
import type { LocalMoment, ReminderSettings, RemindersInput } from '@/domain/reminders';
import { quranStructure } from '@/data/quran';
import { pageSurah, resolveResumePage } from '@/features/reader';

import type { ReminderResume } from './reminder-copy';

/** What the plan needs from the store of the app. */
export interface ReminderSource {
  readonly journal: ReadingJournal;
  readonly dailyGoalPages: number;
  readonly userSeed: number;
  readonly pauses: readonly Pause[];
  readonly reminders: ReminderSettings;
  /** The last page opened in the reader, or null: where the reminders say to resume. */
  readonly lastOpenedPage: number | null;
}

/**
 * The input of the reminders planner, from the journal and the settings. The garden is the one
 * of the home screen (same feed, same variant); nothing about it is decided here. Throws what the
 * khatm and garden modules throw for a damaged journal: the caller leaves the notifications as
 * they are then.
 */
export function buildReminderInput(
  { journal, dailyGoalPages, userSeed, pauses, reminders }: ReminderSource,
  now: LocalMoment,
  hizbPageRanges: readonly HizbPageRange[],
): RemindersInput {
  const feed = getGardenFeed(journal, hizbPageRanges);
  return {
    garden: {
      hizbCompleted: feed.hizbCompleted,
      currentHizbProgress: feed.currentHizbProgress,
      wateredDays: feed.wateredDays,
      firstHizbCompletedOn: feed.firstHizbCompletedOn,
      completedOn: feed.completedOn,
      pauses,
      variant: gardenVariant(feed.khatm, userSeed),
    },
    now,
    dailyGoalPages,
    // The reminders count the new pages of today, as the goal does (rereading does not count).
    pagesReadToday: getTodayProgress(journal, now.date, dailyGoalPages).pagesRead,
    settings: reminders,
  };
}

/**
 * Where the reminders say to resume: the page the reader opens when a reminder is tapped (the same
 * `resolveResumePage`, read again at the moment of the tap) and the surah it is named after. Null
 * while there is no place to resume yet (the reader was never opened and nothing was read): the
 * text then says the first page, which is where the reader opens.
 */
export function buildReminderResume(
  { journal, lastOpenedPage }: Pick<ReminderSource, 'journal' | 'lastOpenedPage'>,
  hizbPageRanges: readonly HizbPageRange[],
): ReminderResume | null {
  if (lastOpenedPage === null && journal.length === 0) return null;
  const page = resolveResumePage({ lastOpenedPage, journal, hizbPageRanges });
  return { page, surah: pageSurah(quranStructure, page) };
}
