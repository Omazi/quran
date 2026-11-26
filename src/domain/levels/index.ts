/**
 * Levels, gardens and badges (D23, D46): one level per completed khatma, one garden style per
 * level, the same for everyone, and one badge per completed khatma. Derived from the reading
 * journal; nothing here is stored. See README.md.
 */
export { DEFAULT_LEVELS_CONFIG, GARDEN_STYLES } from './config';
export { levelOfCompletedKhatmas, levelOfKhatma, styleOfLevel } from './levels';
export { badgeShelf, getProgression, khatmaToCelebrate, levelPath } from './progression';
export type {
  CelebrationInput,
  CompletedKhatma,
  GardenStyleId,
  LevelsConfig,
  LevelStep,
  LevelStepStatus,
  Progression,
  ShelfItem,
} from './types';
