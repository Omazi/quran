import { gardenVariant } from '@/domain/garden';
import {
  getGardenFeed,
  getTodayProgress,
  type HizbPageRange,
  type Pause,
  type ReadingJournal,
} from '@/domain/khatm';
import type { LocalMoment, ReminderSettings, RemindersInput } from '@/domain/reminders';

/** What the plan needs from the store of the app. */
export interface ReminderSource {
  readonly journal: ReadingJournal;
  readonly dailyGoalPages: number;
  readonly userSeed: number;
  readonly pauses: readonly Pause[];
  readonly reminders: ReminderSettings;
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
