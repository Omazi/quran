/**
 * DEVELOPMENT ONLY: a way to see every state of the home screen on a phone before the reader
 * exists, when a real journal can only show a bare earth.
 *
 * The choice lives in memory, in this module: it replaces what the home screen shows and nothing
 * else. It never reads or writes the store, so the person's journal and settings are untouched,
 * and it is forgotten when the app restarts. This file is loaded only when `__DEV__` is true
 * (see `home-screen.tsx` and `use-home-model.ts`): a production bundle does not contain it.
 *
 * Its words are written here, in French, and not in the locale files: they are for the
 * developer, and the locale files are part of the production bundle.
 */

import { useMemo, useSyncExternalStore } from 'react';

import { quranStructure } from '@/data/quran';
import type { LocalDate } from '@/domain/shared/local-date';
import { ChoiceRow, ListSection, type ChoiceOption } from '@/ui';

import type { HomeSource } from '../home-model';
import { buildReadingHistory, type ReadingHistoryName } from './reading-histories';

/** What the home screen shows: the person's own data, or one of the made-up histories. */
export type DevPreviewChoice = 'store' | ReadingHistoryName;

const OPTIONS: readonly ChoiceOption<DevPreviewChoice>[] = [
  { value: 'store', label: 'Mes vraies données' },
  { value: 'bare-earth', label: 'Terre nue' },
  { value: 'thriving', label: 'Florissant (hizb 24)' },
  { value: 'thirsty', label: 'Assoiffé (3 jours)' },
  { value: 'wilting', label: 'Fané (6 jours)' },
  { value: 'dying', label: 'Mourant (10 jours)' },
  { value: 'dead', label: 'Terre morte (14 jours)' },
  { value: 'recovering', label: 'Ranimé (une page après 14 jours)' },
  { value: 'khatma-complete', label: 'Khatma terminée' },
];

const WORDS = {
  title: 'Aperçu (développement)',
  label: 'État montré',
  footer:
    'Visible en développement seulement. Rien n’est enregistré : tes données ne changent pas.',
} as const;

let choice: DevPreviewChoice = 'store';
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDevPreviewChoice(): DevPreviewChoice {
  return choice;
}

export function setDevPreviewChoice(next: DevPreviewChoice): void {
  if (next === choice) return;
  choice = next;
  for (const listener of listeners) listener();
}

function useDevPreviewChoice(): DevPreviewChoice {
  return useSyncExternalStore(subscribe, getDevPreviewChoice);
}

/**
 * What the home screen shows: the person's data, unless a made-up history is chosen. A history
 * is built once for a choice and a day, since its story ends today.
 */
export function usePreviewedSource(source: HomeSource, today: LocalDate): HomeSource {
  const chosen = useDevPreviewChoice();
  const history = useMemo(
    () =>
      chosen === 'store'
        ? null
        : buildReadingHistory(chosen, today, quranStructure.hizbPageRanges()),
    [chosen, today],
  );
  return history ?? source;
}

/** The last section of the home screen in development: the choice of what it shows. */
export function DevPreviewSection() {
  const chosen = useDevPreviewChoice();
  return (
    <ListSection title={WORDS.title} footer={WORDS.footer}>
      <ChoiceRow
        label={WORDS.label}
        options={OPTIONS}
        value={chosen}
        onChange={setDevPreviewChoice}
        testID="home-dev-preview"
      />
    </ListSection>
  );
}
