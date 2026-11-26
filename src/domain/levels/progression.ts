import {
  getBadges,
  getCurrentKhatm,
  getKhatmProgress,
  type HizbPageRange,
  type ReadingJournal,
} from '@/domain/khatm';
import { daysBetween } from '@/domain/shared/local-date';

import { DEFAULT_LEVELS_CONFIG, FIRST_LEVEL, GARDEN_STYLES } from './config';
import { levelOfKhatma, styleOfLevel } from './levels';
import type { CelebrationInput, CompletedKhatma, LevelStep, Progression, ShelfItem } from './types';

/**
 * Where a person stands, derived from the reading journal alone. Nothing is stored beside it: the
 * journal is merged page by page between phones (docs/specs/sync.md), so a khatma completed
 * offline, or partly on two phones, gives everyone the same history once the pages meet.
 * Rejects a damaged journal or hizb ranges (RangeError), as the khatm module does.
 */
export function getProgression(
  journal: ReadingJournal,
  hizbPageRanges: readonly HizbPageRange[],
): Progression {
  const completed = getBadges(journal).map((badge): CompletedKhatma => {
    const level = levelOfKhatma(badge.khatm);
    return { ...badge, level, styleId: styleOfLevel(level) };
  });
  const currentKhatm = getCurrentKhatm(journal);
  const progress = getKhatmProgress(journal, currentKhatm, hizbPageRanges);
  const level = levelOfKhatma(currentKhatm);
  return {
    completed,
    currentKhatm,
    level,
    styleId: styleOfLevel(level),
    hasStarted: progress.pagesRead > 0,
    hizbCompleted: progress.hizbCompleted,
    maxLevel: GARDEN_STYLES.length,
  };
}

/**
 * The levels of this version, from the first: completed (with the khatma and the day that
 * completed them), the current one, and the levels to come, locked and told nothing of.
 */
export function levelPath(progression: Progression): readonly LevelStep[] {
  const steps: LevelStep[] = [];
  for (let level = FIRST_LEVEL; level <= progression.maxLevel; level += 1) {
    if (level < progression.level) {
      // The first khatma of a level completed it; only the last level has several khatmas.
      const first = progression.completed.find((khatma) => khatma.level === level);
      steps.push({
        level,
        status: 'completed',
        styleId: styleOfLevel(level),
        khatm: first?.khatm ?? null,
        completedOn: first?.completedOn ?? null,
      });
    } else if (level === progression.level) {
      steps.push({
        level,
        status: 'current',
        styleId: progression.styleId,
        khatm: progression.currentKhatm,
        completedOn: null,
      });
    } else {
      steps.push({ level, status: 'locked', styleId: null, khatm: null, completedOn: null });
    }
  }
  return steps;
}

/**
 * The badge shelf of the profile: every badge earned, the garden in progress, then the next level
 * as a locked surprise (none once the last level is reached).
 */
export function badgeShelf(progression: Progression): readonly ShelfItem[] {
  const shelf: ShelfItem[] = progression.completed.map((badge) => ({ kind: 'earned', badge }));
  shelf.push({
    kind: 'in-progress',
    khatm: progression.currentKhatm,
    level: progression.level,
    styleId: progression.styleId,
    hizbCompleted: progression.hizbCompleted,
  });
  if (progression.level < progression.maxLevel) {
    shelf.push({ kind: 'locked', level: progression.level + 1 });
  }
  return shelf;
}

/**
 * The khatma whose celebration is still to show, or null: the latest completed khatma, once,
 * while it is recent. A khatma completed after today's date (a phone in another time zone)
 * counts as completed today.
 */
export function khatmaToCelebrate({
  completed,
  celebratedKhatm,
  today,
  config = DEFAULT_LEVELS_CONFIG,
}: CelebrationInput): CompletedKhatma | null {
  if (!Number.isSafeInteger(celebratedKhatm) || celebratedKhatm < 0) {
    throw new RangeError(
      `Levels: the celebrated khatma is a whole number from 0, got ${celebratedKhatm}`,
    );
  }
  const latest = completed.at(-1);
  if (latest === undefined || latest.khatm <= celebratedKhatm) return null;
  const age = daysBetween(latest.completedOn, today);
  return age <= config.celebrationWindowDays ? latest : null;
}
