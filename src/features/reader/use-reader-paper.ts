import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import type { Clock } from '@/features/home';
import { screenCheckClock } from '@/features/screen-check/pinned-clock';

import { READER_CONFIG } from './config';
import { minutesOfDayOf, readerPaperOf, type ReaderPaper } from './reader-paper';

const SECOND_MS = 1000;
// The check's photographs pin the hour (`-screenCheckHour`); every other build, the real one.
const systemClock: Clock = screenCheckClock ?? (() => new Date());

/**
 * The paper of the reader now (`reader-paper.ts`): it follows the phone's appearance at once, and
 * the hour, looked at every minute while the reader is open, so the page turns to night at dusk
 * without being reopened.
 */
export function useReaderPaper(clock: Clock = systemClock): ReaderPaper {
  const systemScheme = useColorScheme();
  const [minutesOfDay, setMinutesOfDay] = useState(() => minutesOfDayOf(clock()));
  useEffect(() => {
    const timer = setInterval(
      () => setMinutesOfDay(minutesOfDayOf(clock())),
      READER_CONFIG.paper.recheckSeconds * SECOND_MS,
    );
    return () => clearInterval(timer);
  }, [clock]);
  return readerPaperOf({ minutesOfDay, systemScheme });
}
