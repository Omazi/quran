import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

import {
  chromeAppearanceOf,
  skyForAppearance,
  skyHourAt,
  skyStateAt,
  type Appearance,
  type SkyState,
} from '@/features/garden';
import { screenCheckClock } from '@/features/screen-check/pinned-clock';
import { useSunMoment } from '@/features/sky-clock';
import { colorValuesFor, glassVeilMinimum } from '@/ui';

import { LARGE_TEXT_CONTRAST, skyBehind, TEXT_CONTRAST, veilOpacityFor } from './sky-contrast';
import type { Clock } from './use-today';

// The check's photographs pin the hour (`-screenCheckHour`), read against the computed sun like
// any clock reading; every other build, the real one.
const systemClock: Clock = screenCheckClock ?? (() => new Date());

/** What floats over the home garden takes from the sky of the hour. */
export interface SkyChrome {
  readonly sky: SkyState;
  /** The appearance of the glass and its words: the night values over a night sky, or in Dark Mode. */
  readonly appearance: Appearance;
  /**
   * Opacity of the scroll edge veil behind the date and the title (0: none). The date is in the
   * title's colour over the sky: `dateLabel`, made for the peach gradient, reads 3.1:1 on the blue
   * of noon (SKILLS.md, deviation of the home garden).
   */
  readonly headerVeil: number;
  /** Opacity of the glass's tint where the app draws it: chips, and the panel. */
  readonly chipVeil: number;
  readonly panelVeil: number;
}

/** Pure: the sky and the device's appearance in, the appearance and the glass out. */
export function chromeOf(hourSky: SkyState, device: Appearance): SkyChrome {
  const sky = skyForAppearance(hourSky, device);
  const appearance = chromeAppearanceOf(sky.theme, device);
  const colors = colorValuesFor(appearance);
  const behind = skyBehind(sky);
  const text = (color: string) => ({ color, minimum: TEXT_CONTRAST });
  return {
    sky,
    appearance,
    headerVeil: veilOpacityFor(
      behind.header,
      colors.glassVeil,
      [text(colors.heading), { color: colors.heading, minimum: LARGE_TEXT_CONTRAST }],
      glassVeilMinimum.header[appearance],
    ),
    chipVeil: veilOpacityFor(
      behind.header,
      colors.glassVeil,
      [text(colors.heading)],
      glassVeilMinimum.chip[appearance],
    ),
    panelVeil: veilOpacityFor(
      behind.panel,
      colors.glassVeil,
      [text(colors.heading), text(colors.muted), text(colors.water), text(colors.actionTint)],
      glassVeilMinimum.panel[appearance],
    ),
  };
}

/**
 * The hour of the mockup's day now, re-timed on the real sun of the phone's time zone (D51), to
 * the minute; kept up to date while the screen is open and on return (`useSunMoment`).
 */
export function useSkyHour(clock: Clock = systemClock): number {
  const { instant, place } = useSunMoment(clock);
  return useMemo(() => skyHourAt(instant, place), [instant, place]);
}

/** The sky of the real sun's hour and what floats over it (maquette-wow, js/sky.js; D51). */
export function useSkyChrome(clock?: Clock): SkyChrome {
  const hour = useSkyHour(clock);
  const device: Appearance = useColorScheme() === 'dark' ? 'dark' : 'light';
  return useMemo(() => chromeOf(skyStateAt(hour), device), [hour, device]);
}
