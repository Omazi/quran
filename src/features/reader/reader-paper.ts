/**
 * The page of the reader by day and at night (owner's decision of 27 November 2026, validated
 * mockup docs/design/maquette-wow, shots 14 to 16): the cream paper by day; at night, the warm
 * dark page of the dusk. The reader follows the real hour, and the phone's dark appearance always
 * gives the night page: day and light appearance give the paper, night or dark appearance give
 * the night page. Pure: the hour and the appearance are parameters.
 */

import { READER_CONFIG } from './config';

/** `day`: the cream paper. `night`: the warm dark page of the dusk. */
export type ReaderPaper = 'day' | 'night';

const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_HOUR = 60;

export interface ReaderPaperInput {
  /** Minutes since local midnight, 0 to 1439. */
  readonly minutesOfDay: number;
  /** The phone's appearance; unknown counts as light, as React Native does. */
  readonly systemScheme: 'light' | 'dark' | null | undefined;
}

export function readerPaperOf({ minutesOfDay, systemScheme }: ReaderPaperInput): ReaderPaper {
  if (!Number.isInteger(minutesOfDay) || minutesOfDay < 0 || minutesOfDay >= MINUTES_PER_DAY) {
    throw new RangeError(`There is no minute ${minutesOfDay} in a day.`);
  }
  if (systemScheme === 'dark') return 'night';
  const { dayStartsAtMinute, nightStartsAtMinute } = READER_CONFIG.paper;
  return minutesOfDay >= dayStartsAtMinute && minutesOfDay < nightStartsAtMinute ? 'day' : 'night';
}

/** The minutes since local midnight of a moment of the device clock. */
export function minutesOfDayOf(moment: Date): number {
  return moment.getHours() * MINUTES_PER_HOUR + moment.getMinutes();
}
