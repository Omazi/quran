/**
 * Levels, gardens and badges on screen (D46): the badge, the level chip, the badge shelf, the
 * current garden card, "Montrer mon niveau", "Mes jardins", the khatma celebration and a friend's
 * level. The rules are in `@/domain/levels`; the pictures of each style in `garden-style-art.ts`.
 */
export { BadgeShelf, type BadgeShelfProps } from './badge-shelf';
export { CurrentGardenCard, type CurrentGardenCardProps } from './current-garden-card';
export { FriendLevelSection, type FriendLevelSectionProps } from './friend-level-section';
export { GARDEN_STYLE_ART, isProvisionalArt } from './garden-style-art';
export {
  celebrationOf,
  friendShelf,
  ownShelf,
  type BadgeView,
  type Celebration,
  type FriendShelf,
} from './gardens-model';
export { KhatmaBadge, type KhatmaBadgeProps } from './khatma-badge';
export {
  KhatmaCelebrationScreen,
  type KhatmaCelebrationScreenProps,
} from './khatma-celebration-screen';
export { LevelChip, type LevelChipProps } from './level-chip';
export { MyGardensScreen, type MyGardensScreenProps } from './my-gardens-screen';
export { ShowLevelCard, type ShowLevelCardProps } from './show-level-card';
export {
  CELEBRATION_PATH,
  mayCelebrateOver,
  useKhatmaCelebration,
  type KhatmaCelebrationDependencies,
} from './use-khatma-celebration';
export { useProgression } from './use-progression';
