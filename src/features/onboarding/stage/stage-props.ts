import type { SharedValue } from 'react-native-reanimated';

import type { OnboardingPage } from '../pages';
import type { StageLayout } from '../stage-layout';
import type { StoryMarks } from '../story-math';
import type { StageEngine } from '../use-stage-engine';

/** What every piece of the stage receives: where the pages are, the engine, the layout. */
export interface StageProps {
  readonly position: SharedValue<number>;
  readonly engine: StageEngine;
  readonly layout: StageLayout;
  readonly pages: readonly OnboardingPage[];
  readonly marks: StoryMarks;
  /** The page the pager rests on: what is mounted around it. */
  readonly pageIndex: number;
  readonly reducedMotion: boolean;
}

/** True when a page is within `distance` pages of the one the pager rests on. */
export function isNear(pageIndex: number, page: number, distance = 1): boolean {
  return Math.abs(pageIndex - page) <= distance;
}
