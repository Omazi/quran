import { DEFAULT_GARDEN_CONFIG, type GardenState } from '@/domain/garden';
import { daysBetween, type LocalDate } from '@/domain/shared/local-date';
import type { SharedGarden } from '@/domain/social';
import { previewGardenState } from '@/features/garden';

/**
 * How long ago a friend last watered their garden, as the screen says it. Nothing more precise
 * than a day ever reaches a friend (docs/specs/social.md, rule 5).
 */
export type WaterStatus =
  | { readonly kind: 'today' }
  | { readonly kind: 'days-ago'; readonly days: number }
  | { readonly kind: 'never' };

/**
 * The days are those of two phones: the friend's day can be ahead of mine (rule of
 * `types.ts`). A day in my future counts as today, never as a negative number of days.
 */
export function waterStatusOf(lastWateredOn: LocalDate | null, today: LocalDate): WaterStatus {
  if (lastWateredOn === null) return { kind: 'never' };
  const days = daysBetween(lastWateredOn, today);
  return days <= 0 ? { kind: 'today' } : { kind: 'days-ago', days };
}

/**
 * The garden a friend published, as `GardenScene` draws it (`GardenState`).
 *
 * A friend's summary holds the health (0 to 1), not the reading days, so the garden module is
 * told the story that gives that health: `droughtDays = (1 − health) × 14`, the module's own
 * definition of health, read backwards. A friend who read today has had today's water already
 * counted in their health: the story then starts from the drought before today's reading, and
 * the module recovers it as it would. Phase, water and elements are the module's decisions, never
 * this file's. The picture is that of the level-1 garden, as for everyone (D35).
 */
export function gardenStateOf(garden: SharedGarden, today: LocalDate): GardenState {
  const config = DEFAULT_GARDEN_CONFIG;
  const droughtDays = Math.round((1 - garden.health) * config.droughtDaysToDeath);
  const readsToday = waterStatusOf(garden.lastWateredOn, today).kind === 'today';
  if (garden.hizbCompleted === 0) return previewGardenState({ hizbCompleted: 0 });
  return previewGardenState({
    hizbCompleted: garden.hizbCompleted,
    daysWithoutReading: readsToday
      ? Math.min(droughtDays + config.droughtDaysRecoveredPerWateredDay, config.droughtDaysToDeath)
      : droughtDays,
    readsToday,
  });
}
