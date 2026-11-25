/** Named settings of the profile's statistics section. */
export const PROFILE_STATS_CONFIG = {
  /** "Aujourd'hui" shows today among the six days before it, so the day has a context. */
  daysShownForToday: 7,
  /** The whole history is shown month by month, over the last twelve months. */
  monthsShownForAllTime: 12,
  /** Foreground time is handed to the store in batches, at most this often (D37). */
  foregroundFlushIntervalMs: 60_000,
} as const;
