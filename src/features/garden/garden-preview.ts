import {
  computeGardenState,
  REFERENCE_GARDEN_VARIANT,
  type GardenState,
  type GardenVariant,
} from '@/domain/garden';
import { addDays, parseLocalDate, type LocalDate } from '@/domain/shared/local-date';

/** A garden to show without a reading journal, as the first-launch flow does. */
export interface GardenPreview {
  /**
   * Hizb finished, 0 to 60. 0 is the bare earth; 60 is the complete garden, which the garden
   * module may show in full health whatever the days without reading.
   */
  readonly hizbCompleted: number;
  /**
   * Whole days missed in a row, after a garden in full health. Today is not one of them: the day
   * in progress is still open. Defaults to 0.
   */
  readonly daysWithoutReading?: number;
  /** True when the person reads again today, after those days: the garden coming back to life. */
  readonly readsToday?: boolean;
  /** Which garden to show. Defaults to the reference variant of the garden module. */
  readonly variant?: GardenVariant;
}

/**
 * The day the preview is computed for. Any day gives the same garden: a `GardenState` holds no
 * date, and the rules only count days.
 */
const PREVIEW_TODAY = parseLocalDate('2026-01-01');

/**
 * The garden at "hizb n, after d days without reading".
 *
 * It tells the garden module a short story and lets it apply its own rules: the person finished
 * their hizb and read on one day, then missed `daysWithoutReading` days, and today is in
 * progress. Phase, health, water and visible elements all come from `computeGardenState`; none
 * is decided here.
 *
 * Throws a `RangeError` when `daysWithoutReading` is not a whole number of days, 0 or more; the
 * garden module rejects a number of hizb outside 0 to 60.
 */
export function previewGardenState({
  hizbCompleted,
  daysWithoutReading = 0,
  readsToday = false,
  variant = REFERENCE_GARDEN_VARIANT,
}: GardenPreview): GardenState {
  if (!Number.isInteger(daysWithoutReading) || daysWithoutReading < 0) {
    throw new RangeError(
      `daysWithoutReading must be a whole number of days, 0 or more: received ${daysWithoutReading}.`,
    );
  }
  const lastReadingDay = addDays(PREVIEW_TODAY, -(daysWithoutReading + 1));
  const wateredDays = new Set<LocalDate>([lastReadingDay]);
  if (readsToday) wateredDays.add(PREVIEW_TODAY);
  return computeGardenState({
    hizbCompleted,
    currentHizbProgress: 0,
    wateredDays,
    // The garden module's own contract: no date while no hizb is finished.
    firstHizbCompletedOn: hizbCompleted === 0 ? null : lastReadingDay,
    // A preview has no journal, so no khatma was finished on a known day. What a garden of 60
    // hizb looks like after days without reading is the garden module's decision, not this one's.
    completedOn: null,
    today: PREVIEW_TODAY,
    pauses: [],
    variant,
  });
}
