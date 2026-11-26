/**
 * The goal plan of the first-launch flow: what "1 month", "3 months", "1 year" or "my own pace"
 * means in pages a day, end date and hizb after 30 days, and the moment of the day the person
 * reads, mapped to the daily reminder. See docs/specs/goal-plan.md.
 */
export { computeGoalPlan, goalPagesPerDay } from './compute-goal-plan';
export {
  DEFAULT_OWN_PACE_PAGES,
  DEFAULT_REMINDERS_CHOICES,
  GOAL_KINDS,
  READING_MOMENT_TIMES,
  READING_MOMENTS,
} from './config';
export { readingMomentAt, readingMomentTime, remindersForReadingMoment } from './reading-moment';
export type { Goal, GoalKind, GoalPlan, ReadingMoment, ReminderChoices } from './types';
