/**
 * The page of the reader by day and at night (owner's decisions of 27 November 2026, validated
 * mockup docs/design/maquette-wow, shots 14 to 16, and D51): the cream paper by day; at night, the
 * warm dark page of the dusk. Night runs from the real sunset to the real sunrise of the place
 * (`isSunUpAt`, docs/specs/sun.md), and the phone's dark appearance always gives the night page.
 * Pure: the moment, the place and the appearance are parameters.
 */

import { isSunUpAt, type GeoPosition } from '@/domain/sun';

/** `day`: the cream paper. `night`: the warm dark page of the dusk. */
export type ReaderPaper = 'day' | 'night';

export interface ReaderPaperInput {
  /** The moment, in milliseconds since 1970 UTC. */
  readonly instant: number;
  /** Where the sun is read: the place of the phone's time zone (`devicePlace`). */
  readonly place: GeoPosition;
  /** The phone's appearance; unknown counts as light, as React Native does. */
  readonly systemScheme: 'light' | 'dark' | null | undefined;
}

export function readerPaperOf({ instant, place, systemScheme }: ReaderPaperInput): ReaderPaper {
  // Read first, so that a moment or a place that is not one is refused in every appearance.
  const isSunUp = isSunUpAt(instant, place);
  if (systemScheme === 'dark') return 'night';
  return isSunUp ? 'day' : 'night';
}
