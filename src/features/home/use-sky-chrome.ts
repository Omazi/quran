import { useEffect, useMemo, useState } from 'react';
import { AppState, useColorScheme } from 'react-native';

import {
  chromeAppearanceOf,
  hourOfDay,
  skyForAppearance,
  skyStateAt,
  type Appearance,
  type SkyState,
} from '@/features/garden';
import { screenCheckClock } from '@/features/screen-check/pinned-clock';
import { colorValuesFor, glassVeilMinimum } from '@/ui';

import { LARGE_TEXT_CONTRAST, skyBehind, TEXT_CONTRAST, veilOpacityFor } from './sky-contrast';
import type { Clock } from './use-today';

/** How often the sky follows the clock: once a minute is smooth for a sky (sky-state test). */
const SKY_STEP_MS = 60_000;
const MINUTES_PER_HOUR = 60;

// The check's photographs pin the hour (`-screenCheckHour`); every other build, the real one.
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

/** The local hour, to the minute, kept up to date while the screen is open and on return. */
export function useSkyHour(clock: Clock = systemClock): number {
  const minuteOf = () => Math.floor(hourOfDay(clock()) * MINUTES_PER_HOUR);
  const [minute, setMinute] = useState(minuteOf);
  useEffect(() => {
    const refresh = () => setMinute(Math.floor(hourOfDay(clock()) * MINUTES_PER_HOUR));
    const timer = setInterval(refresh, SKY_STEP_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [clock]);
  return minute / MINUTES_PER_HOUR;
}

/** The sky of the real local hour and what floats over it (maquette-wow, js/sky.js). */
export function useSkyChrome(clock?: Clock): SkyChrome {
  const hour = useSkyHour(clock);
  const device: Appearance = useColorScheme() === 'dark' ? 'dark' : 'light';
  return useMemo(() => chromeOf(skyStateAt(hour), device), [hour, device]);
}
