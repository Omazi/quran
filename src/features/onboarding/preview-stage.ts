/**
 * The garden shown above the settings of the first launch: the stage a month at the chosen pace
 * reaches (the owner's chosen prototype, `PV`). The plan itself is the goal-plan domain's
 * (`computeGoalPlan`, `hizbAfter30Days`); this only picks the picture.
 */

/** The stages the preview can show, largest first: the pictures of the story, and three early ones. */
export const PREVIEW_STAGES = [60, 40, 30, 20, 8, 5, 2, 0] as const;

export type PreviewStage = (typeof PREVIEW_STAGES)[number];

/** The largest stage a number of hizb reaches. */
export function previewStageOf(hizb: number): PreviewStage {
  return PREVIEW_STAGES.find((stage) => stage <= hizb) ?? 0;
}
