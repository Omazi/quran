import type { DimensionValue } from 'react-native';

/**
 * Width of the garden at the head of the profile, against the width of the list. Narrower than
 * the band of the home screen: here the garden is the person's emblem above their figures, and
 * the hasanat figure must still be in the first screen of an iPhone (layout.md › Visual
 * hierarchy). Deviation 53 of the register.
 */
export const PROFILE_GARDEN_PICTURE_WIDTH: DimensionValue = '72%';

/** Named settings of the profile's statistics section. */
export const PROFILE_STATS_CONFIG = {
  /** "Aujourd'hui" shows today among the six days before it, so the day has a context. */
  daysShownForToday: 7,
  /** The whole history is shown month by month, over the last twelve months. */
  monthsShownForAllTime: 12,
  /** Foreground time is handed to the store in batches, at most this often (D37). */
  foregroundFlushIntervalMs: 60_000,
} as const;
