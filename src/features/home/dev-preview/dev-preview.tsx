/**
 * PREVIEW ONLY: a way to see every state of the home screen on a phone before the reader exists,
 * when a real journal can only show a bare earth.
 *
 * The choice lives in memory, in this module: it replaces what the home screen shows and nothing
 * else. It never reads or writes the store, so the person's journal and settings are untouched,
 * and it is forgotten when the app restarts. This file is loaded only through `state-preview.ts`:
 * in development, and in a test build made with `EXPO_PUBLIC_STATE_PREVIEW=1`. A production
 * bundle does not contain it.
 *
 * Its words are written here, in French, and not in the locale files: they are for the owner
 * and the developers, and the locale files are part of the production bundle.
 */

import { useMemo, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { quranStructure } from '@/data/quran';
import type { LocalDate } from '@/domain/shared/local-date';
import { AppText, Card, layout, radius, spacing, stateOpacity, useColors } from '@/ui';

import type { HomeSource } from '../home-model';
import { buildReadingHistory, type ReadingHistoryName } from './reading-histories';

/** What the home screen shows: the person's own data, or one of the made-up histories. */
export type DevPreviewChoice = 'store' | ReadingHistoryName;

const OPTIONS: readonly { value: DevPreviewChoice; label: string }[] = [
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
  title: 'Aperçu des états',
  footer:
    'Visible dans les versions de test seulement. Rien n’est enregistré : tes données ne changent pas.',
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

/** The last part of the home screen where the preview exists: the choice of what it shows. */
export function DevPreviewSection() {
  const chosen = useDevPreviewChoice();
  const colors = useColors();
  return (
    <View style={styles.section} testID="home-dev-preview-section">
      <Card tone="quiet">
        <AppText variant="headline" accessibilityRole="header">
          {WORDS.title}
        </AppText>
        <View accessibilityRole="radiogroup" style={styles.options} testID="home-dev-preview">
          {OPTIONS.map((option) => {
            const isSelected = option.value === chosen;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityLabel={option.label}
                accessibilityState={{ checked: isSelected }}
                onPress={() => setDevPreviewChoice(option.value)}
                style={({ pressed }) => [
                  styles.option,
                  { backgroundColor: isSelected ? colors.action : colors.actionTonal },
                  pressed && styles.pressed,
                ]}
              >
                <AppText variant="subhead" color={isSelected ? 'onAction' : 'actionTint'}>
                  {option.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        <AppText variant="footnote" color="muted">
          {WORDS.footer}
        </AppText>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: layout.screenMargin, paddingTop: spacing.lg },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginVertical: layout.controlGap,
  },
  option: {
    minHeight: layout.touchTarget,
    justifyContent: 'center',
    paddingHorizontal: layout.controlGap,
    borderRadius: radius.full,
  },
  pressed: { opacity: stateOpacity.pressed },
});
