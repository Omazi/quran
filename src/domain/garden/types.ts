/**
 * Vocabulary of the garden module.
 *
 * The garden draws nothing: it turns reading progress into a `GardenState`, a plain value
 * that any renderer (a placeholder today, 3D models later) can display without knowing a
 * single rule.
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

/**
 * A Quran verse that inspired an element. The reference and its validation flag travel
 * together on purpose: nobody can read the reference without seeing whether it may be shown.
 */
export interface GardenVerse {
  readonly key: VerseKey;
  /**
   * True once a teacher has validated the association. Religious content is shown to
   * users only when this is true: interfaces go through `displayableVerse`.
   */
  readonly validatedByTeacher: boolean;
}

/** One step of the garden: the `hizb`-th finished hizb of the khatma unlocks it. */
export interface GardenElement {
  /** 1..60: how many finished hizb it takes to unlock this element. */
  readonly hizb: number;
  /** Unique name of this element, e.g. "tree-13". The same in every variant. */
  readonly id: string;
  readonly kind: GardenElementKind;
  /** Verse that inspired the element, if any. Not validated yet: see catalog.ts. */
  readonly verse?: GardenVerse;
}

/** Overall look of a garden. Placeholder names: see variant.ts. */
export type GardenThemeId = 'theme-1' | 'theme-2' | 'theme-3' | 'theme-4';

/**
 * What makes the garden of one khatma different from the garden of another.
 * Built by `gardenVariant(cycle, userSeed)`: the same pair always gives the same variant.
 */
export interface GardenVariant {
  /** 1-based number of the khatma this garden grows with. */
  readonly cycle: number;
  /** Never the same for two consecutive cycles of a user. */
  readonly themeId: GardenThemeId;
  /**
   * Whole number 0..4294967295, different for every cycle of a user. A renderer feeds it
   * to its own pseudo-random generator to vary details (exact positions, colours...).
   * The only rule that reads it is the shift of the tree species (see `catalogForVariant`).
   */
  readonly seed: number;
}

/** A period during which the garden is frozen (illness, travel...). Both ends included. */
export interface GardenPause {
  readonly from: LocalDate;
  readonly to: LocalDate;
}

/**
 * Every tunable number of the garden. All of them are whole numbers of days.
 *
 * Drought is the single quantity the garden lives by: a number of "drought days" that
 * grows by one on a missed day and shrinks on a watered day.
 */
export interface GardenConfig {
  /** Drought days at which the garden is dead. Health is `1 - droughtDays / this`. */
  readonly droughtDaysToDeath: number;
  /** Drought days taken back by one watered day. */
  readonly droughtDaysRecoveredPerWateredDay: number;
  /** Drought days from which the garden is `thirsty` (it is `thriving` before). */
  readonly thirstyMinDroughtDays: number;
  /** Drought days from which the garden is `wilting`. */
  readonly wiltingMinDroughtDays: number;
  /** Drought days from which the garden is `dying`: its elements start to disappear. */
  readonly dyingMinDroughtDays: number;
  /** Number of missed days in a row from which the water is `dry` (it is `still` before). */
  readonly dryWaterMinMissedDays: number;
}

export type GardenPhase = 'bare' | 'thriving' | 'thirsty' | 'wilting' | 'dying' | 'dead';

export type WaterState = 'flowing' | 'still' | 'dry';

/**
 * What the garden needs to know about the reading of ONE khatma.
 *
 * The garden declares this type itself so that it does not depend on the khatm module:
 * the integration layer fills it from the reading journal. The number of the khatma is
 * not here: it goes to `gardenVariant(cycle, userSeed)`.
 */
export interface GardenKhatmInput {
  /** How many hizb are finished in this khatma, a whole number 0..60. */
  readonly hizbCompleted: number;
  /** Fraction 0..1 of the pages read in the hizb being read. */
  readonly currentHizbProgress: number;
  /**
   * Days on which the user read at least one NEW page (rereading does not water, decision
   * D8; the khatm module applies that rule). Days dated after the day being described are
   * ignored: after a time-zone change, a day already read can lie "in the future".
   */
  readonly wateredDays: ReadonlySet<LocalDate>;
  /**
   * Day the first hizb of this khatma was finished: the day the garden starts living.
   * `null` while no hizb is finished: the garden is a bare earth, nothing can dry yet.
   */
  readonly firstHizbCompletedOn: LocalDate | null;
  /**
   * Day this khatma was finished, `null` until then; refused without the 60 hizb. It
   * changes nothing to the garden: with 60 hizb it is always shown at full health.
   */
  readonly completedOn: LocalDate | null;
}

/** Everything the garden needs to know. All of it is injected, including today's date. */
export interface GardenInput extends GardenKhatmInput {
  readonly today: LocalDate;
  /** May overlap each other, and lie before the garden's first day or after today. */
  readonly pauses: readonly GardenPause[];
  /** The garden of this khatma: `gardenVariant(cycle, userSeed)`. */
  readonly variant: GardenVariant;
  /** Defaults to `DEFAULT_GARDEN_CONFIG`. */
  readonly config?: GardenConfig;
  /**
   * Defaults to `catalogForVariant(variant)`. Any valid 60-step catalogue works; a
   * catalogue given here is used as it is (the variant does not shift its trees).
   */
  readonly catalog?: readonly GardenElement[];
}

/** The element being earned by the hizb in progress. */
export interface GrowingElement {
  readonly element: GardenElement;
  /** Fraction 0..1 that follows the pages read in the hizb in progress. */
  readonly growth: number;
  /**
   * Whether to draw it. It is the newest arrival of the garden, so it is the first to
   * disappear: it is drawn only while every unlocked element is visible.
   */
  readonly isVisible: boolean;
}

/**
 * The garden to display on one day. Plain data (numbers, strings, lists): it survives
 * JSON as it is, and holds everything a renderer needs.
 */
export interface GardenState {
  readonly hizbCompleted: number;
  /** Whole number from 0 (just watered enough) to 14 (dead): what the rules reason with. */
  readonly droughtDays: number;
  /**
   * 1 (full health) to 0 (dead): `1 - droughtDays / 14`. A renderer shows wilting
   * gradually from this value; the phase below only names the stretch it is in.
   */
  readonly health: number;
  readonly phase: GardenPhase;
  readonly water: WaterState;
  /**
   * Current run of missed days since the garden started living. Today never counts as
   * missed; paused days are skipped. It drives the water, not the health.
   */
  readonly missedDaysInARow: number;
  /** Calendar days since the last watered day (0 when read today), or null if never read. */
  readonly daysSinceLastWatered: number | null;
  /** Elements to draw, in catalogue order. Always the first of the unlocked elements. */
  readonly visibleElements: readonly GardenElement[];
  /** Element earned by the last finished hizb, even when the drought hides it. */
  readonly lastUnlocked: GardenElement | null;
  /** Element of the hizb in progress, or null once the garden is complete. */
  readonly nextElement: GrowingElement | null;
  /** True when the 60 hizb are finished. */
  readonly isComplete: boolean;
  readonly isPausedToday: boolean;
  /** The variant received as input: which garden this is (theme, seed, cycle). */
  readonly variant: GardenVariant;
}

/** The garden on a coming day, if the user reads nothing more. */
export interface GardenForecastDay {
  readonly date: LocalDate;
  /** Exactly what `computeGardenState` gives for the same input when `date` is today. */
  readonly state: GardenState;
}
