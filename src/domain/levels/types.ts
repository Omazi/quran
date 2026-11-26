import type { LocalDate } from '@/domain/shared/local-date';

/**
 * The style of a garden: one per level, the same for everyone (D23), so that a person's level is
 * recognised by their garden. The ids are names for the code, never shown: the words are in the
 * translations, the pictures in the app's style registry.
 */
export type GardenStyleId =
  | 'fountain-courtyard'
  | 'oasis'
  | 'waterside-orchard'
  | 'mountain-garden'
  | 'cherry-blossoms'
  | 'pine-clearing'
  | 'night-garden';

/** Business settings of the module. See `DEFAULT_LEVELS_CONFIG`. */
export interface LevelsConfig {
  /**
   * Days after its completion during which a khatma not yet celebrated still is. Past them it
   * came back with a restored or merged journal, long after: it is not celebrated any more. Whole
   * number, 0 or more.
   */
  readonly celebrationWindowDays: number;
}

/** A completed khatma: its badge, with the level and the garden it grew. */
export interface CompletedKhatma {
  /** Number of the khatma, from 1. It is also the number written on the badge. */
  readonly khatm: number;
  /** Level of the garden it grew: `levelOfKhatma(khatm)`. */
  readonly level: number;
  readonly styleId: GardenStyleId;
  /** Earliest reading date of the khatma. */
  readonly startedOn: LocalDate;
  /** The day its last page was read, wherever and whenever that page reached this phone. */
  readonly completedOn: LocalDate;
  /** Calendar days from `startedOn` to `completedOn`, both included. */
  readonly daysTaken: number;
}

/** Where a person stands: what they completed, and the garden they grow now. */
export interface Progression {
  /** Every completed khatma, in order: one badge each. */
  readonly completed: readonly CompletedKhatma[];
  /** The khatma in progress: `completed.length + 1`. */
  readonly currentKhatm: number;
  /** The person's level: the level of the khatma in progress. */
  readonly level: number;
  /** The garden of that level. */
  readonly styleId: GardenStyleId;
  /**
   * True once a page of the khatma in progress is read. A completed khatma's garden stays on
   * display until then (D20): the new garden starts with its first page, without confirmation.
   */
  readonly hasStarted: boolean;
  /** Hizb completed in the khatma in progress, 0 to 59. */
  readonly hizbCompleted: number;
  /** The highest level of this version: the number of garden styles. */
  readonly maxLevel: number;
}

/** A level on the path of "Mes jardins". */
export type LevelStepStatus = 'completed' | 'current' | 'locked';

export interface LevelStep {
  readonly level: number;
  readonly status: LevelStepStatus;
  /** Null for a locked level: the garden to come stays a surprise, no name and no picture. */
  readonly styleId: GardenStyleId | null;
  /**
   * The khatma that completed this level (the first one, for the last level), or the khatma in
   * progress for the current level; null for a locked one.
   */
  readonly khatm: number | null;
  /** The day the level was completed; null while it is not. */
  readonly completedOn: LocalDate | null;
}

/** One place of the badge shelf of the profile. */
export type ShelfItem =
  | { readonly kind: 'earned'; readonly badge: CompletedKhatma }
  | {
      readonly kind: 'in-progress';
      readonly khatm: number;
      readonly level: number;
      readonly styleId: GardenStyleId;
      readonly hizbCompleted: number;
    }
  /** The next level: nothing of its garden is told. */
  | { readonly kind: 'locked'; readonly level: number };

export interface CelebrationInput {
  readonly completed: readonly CompletedKhatma[];
  /** The last khatma already celebrated (0: none). Settings of the store, synced (`highest`). */
  readonly celebratedKhatm: number;
  readonly today: LocalDate;
  /** Defaults to `DEFAULT_LEVELS_CONFIG`. */
  readonly config?: LevelsConfig;
}
