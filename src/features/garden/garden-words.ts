/**
 * The garden in words: the names and sentences that describe a `GardenState`. Every word comes
 * from the `garden` locale files; these functions only choose which one, from the values the
 * garden module computed. They hold no rule of the garden.
 *
 * One word per state, the same wherever the state is named: on the scene, in its accessibility
 * label and beside the health gauge (writing.md › Best practices: build language patterns).
 */

import type { TFunction } from 'i18next';

import type { GardenElement, GardenPhase, GardenState } from '@/domain/garden';

import { GARDEN_STEP_COUNT } from './config';

/** The translation function of the `garden` namespace. */
export type GardenTranslate = TFunction<'garden'>;

/**
 * The state a garden is named by: its phase, or `revived` on a day of drought the person has
 * already watered. The garden still shows its drought that day, but it is not named by it: the
 * water is back, and the words must not say otherwise.
 */
export type GardenStateName = GardenPhase | 'revived';

const PERCENT = 100;

/** A fraction between 0 and 1 as a whole percentage. */
export function toPercent(fraction: number): number {
  return Math.round(fraction * PERCENT);
}

export function gardenStateName(state: GardenState): GardenStateName {
  const showsDrought = state.phase !== 'bare' && state.phase !== 'thriving';
  return showsDrought && state.daysSinceLastWatered === 0 ? 'revived' : state.phase;
}

/** The word of the state, as written beside the health gauge: "Assoiffé". */
export function gardenStateWord(state: GardenState, t: GardenTranslate): string {
  return t(`states.${gardenStateName(state)}`);
}

/** A complete garden in full health has a name of its own; otherwise the state names it. */
function sceneWording(state: GardenState): GardenStateName | 'complete' {
  return state.isComplete && state.phase === 'thriving' ? 'complete' : gardenStateName(state);
}

/** What the missing image will show, written on the placeholder: "Jardin au hizb 24". */
export function gardenSceneName(state: GardenState, t: GardenTranslate): string {
  return t(`scene.name.${sceneWording(state)}`, { hizb: state.hizbCompleted });
}

/** The state in one sentence, for screen readers: "Jardin, 24 hizb sur 60, l'eau coule". */
export function gardenSceneLabel(state: GardenState, t: GardenTranslate): string {
  return t(`scene.label.${sceneWording(state)}`, {
    hizb: state.hizbCompleted,
    total: GARDEN_STEP_COUNT,
    water: t(`water.clause.${state.water}`),
  });
}

/** The water in a short sentence. On the bare earth there is no water yet, and nothing dried. */
export function gardenWaterStatus(state: GardenState, t: GardenTranslate): string {
  return state.phase === 'bare' ? t('water.status.none') : t(`water.status.${state.water}`);
}

/**
 * The name of an element, from its kind. Several elements share a kind ("bed-1", "bed-2"): the
 * locale files translate the kinds, never the ids.
 */
export function gardenElementName(element: GardenElement, t: GardenTranslate): string {
  return t(`kinds.${element.kind}`);
}
