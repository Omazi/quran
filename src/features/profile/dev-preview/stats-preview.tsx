/**
 * PREVIEW ONLY: an example history to see the statistics with numbers in them, before a person
 * has read for months. Loaded only through `../state-preview.ts` (development and test builds).
 *
 * The choice lives in memory, here: it replaces what the profile shows and nothing else. It never
 * reads or writes the store. The words are in French and written here, not in the locale files:
 * they are for the owner and the developers.
 */

import { useMemo, useSyncExternalStore } from 'react';

import { EMPTY_JOURNAL, recordPageRead } from '@/domain/khatm';
import { PAGE_COUNT } from '@/domain/quran';
import { addDays, type LocalDate } from '@/domain/shared/local-date';
import type { DaySeconds } from '@/domain/stats';
import { useToday } from '@/features/home';
import { StyleSheet, View } from 'react-native';

import { AppText, Card, SegmentedChoice, spacing, type ChoiceOption } from '@/ui';

import type { StatsSource } from '../stats-source';

export type StatsPreviewChoice = 'store' | 'example';

const OPTIONS: readonly ChoiceOption<StatsPreviewChoice>[] = [
  { value: 'store', label: 'Mes données' },
  { value: 'example', label: 'Exemple (11 mois)' },
];

const WORDS = {
  title: 'Aperçu des statistiques',
  label: 'Données montrées',
  footer:
    'Visible dans les versions de test seulement. Rien n’est enregistré : tes données ne changent pas.',
} as const;

/** The numbers of the example. They are examples, not rules of the app. */
export const STATS_EXAMPLE = {
  days: 330,
  /** Pages read on successive days, repeated: a real rhythm has gaps and long days. */
  pagesPattern: [3, 5, 0, 4, 2, 8, 6, 1, 0, 5, 3, 4, 7, 2],
  readerSecondsPerPage: 85,
  /** The app is open a little longer than the reader, on the garden. */
  appSecondsBesideReading: 70,
} as const;

/** The example history, ending today: about a khatma and a half, read page by page. */
export function buildStatsExample(today: LocalDate): StatsSource {
  let journal = EMPTY_JOURNAL;
  const timeSpent: Record<LocalDate, DaySeconds> = {};
  let page = 1;
  const { days, pagesPattern, readerSecondsPerPage, appSecondsBesideReading } = STATS_EXAMPLE;
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = addDays(today, -offset);
    const pages = pagesPattern[offset % pagesPattern.length] ?? 0;
    for (let count = 0; count < pages; count += 1) {
      journal = recordPageRead(journal, { page, date });
      page = page === PAGE_COUNT ? 1 : page + 1;
    }
    const reader = pages * readerSecondsPerPage;
    timeSpent[date] = { app: reader + appSecondsBesideReading, reader };
  }
  return { journal, timeSpent };
}

let choice: StatsPreviewChoice = 'store';
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setStatsPreviewChoice(next: StatsPreviewChoice): void {
  if (next === choice) return;
  choice = next;
  for (const listener of listeners) listener();
}

function useStatsPreviewChoice(): StatsPreviewChoice {
  return useSyncExternalStore(subscribe, () => choice);
}

export function usePreviewedStatsSource(source: StatsSource): StatsSource {
  const chosen = useStatsPreviewChoice();
  const today = useToday();
  const example = useMemo(
    () => (chosen === 'example' ? buildStatsExample(today) : null),
    [chosen, today],
  );
  return example ?? source;
}

/** A quiet card at the end of the profile, outside any list: the profile is built of cards. */
export function StatsPreviewSection() {
  const chosen = useStatsPreviewChoice();
  return (
    <Card tone="quiet" testID="profile-stats-preview-section">
      <View style={styles.column}>
        <AppText variant="subheadEmphasized">{WORDS.title}</AppText>
        <SegmentedChoice
          label={WORDS.label}
          options={OPTIONS}
          value={chosen}
          onChange={setStatsPreviewChoice}
          testID="profile-stats-preview"
        />
        <AppText variant="footnote" color="muted">
          {WORDS.footer}
        </AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  column: { rowGap: spacing.sm },
});
