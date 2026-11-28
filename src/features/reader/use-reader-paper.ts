import { useColorScheme } from 'react-native';

import type { Clock } from '@/features/home';
import { screenCheckClock } from '@/features/screen-check/pinned-clock';
import { useSunMoment } from '@/features/sky-clock';

import { readerPaperOf, type ReaderPaper } from './reader-paper';

// The check's photographs pin the hour (`-screenCheckHour`), read against the computed sun like
// any clock reading; every other build, the real one.
const systemClock: Clock = screenCheckClock ?? (() => new Date());

/**
 * The paper of the reader now (`reader-paper.ts`): it follows the phone's appearance at once, and
 * the real sun of the phone's time zone, looked at every minute while the reader is open and on
 * return to the app (`useSunMoment`), so the page turns to night at sunset without being reopened.
 */
export function useReaderPaper(clock: Clock = systemClock): ReaderPaper {
  const systemScheme = useColorScheme();
  const { instant, place } = useSunMoment(clock);
  return readerPaperOf({ instant, place, systemScheme });
}
