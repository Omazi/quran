import type { IconSymbol, SpacingToken } from '@/ui';

import type { StatsMetric } from './stats-model';

/** Named settings of the profile's statistics section. */
export const PROFILE_STATS_CONFIG = {
  /** "Aujourd'hui" shows today among the six days before it, so the day has a context. */
  daysShownForToday: 7,
  /** The whole history is shown month by month, over the last twelve months. */
  monthsShownForAllTime: 12,
  /** Foreground time is handed to the store in batches, at most this often (D37). */
  foregroundFlushIntervalMs: 60_000,
} as const;

/**
 * Room above the content for the gradient, as on the home screen: the status bar and the bounce of
 * the scroll view, so the top of the tab never shows the bare canvas. In steps of `xxl`.
 */
export const PROFILE_PULL_ROOM_STEPS = 4;

/** How far the first card rises over the end of the gradient, as the home screen's cards do. */
export const PROFILE_CARDS_RISE: SpacingToken = 'xl';

/**
 * Symbols of the profile. Outline symbols beside words (sf-symbols.md › Design variants), each
 * with its Material equivalent for Android and the web.
 */
export const PROFILE_SYMBOLS = {
  drop: { ios: 'drop.fill', android: 'water_drop' },
  leaf: { ios: 'leaf.fill', android: 'eco' },
  completed: { ios: 'checkmark.seal.fill', android: 'verified' },
  settings: { ios: 'gearshape', android: 'settings' },
  disclosure: { ios: 'chevron.forward', android: 'chevron_right' },
  failed: { ios: 'exclamationmark.circle', android: 'error' },
  notice: { ios: 'info.circle', android: 'info' },
} as const satisfies Record<string, IconSymbol>;

/** The symbol beside each figure of the list that picks what the chart follows. */
export const FIGURE_SYMBOLS: Readonly<Record<StatsMetric, IconSymbol>> = {
  hasanat: { ios: 'sparkles', android: 'auto_awesome' },
  verses: { ios: 'text.book.closed', android: 'menu_book' },
  words: { ios: 'textformat', android: 'text_fields' },
  pages: { ios: 'book.pages', android: 'auto_stories' },
  readingTime: { ios: 'clock', android: 'schedule' },
};
