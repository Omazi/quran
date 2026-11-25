import { SYNC_CONFIG } from './config';

/**
 * How long to wait before trying again after `failures` failed syncs in a row (1 for the first):
 * twice as long at each failure, from `retryBaseMs` to `retryMaxMs`, and spread between half and
 * all of it (`random` gives a number from 0 to 1) so that phones cut off together do not all
 * come back at the same instant.
 */
export function nextRetryDelay(failures: number, random: () => number): number {
  const exponent = Math.max(0, Math.min(30, Math.floor(failures) - 1));
  const delay = Math.min(SYNC_CONFIG.retryMaxMs, SYNC_CONFIG.retryBaseMs * 2 ** exponent);
  const spread = Math.min(1, Math.max(0, random()));
  return Math.round(delay * (0.5 + spread / 2));
}
