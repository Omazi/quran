import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { localDateInTimeZone, type LocalDate } from '@/domain/shared/local-date';

/** How often an open screen checks whether the day has changed. */
const DAY_CHECK_INTERVAL_MS = 60_000;

/** Gives the present instant. Injected so that tests choose the time. */
export type Clock = () => Date;

const systemClock: Clock = () => new Date();

/**
 * The calendar day of an instant where the device is. This is the edge of the app: the one place
 * where an instant becomes a `LocalDate`, in the device's own time zone.
 */
export function deviceLocalDate(instant: Date): LocalDate {
  return localDateInTimeZone(instant, Intl.DateTimeFormat().resolvedOptions().timeZone);
}

/**
 * Today, kept up to date: the day changes at midnight while the screen is open, and may have
 * changed while the app was in the background. A new day renders the screen again; the same day
 * does not.
 */
export function useToday(clock: Clock = systemClock): LocalDate {
  const [today, setToday] = useState(() => deviceLocalDate(clock()));
  useEffect(() => {
    const refresh = () => setToday(deviceLocalDate(clock()));
    const timer = setInterval(refresh, DAY_CHECK_INTERVAL_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [clock]);
  return today;
}
