/**
 * The garden in words: the names and sentences that describe a `GardenState`. Every word comes
 * from the `garden` locale files; these functions only choose which one, from the values the
 * garden module computed. They hold no rule of the garden.
 */

import type { TFunction } from 'i18next';

import type { GardenElement, GardenPhase, GardenState } from '@/domain/garden';

import { GARDEN_STEP_COUNT } from './config';

/** The translation function of the `garden` namespace. */
export type GardenTranslate = TFunction<'garden'>;

const PERCENT = 100;

/** A fraction between 0 and 1 as a whole percentage. */
export function toPercent(fraction: number): number {
  return Math.round(fraction * PERCENT);
}

/**
 * Which name a scene takes. A complete garden in full health has a name of its own; while it
 * dries, its phase is what there is to say.
 */
function sceneWording(state: GardenState): GardenPhase | 'complete' {
  return state.isComplete && state.phase === 'thriving' ? 'complete' : state.phase;
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

export function gardenPhaseName(phase: GardenPhase, t: GardenTranslate): string {
  return t(`phases.${phase}`);
}

/**
 * The name of an element, from its kind. Several elements share a kind ("bed-1", "bed-2"): the
 * locale files translate the kinds, never the ids.
 */
export function gardenElementName(element: GardenElement, t: GardenTranslate): string {
  return t(`kinds.${element.kind}`);
}
