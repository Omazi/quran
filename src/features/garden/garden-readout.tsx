/**
 * The garden in plain words and gauges, so that its rules stay visible while no image exists
 * (docs/specs/ui-lot1.md, B.2). Everything shown is read from the `GardenState`: nothing is
 * computed again here. All three pieces are rows of the system's grouped list: place them in a
 * `GroupedList`.
 */

import { useTranslation } from 'react-i18next';

import { displayableVerse, type GardenState } from '@/domain/garden';
import { parseVerseKey } from '@/domain/quran';
import { Gauge, LabelRow, ListRow, ListSection } from '@/ui';

import {
  GARDEN_STEP_COUNT,
  HEALTH_TONES,
  HIZB_TONE,
  NO_WATER_YET_TONE,
  WATER_SYMBOLS,
  WATER_TONES,
} from './config';
import { gardenElementName, gardenStateWord, gardenWaterStatus, toPercent } from './garden-words';

export interface GardenReadoutProps {
  state: GardenState;
}

/**
 * The water: a symbol and a short sentence (flowing, still, dry), as a row of the list
 * (labels.md › Best practices). The symbol changes shape with the state and the sentence says
 * it, so colour is never the only signal (accessibility.md › Vision). Its own row, alone in a
 * section or with other rows of status.
 */
export function GardenWaterRow({ state }: GardenReadoutProps) {
  const { t } = useTranslation('garden');
  return (
    <LabelRow
      label={gardenWaterStatus(state, t)}
      symbol={WATER_SYMBOLS[state.water]}
      tone={state.phase === 'bare' ? NO_WATER_YET_TONE : WATER_TONES[state.water]}
      testID="garden-water"
    />
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
        tone={HIZB_TONE}
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
              state: gardenStateWord(state, t),
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
