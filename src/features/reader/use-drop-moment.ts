import { useEffect, useReducer, useRef } from 'react';

import { READER_CONFIG } from './config';
import {
  advanceDropMoment,
  dropTimings,
  IDLE_MOMENT,
  type DropMoment,
  type DropMomentEvent,
  type DropTimings,
} from './drop-moment';
import { playFeedback } from './feedback-events';
import type { CountedPageEvent } from './use-reader';

const SECOND_MS = 1000;

export interface DropMomentGeometry {
  /** Where the drop starts and where it lands, in points from the top of the screen. */
  readonly fromY: number;
  readonly toY: number;
}

/** The fall of the drop of the moment shown: where it goes and how long it takes. */
export interface DropFall extends DropMomentGeometry {
  readonly timings: DropTimings;
}

export interface PlayedDropMoment {
  readonly moment: DropMoment;
  /** The fall of the current drop; null when nothing falls. */
  readonly fall: DropFall | null;
}

/**
 * Plays the moment of each page that counts (`drop-moment.ts`) with the screen's clock: the drop
 * falls for the time its height asks, the pill says what grew when it lands, then leaves. The sound
 * of the falling drop and the sound and haptic of its landing are asked for by name
 * (`feedback-events.ts`); with Reduce Motion only the landing plays.
 */
interface PlayedState extends PlayedDropMoment {
  readonly lastFall: DropFall | null;
}

type PlayedEvent =
  | (Extract<DropMomentEvent, { type: 'counted' }> & { readonly fall: DropFall })
  | Exclude<DropMomentEvent, { type: 'counted' }>;

/** The moment, and the fall of its drop: a new fall only when no drop is falling already. */
function play(state: PlayedState, event: PlayedEvent): PlayedState {
  const moment = advanceDropMoment(state.moment, event);
  if (moment === state.moment) return state;
  const lastFall =
    event.type === 'counted' && state.moment.phase !== 'falling' ? event.fall : state.lastFall;
  return { moment, lastFall, fall: moment.phase === 'falling' ? lastFall : null };
}

const NOTHING_PLAYED: PlayedState = { moment: IDLE_MOMENT, fall: null, lastFall: null };

export function useDropMoment(
  counted: CountedPageEvent | null,
  isMotionReduced: boolean,
  geometryOf: (event: CountedPageEvent) => DropMomentGeometry,
): PlayedDropMoment {
  const [{ moment, fall }, dispatch] = useReducer(play, NOTHING_PLAYED);
  const seen = useRef<number | null>(null);
  const geometry = useRef(geometryOf);
  useEffect(() => {
    geometry.current = geometryOf;
  });

  useEffect(() => {
    if (counted === null || counted.sequence === seen.current) return;
    seen.current = counted.sequence;
    const { fromY, toY } = geometry.current(counted);
    dispatch({
      type: 'counted',
      feedback: counted.feedback,
      isMotionReduced,
      fall: { fromY, toY, timings: dropTimings(fromY, toY) },
    });
  }, [counted, isMotionReduced]);

  const id = moment.phase === 'idle' ? null : moment.id;
  const phase = moment.phase;
  const totalMs = fall?.timings.totalMs ?? null;

  // A drop that starts falling: its sound now, its landing when its time is up.
  useEffect(() => {
    if (phase !== 'falling' || id === null) return;
    playFeedback('drop');
    const timer = setTimeout(
      () => dispatch({ type: 'landed', id }),
      totalMs ?? dropTimings(0, 0).totalMs,
    );
    return () => clearTimeout(timer);
    // The landing is timed once, when the drop starts: a page riding on it changes nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, phase]);

  // The drop is received: its sound and haptic, then the pill stays a few seconds.
  useEffect(() => {
    if (phase !== 'received' || id === null) return;
    playFeedback('drop-received');
    const timer = setTimeout(
      () => dispatch({ type: 'expired', id }),
      READER_CONFIG.dropPill.visibleSeconds * SECOND_MS,
    );
    return () => clearTimeout(timer);
  }, [id, phase]);

  return { moment, fall };
}
