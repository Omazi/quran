import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { isSameSunMoment, sunMomentOf, type SunMoment } from './device-place';

/** How often the sun is looked at: once a minute is smooth for a sky and a page (D51). */
const SUN_STEP_MS = 60_000;

/**
 * The moment and the place of the sun, kept up to date while the screen is open: every minute,
 * and at once when the app comes back to the foreground. The zone and the date are read again
 * each time, so a new day, a summer time change or a flight to another zone are followed without
 * restarting the app.
 */
export function useSunMoment(clock: () => Date): SunMoment {
  const [moment, setMoment] = useState(() => sunMomentOf(clock()));
  useEffect(() => {
    const refresh = () => {
      const next = sunMomentOf(clock());
      setMoment((previous) => (isSameSunMoment(previous, next) ? previous : next));
    };
    refresh();
    const timer = setInterval(refresh, SUN_STEP_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [clock]);
  return moment;
}
