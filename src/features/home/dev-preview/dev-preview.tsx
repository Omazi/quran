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

import { useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { quranStructure } from '@/data/quran';
import type { LocalDate } from '@/domain/shared/local-date';
import { AppText, layout, radius, spacing, stateOpacity, useColors } from '@/ui';

import { DismissibleSheet } from '../dismissible-sheet';
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
  hint: 'Appui long : aperçu des états du jardin (versions de test)',
  close: 'Fermer l’aperçu des états',
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

/** What the home screen needs to offer the preview: the trigger, and the sheet it opens. */
export interface StatePreviewHandle {
  /** Opens the sheet: given to the long-press on the date. */
  readonly open: () => void;
  /** What VoiceOver says of the long-press (developer words, so French and not i18n). */
  readonly hint: string;
  /** The sheet while it is open, null otherwise: nothing of the preview is on the garden. */
  readonly sheet: ReactNode;
}

/**
 * The preview as a sheet, opened by a long-press on the home screen's date: it never sits over
 * the garden, so a photograph of the screen shows the home as a person sees it.
 */
export function useStatePreviewSheet(): StatePreviewHandle {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  return {
    open,
    hint: WORDS.hint,
    sheet: isOpen ? <DevPreviewSheet onDismiss={close} /> : null,
  };
}

function DevPreviewSheet({ onDismiss }: { onDismiss: () => void }) {
  const chosen = useDevPreviewChoice();
  const colors = useColors();
  const { height } = useWindowDimensions();
  return (
    <DismissibleSheet
      onDismiss={onDismiss}
      closeLabel={WORDS.close}
      testID="home-dev-preview-section"
      closeTestID="home-dev-preview-close"
    >
      <ScrollView style={{ maxHeight: height / 2 }}>
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
      </ScrollView>
    </DismissibleSheet>
  );
}

const styles = StyleSheet.create({
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
