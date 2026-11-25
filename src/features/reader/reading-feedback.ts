/**
 * What to tell the person after a page was recorded (docs/specs/reader.md, section 3): nothing
 * when the page did not count, a short message when it did, and the name of the new element of
 * the garden when it completed a hizb. Every fact comes from the khatm and garden modules; this
 * file only compares the journal before and after.
 */

import type { GardenElementKind } from '@/domain/garden';
import { getGardenFeed, type HizbPageRange, type ReadingJournal } from '@/domain/khatm';
import type { LocalDate } from '@/domain/shared/local-date';
import { buildHomeModel, type HomeSettings } from '@/features/home';

export type ReadingFeedback =
  | {
      readonly kind: 'page-counted';
      /**
       * The element the pages of the hizb in progress grow (`GardenState.nextElement`), named in
       * the pill ("ton grenadier grandit"); null when nothing grows any more.
       */
      readonly growingKind: GardenElementKind | null;
    }
  | {
      readonly kind: 'hizb-completed';
      /** The kind of the element that just appeared: the garden's locale files name it. */
      readonly elementKind: GardenElementKind;
    };

export interface ReadingFeedbackInput {
  readonly before: ReadingJournal;
  readonly after: ReadingJournal;
  readonly settings: HomeSettings;
  readonly today: LocalDate;
  readonly hizbPageRanges: readonly HizbPageRange[];
}

export function readingFeedback({
  before,
  after,
  settings,
  today,
  hizbPageRanges,
}: ReadingFeedbackInput): ReadingFeedback | null {
  // The khatm module returns the very same journal for a page that does not count (D8).
  if (after === before) return null;
  const previous = getGardenFeed(before, hizbPageRanges);
  const current = getGardenFeed(after, hizbPageRanges);
  const completedHizb =
    current.khatm === previous.khatm && current.hizbCompleted > previous.hizbCompleted;
  const { garden } = buildHomeModel({ journal: after, settings, today, hizbPageRanges });
  const growingKind = garden.nextElement?.element.kind ?? null;
  if (!completedHizb || garden.lastUnlocked === null) return { kind: 'page-counted', growingKind };
  return { kind: 'hizb-completed', elementKind: garden.lastUnlocked.kind };
}
