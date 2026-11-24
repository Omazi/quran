/**
 * The garden in plain words and gauges, so that its rules stay visible while no image exists
 * (docs/specs/ui-lot1.md, B.2). Everything shown is read from the `GardenState`: nothing is
 * computed again here.
 *
 * Three pieces, because of where each can live on iOS. The two sections are rows of the system's
 * grouped list and must be inside a `GroupedList`. The water status is an icon beside words,
 * which a list row cannot hold: it is a React Native line and stays outside the list.
 */

import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { displayableVerse, type GardenState } from '@/domain/garden';
import { parseVerseKey } from '@/domain/quran';
import { AppText, Gauge, Icon, ListRow, ListSection, spacing } from '@/ui';

import {
  GARDEN_STEP_COUNT,
  HEALTH_TONES,
  NO_WATER_YET_ICON_COLOR,
  WATER_ICON_COLORS,
  WATER_SYMBOLS,
} from './config';
import { gardenElementName, gardenPhaseName, gardenWaterStatus, toPercent } from './garden-words';

export interface GardenReadoutProps {
  state: GardenState;
}

/**
 * The water: a symbol and a short sentence (flowing, still, dry). The symbol changes shape with
 * the state and the sentence says it, so colour is never the only signal (accessibility.md ›
 * Vision). One element for screen readers; the symbol is decorative, the sentence says it all.
 */
export function GardenWaterStatus({ state }: GardenReadoutProps) {
  const { t } = useTranslation('garden');
  const hasNoWaterYet = state.phase === 'bare';
  return (
    <View accessible style={styles.waterStatus} testID="garden-water">
      <Icon
        symbol={WATER_SYMBOLS[state.water]}
        color={hasNoWaterYet ? NO_WATER_YET_ICON_COLOR : WATER_ICON_COLORS[state.water]}
      />
      <AppText style={styles.waterWords}>{gardenWaterStatus(state, t)}</AppText>
    </View>
  );
}

/**
 * How far the garden is and how well it is: two system gauges, each with its value in words and
 * both ends of its range (gauges.md › Best practices). A gauge, not a progress indicator: these
 * are levels that last, not a task being waited for. Place it in a `GroupedList`.
 */
export function GardenStateSection({ state }: GardenReadoutProps) {
  const { t } = useTranslation('garden');
  return (
    <ListSection title={t('readout.state.title')}>
      <Gauge
        value={state.hizbCompleted / GARDEN_STEP_COUNT}
        label={t('readout.hizb.label')}
        valueLabel={t('readout.hizb.value', {
          hizb: state.hizbCompleted,
          total: GARDEN_STEP_COUNT,
        })}
        minimumLabel={t('readout.hizb.minimum')}
        maximumLabel={t('readout.hizb.maximum', { total: GARDEN_STEP_COUNT })}
        testID="garden-hizb-gauge"
      />
      {
        // Before the first hizb the garden does not exist yet: nothing can dry, so there is no
        // health to show.
        state.phase === 'bare' ? null : (
          <Gauge
            value={state.health}
            label={t('readout.health.label')}
            valueLabel={t('readout.health.value', {
              phase: gardenPhaseName(state.phase, t),
              percent: toPercent(state.health),
            })}
            minimumLabel={t('readout.health.minimum')}
            maximumLabel={t('readout.health.maximum')}
            tone={HEALTH_TONES[state.phase]}
            testID="garden-health-gauge"
          />
        )
      }
    </ListSection>
  );
}

/**
 * What the reading earns: the element growing with the hizb in progress, the last element
 * earned, and how many elements a drying garden still shows. A verse is shown only when the
 * garden module says it may be (`displayableVerse`): none is today. Place it in a `GroupedList`.
 */
export function GardenElementsSection({ state }: GardenReadoutProps) {
  const { t } = useTranslation('garden');
  const { nextElement, lastUnlocked } = state;
  const verseKey = lastUnlocked === null ? null : displayableVerse(lastUnlocked);
  const verse = verseKey === null ? null : parseVerseKey(verseKey);
  const hidesElements = state.visibleElements.length < state.hizbCompleted;
  return (
    <ListSection title={t('readout.elements.title')}>
      {nextElement === null ? null : (
        <ListRow
          label={t('readout.next.label')}
          value={t('readout.next.value', {
            element: gardenElementName(nextElement.element, t),
            percent: toPercent(nextElement.growth),
          })}
          testID="garden-next-element"
        />
      )}
      {lastUnlocked === null ? null : (
        <ListRow
          label={t('readout.last.label')}
          value={gardenElementName(lastUnlocked, t)}
          testID="garden-last-element"
        />
      )}
      {verse === null ? null : (
        <ListRow
          label={t('readout.verse.label')}
          value={t('readout.verse.value', { surah: verse.surah, ayah: verse.verse })}
          testID="garden-verse"
        />
      )}
      {hidesElements ? (
        <ListRow
          label={t('readout.visible.label')}
          value={t('readout.visible.value', {
            visible: state.visibleElements.length,
            unlocked: state.hizbCompleted,
          })}
          testID="garden-visible-elements"
        />
      ) : null}
      {state.isPausedToday ? (
        <ListRow
          label={t('readout.pause.label')}
          value={t('readout.pause.value')}
          testID="garden-pause"
        />
      ) : null}
    </ListSection>
  );
}

const styles = StyleSheet.create({
  waterStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  // The words wrap beside the symbol instead of being cut at large text sizes.
  waterWords: { flexShrink: 1 },
});
