/** Settings of the Quran data layer. */
export const QURAN_DATA_CONFIG = Object.freeze({
  /**
   * Pages stored in each file of `assets/data/pages`. Decided by tools/quran-data and
   * recorded in `assets/data/integrity.json` (`pagesPerFile`); a test keeps both in step.
   */
  pagesPerFile: 20,
  /** Page files kept in memory at once: the one being read and its two neighbours. */
  maxCachedPageFiles: 3,
});
