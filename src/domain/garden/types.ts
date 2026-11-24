/**
 * Vocabulary of the garden module.
 *
 * The garden draws nothing: it turns reading progress into a `GardenState` value that any
 * renderer (2D today, 3D later) can display.
 */
import type { VerseKey } from '@/domain/quran/types';
import type { LocalDate } from '@/domain/shared/local-date';

export type TreeSpecies = 'pomegranate' | 'date-palm' | 'olive' | 'fig' | 'cypress' | 'orange';

/**
 * What a renderer has to draw. Several elements can share a kind (`bed-1` and `bed-2` are
 * both a `bed`); for a tree the kind is its species.
 */
export type GardenElementKind =
  | TreeSpecies
  | 'channels'
  | 'paving'
  | 'bed'
  | 'stepping-stones'
  | 'flowers'
  | 'fountain'
  | 'springs'
  | 'birds'
  | 'wall'
  | 'trellis'
  | 'gate'
  | 'lanterns'
  | 'butterflies'
  | 'pavilion'
  | 'carpets'
  | 'cushions'
  | 'lectern'
  | 'roses'
  | 'waterfall'
  | 'full-bloom';

/** One step of the garden: finishing hizb `hizb` unlocks it. */
export interface GardenElement {
  /** 1..60, the hizb whose completion unlocks this element. */
  readonly hizb: number;
  /** Unique name of this element, e.g. "tree-13". */
  readonly id: string;
  readonly kind: GardenElementKind;
  /** Verse that inspired the element. Provisional: see the warning in catalog.ts. */
  readonly verse?: VerseKey;
}

/** A period during which the garden is frozen (illness, travel...). Both ends included. */
export interface GardenPause {
  readonly from: LocalDate;
  readonly to: LocalDate;
}

/** Cost of a missed day, by its position in the current run of missed days. */
export interface MissedDayCostTier {
  /** First position (1-based) in the run of missed days this cost applies to. */
  readonly fromMissedDay: number;
  /** Health lost on such a day, as a fraction of full health. */
  readonly cost: number;
}

/**
 * Every tunable number of the garden. Health values are fractions of full health (0..1)
 * and must be whole hundredths (0.07 is valid, 0.075 is not): see README, "Décisions".
 */
export interface GardenConfig {
  /** Health gained on a day the user read. */
  readonly recoveryPerWateredDay: number;
  /** Ordered by `fromMissedDay`; the first tier must start at missed day 1. */
  readonly missedDayCosts: readonly MissedDayCostTier[];
  /** Health from which the garden is `thriving`. */
  readonly thrivingMinHealth: number;
  /** Health from which the garden is `thirsty` (below `thriving`). */
  readonly thirstyMinHealth: number;
  /** Health from which the garden is `wilting` (below `thirsty`); under it, it is `dying`. */
  readonly wiltingMinHealth: number;
  /** Health from which every unlocked element is visible; under it they fade out. */
  readonly allElementsVisibleMinHealth: number;
  /** Number of missed days in a row from which the water is `dry` (it is `still` before). */
  readonly dryWaterMinMissedDays: number;
}

export type GardenPhase = 'bare' | 'thriving' | 'thirsty' | 'wilting' | 'dying' | 'dead';

export type WaterState = 'flowing' | 'still' | 'dry';

/** Everything the garden needs to know. All of it is injected, including today's date. */
export interface GardenInput {
  /** Whole number of hizb finished, 0..60. */
  readonly hizbCompleted: number;
  /** Fraction 0..1 of the hizb being read. */
  readonly currentHizbProgress: number;
  /** Days on which the user read. Days outside [startDate, today] are ignored. */
  readonly wateredDays: ReadonlySet<LocalDate>;
  /** Day the garden was created: the first simulated day. */
  readonly startDate: LocalDate;
  readonly today: LocalDate;
  /** May overlap each other and extend outside [startDate, today]. */
  readonly pauses: readonly GardenPause[];
  /** Defaults to `DEFAULT_GARDEN_CONFIG`. */
  readonly config?: GardenConfig;
  /** Defaults to `GARDEN_CATALOG`. Any valid 60-step catalogue works. */
  readonly catalog?: readonly GardenElement[];
}

/** The element being earned by the hizb in progress. */
export interface GrowingElement {
  readonly element: GardenElement;
  /** Fraction 0..1: the progress of the hizb being read. */
  readonly growth: number;
}

export interface GardenState {
  readonly hizbCompleted: number;
  /** 0 (dead) to 1 (full health), always a whole number of hundredths. */
  readonly health: number;
  readonly phase: GardenPhase;
  readonly water: WaterState;
  /** Current run of missed days. Today never counts as missed; paused days are skipped. */
  readonly missedDaysInARow: number;
  /** Calendar days since the last watered day (0 when read today), or null if never read. */
  readonly daysSinceLastWatered: number | null;
  /** Elements to draw, in catalogue order. A prefix of the unlocked elements. */
  readonly visibleElements: readonly GardenElement[];
  /** Element earned by the last finished hizb, even when low health hides it. */
  readonly lastUnlocked: GardenElement | null;
  /** Element of the hizb in progress, or null once the garden is complete. */
  readonly nextElement: GrowingElement | null;
  /** True when the 60 hizb are finished. */
  readonly isComplete: boolean;
  readonly isPausedToday: boolean;
}
