/**
 * The rules of the reader's new look that need no screen (validated mockup of 27 November 2026,
 * docs/design/maquette-wow, shots 14 to 16 and 20 to 22): the paper by day and the night page,
 * the water thread that fills in the margin while a page gathers its time, the drop that falls
 * into the glass pill when a page counts, and what the pill says.
 */

import { readerShapes } from '@/ui';

import { READER_CONFIG } from '../config';
import {
  advanceDropMoment,
  dropFrame,
  dropTimings,
  IDLE_MOMENT,
  type DropMoment,
} from '../drop-moment';
import { pillCopy } from '../drop-pill-copy';
import { drawnThreadShare, isSameThreadState, threadStateOf } from '../page-thread';
import { dropStartY, readerGeometry } from '../reader-geometry';
import { readerPaperOf } from '../reader-paper';
import type { ReadingFeedback } from '../reading-feedback';

const TORONTO = { latitude: 43.65, longitude: -79.38 };
const PARIS = { latitude: 48.87, longitude: 2.33 };
const LONGYEARBYEN = { latitude: 78, longitude: 16 };
const HOUR_MS = 3_600_000;

/** A local clock reading at a UTC offset in hours, as an instant. */
function clock(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  offset: number,
) {
  return Date.UTC(year, month - 1, day, hour, minute) - offset * HOUR_MS;
}

/** Toronto in November (EST): sunrise 07:27, sunset 16:43 on the 27th (PyEphem). */
const toronto = (hour: number, minute: number, day = 27) => clock(2026, 11, day, hour, minute, -5);

describe('the paper from sunrise to sunset, the night page from sunset to sunrise (owner, D51)', () => {
  it('is the paper while the sun is up, in the light appearance', () => {
    for (const instant of [toronto(7, 32), toronto(12, 0), toronto(16, 40)]) {
      expect(readerPaperOf({ instant, place: TORONTO, systemScheme: 'light' })).toBe('day');
    }
  });

  it('is the night page from sunset until sunrise', () => {
    for (const instant of [
      toronto(16, 48),
      toronto(17, 56),
      toronto(23, 59),
      toronto(0, 0),
      toronto(7, 20),
    ]) {
      expect(readerPaperOf({ instant, place: TORONTO, systemScheme: 'light' })).toBe('night');
    }
  });

  it('follows the real sun, not fixed hours: 20:00 is night in Toronto in November, day in Paris in June', () => {
    expect(readerPaperOf({ instant: toronto(20, 0), place: TORONTO, systemScheme: 'light' })).toBe(
      'night',
    );
    const parisJune = clock(2026, 6, 21, 21, 0, 2);
    expect(readerPaperOf({ instant: parisJune, place: PARIS, systemScheme: 'light' })).toBe('day');
    // 06:30 in Paris in June: the sun rose at 05:47; the old fixed hours said night until 06:11.
    const parisMorning = clock(2026, 6, 21, 6, 0, 2);
    expect(readerPaperOf({ instant: parisMorning, place: PARIS, systemScheme: 'light' })).toBe(
      'day',
    );
  });

  it('is always the night page when the phone is in its dark appearance', () => {
    for (const instant of [toronto(0, 0), toronto(7, 32), toronto(12, 0), toronto(16, 40)]) {
      expect(readerPaperOf({ instant, place: TORONTO, systemScheme: 'dark' })).toBe('night');
    }
  });

  it('follows the sun when the appearance is not known (the light appearance)', () => {
    expect(readerPaperOf({ instant: toronto(12, 0), place: TORONTO, systemScheme: null })).toBe(
      'day',
    );
    expect(
      readerPaperOf({ instant: toronto(22, 0), place: TORONTO, systemScheme: undefined }),
    ).toBe('night');
  });

  it('polar day keeps the paper all day; polar night keeps the night page', () => {
    const june = clock(2026, 6, 21, 0, 30, 2);
    const december = clock(2026, 12, 21, 12, 0, 1);
    expect(readerPaperOf({ instant: june, place: LONGYEARBYEN, systemScheme: 'light' })).toBe(
      'day',
    );
    expect(readerPaperOf({ instant: december, place: LONGYEARBYEN, systemScheme: 'light' })).toBe(
      'night',
    );
  });

  it('refuses a moment or a place that is not one, whatever the appearance', () => {
    for (const systemScheme of ['light', 'dark'] as const) {
      expect(() => readerPaperOf({ instant: Number.NaN, place: TORONTO, systemScheme })).toThrow(
        RangeError,
      );
      expect(() =>
        readerPaperOf({
          instant: toronto(12, 0),
          place: { latitude: 95, longitude: 0 },
          systemScheme,
        }),
      ).toThrow(RangeError);
    }
  });
});

describe('the water thread in the margin: how far the page is from counting (shots 20 to 22)', () => {
  const requiredMs = 26_000;

  it('is empty, with its bead at the top, for a page not looked at yet', () => {
    expect(threadStateOf({ isRead: false, progress: undefined, requiredMs })).toEqual({
      kind: 'filling',
      share: 0,
    });
  });

  it('fills with the time the page has gathered, by hundredths', () => {
    expect(
      threadStateOf({
        isRead: false,
        progress: { creditedMs: 13_000, counted: false },
        requiredMs,
      }),
    ).toEqual({ kind: 'filling', share: 0.5 });
    expect(
      threadStateOf({
        isRead: false,
        progress: { creditedMs: 1_000, counted: false },
        requiredMs,
      }),
    ).toEqual({ kind: 'filling', share: 0.03 });
  });

  it('is full, its bead at the end, once the time is reached and before the page counts', () => {
    expect(
      threadStateOf({
        isRead: false,
        progress: { creditedMs: requiredMs, counted: false },
        requiredMs,
      }),
    ).toEqual({ kind: 'ready' });
    expect(
      threadStateOf({
        isRead: false,
        progress: { creditedMs: requiredMs * 3, counted: false },
        requiredMs,
      }),
    ).toEqual({ kind: 'ready' });
  });

  it('is done, still and pale, for a page that counted or that the khatma already holds', () => {
    expect(
      threadStateOf({
        isRead: false,
        progress: { creditedMs: requiredMs, counted: true },
        requiredMs,
      }),
    ).toEqual({ kind: 'done' });
    expect(threadStateOf({ isRead: true, progress: undefined, requiredMs })).toEqual({
      kind: 'done',
    });
  });

  it('stays empty while the time the page asks is not known yet', () => {
    expect(
      threadStateOf({
        isRead: false,
        progress: { creditedMs: 40_000, counted: false },
        requiredMs: Number.POSITIVE_INFINITY,
      }),
    ).toEqual({ kind: 'filling', share: 0 });
  });

  it('draws the share of the thread, by three still steps with Reduce Motion', () => {
    const { reducedMotionSteps } = READER_CONFIG.thread;
    expect(reducedMotionSteps).toBe(3);
    expect(drawnThreadShare({ kind: 'filling', share: 0.5 }, false)).toBe(0.5);
    expect(drawnThreadShare({ kind: 'filling', share: 0.5 }, true)).toBeCloseTo(1 / 3);
    expect(drawnThreadShare({ kind: 'filling', share: 0.2 }, true)).toBe(0);
    expect(drawnThreadShare({ kind: 'filling', share: 0.7 }, true)).toBeCloseTo(2 / 3);
    expect(drawnThreadShare({ kind: 'ready' }, true)).toBe(1);
    expect(drawnThreadShare({ kind: 'done' }, false)).toBe(1);
  });

  it('tells two equal states apart from two different ones, so a thread draws only on a change', () => {
    expect(isSameThreadState({ kind: 'done' }, { kind: 'done' })).toBe(true);
    expect(
      isSameThreadState({ kind: 'filling', share: 0.4 }, { kind: 'filling', share: 0.4 }),
    ).toBe(true);
    expect(
      isSameThreadState({ kind: 'filling', share: 0.4 }, { kind: 'filling', share: 0.41 }),
    ).toBe(false);
    expect(isSameThreadState({ kind: 'ready' }, { kind: 'done' })).toBe(false);
  });

  it('refuses a negative time', () => {
    expect(() =>
      threadStateOf({ isRead: false, progress: { creditedMs: -1, counted: false }, requiredMs }),
    ).toThrow(RangeError);
    expect(() => threadStateOf({ isRead: false, progress: undefined, requiredMs: 0 })).toThrow(
      RangeError,
    );
  });
});

const GROWS: ReadingFeedback = {
  kind: 'page-counted',
  page: 294,
  growingKind: 'pomegranate',
  growth: { hizb: 25, pagesBefore: 3, pagesAfter: 4, pageCount: 10 },
  todayBefore: 5,
  todayAfter: 6,
};
const NEXT_PAGE: ReadingFeedback = {
  ...GROWS,
  page: 295,
  growth: { hizb: 25, pagesBefore: 4, pagesAfter: 5, pageCount: 10 },
  todayBefore: 6,
  todayAfter: 7,
};

describe('the drop and the glass pill: one moment per page that counts (shots 21, 22)', () => {
  it('starts with the drop falling into the pill, which still shows the old count', () => {
    const moment = advanceDropMoment(IDLE_MOMENT, {
      type: 'counted',
      feedback: GROWS,
      isMotionReduced: false,
    });
    expect(moment).toEqual({ phase: 'falling', feedback: GROWS, id: 1 });
  });

  it('turns to "received" when the drop lands, then goes away', () => {
    const falling = advanceDropMoment(IDLE_MOMENT, {
      type: 'counted',
      feedback: GROWS,
      isMotionReduced: false,
    });
    const received = advanceDropMoment(falling, { type: 'landed', id: 1 });
    expect(received).toEqual({ phase: 'received', feedback: GROWS, id: 1 });
    expect(advanceDropMoment(received, { type: 'expired', id: 1 })).toEqual({
      phase: 'idle',
      lastId: 1,
    });
  });

  it('skips the drop with Reduce Motion: the pill says at once what was received', () => {
    expect(
      advanceDropMoment(IDLE_MOMENT, { type: 'counted', feedback: GROWS, isMotionReduced: true }),
    ).toEqual({ phase: 'received', feedback: GROWS, id: 1 });
  });

  it('lets one drop carry two pages that count while it falls, from the first count shown', () => {
    const falling = advanceDropMoment(IDLE_MOMENT, {
      type: 'counted',
      feedback: GROWS,
      isMotionReduced: false,
    });
    const both = advanceDropMoment(falling, {
      type: 'counted',
      feedback: NEXT_PAGE,
      isMotionReduced: false,
    });
    expect(both).toEqual({
      phase: 'falling',
      id: 1,
      feedback: {
        ...NEXT_PAGE,
        growth: { hizb: 25, pagesBefore: 3, pagesAfter: 5, pageCount: 10 },
        todayBefore: 5,
      },
    });
  });

  it('lets a new drop fall when a page counts while the pill still shows the last one', () => {
    const received: DropMoment = { phase: 'received', feedback: GROWS, id: 1 };
    expect(
      advanceDropMoment(received, { type: 'counted', feedback: NEXT_PAGE, isMotionReduced: false }),
    ).toEqual({ phase: 'falling', feedback: NEXT_PAGE, id: 2 });
  });

  it('ignores a landing or an end that belongs to an older drop', () => {
    const falling: DropMoment = { phase: 'falling', feedback: NEXT_PAGE, id: 2 };
    expect(advanceDropMoment(falling, { type: 'landed', id: 1 })).toBe(falling);
    expect(advanceDropMoment(falling, { type: 'expired', id: 2 })).toBe(falling);
    const received: DropMoment = { phase: 'received', feedback: NEXT_PAGE, id: 2 };
    expect(advanceDropMoment(received, { type: 'expired', id: 1 })).toBe(received);
    expect(advanceDropMoment(IDLE_MOMENT, { type: 'landed', id: 1 })).toBe(IDLE_MOMENT);
  });

  it('times the drop as the mockup does: it forms, waits, then falls longer from higher up', () => {
    const { formMs, holdMs, fallBaseMs, fallMsPerPoint, fallExtraMaxMs } = READER_CONFIG.drop;
    expect(dropTimings(600, 700)).toEqual({
      formMs,
      holdMs,
      fallMs: fallBaseMs + 100 * fallMsPerPoint,
      totalMs: formMs + holdMs + fallBaseMs + 100 * fallMsPerPoint,
    });
    expect(dropTimings(0, 5000).fallMs).toBe(fallBaseMs + fallExtraMaxMs);
  });

  it('forms at the end of the thread, swelling, then falls with gravity into the ring', () => {
    const from = { x: 30, y: 400 };
    const to = { x: 180, y: 700 };
    const timings = dropTimings(from.y, to.y);
    const start = dropFrame(0, timings, from, to);
    expect(start.x).toBe(30);
    expect(start.y).toBe(400);
    expect(start.scaleX).toBeLessThan(0.5);
    const formed = dropFrame(timings.formMs + timings.holdMs, timings, from, to);
    expect(formed.scaleX).toBeCloseTo(1);
    // Gravity: after half the fall it has gone a quarter of the way down, then speeds up.
    const half = dropFrame(timings.formMs + timings.holdMs + timings.fallMs / 2, timings, from, to);
    const downAtHalf = (half.y - formed.y) / (to.y - formed.y);
    expect(downAtHalf).toBeGreaterThan(0.2);
    expect(downAtHalf).toBeLessThan(0.3);
    // Faster is longer and thinner.
    const late = dropFrame(timings.totalMs - 30, timings, from, to);
    expect(late.scaleY).toBeGreaterThan(half.scaleY);
    expect(late.scaleX).toBeLessThan(1);
    const end = dropFrame(timings.totalMs, timings, from, to);
    expect(end.x).toBeCloseTo(180);
    expect(end.y).toBeCloseTo(700);
  });
});

describe('what the glass pill says (shots 21, 22)', () => {
  it('names the drop for what grows, with the hizb’s pages before it lands', () => {
    expect(pillCopy(GROWS, 'falling')).toEqual({
      title: { key: 'reader:drop.toward.pomegranate' },
      detail: { key: 'reader:drop.hizbPages', count: 3, total: 10, hizb: 25 },
      ring: 0.3,
    });
  });

  it('says it grew, with the new count, once it landed', () => {
    expect(pillCopy(GROWS, 'received')).toEqual({
      title: { key: 'reader:drop.grew.pomegranate' },
      detail: { key: 'reader:drop.hizbPages', count: 4, total: 10, hizb: 25 },
      ring: 0.4,
    });
  });

  it('waters the garden when the page grows nothing (another hizb, or nothing left to grow)', () => {
    const elsewhere: ReadingFeedback = {
      ...GROWS,
      growth: { hizb: 25, pagesBefore: 3, pagesAfter: 3, pageCount: 10 },
    };
    expect(pillCopy(elsewhere, 'falling').title).toEqual({ key: 'reader:drop.towardGarden' });
    expect(pillCopy(elsewhere, 'received').title).toEqual({ key: 'reader:drop.watered' });
    expect(pillCopy(elsewhere, 'received').detail).toEqual({
      key: 'reader:drop.hizbPages',
      count: 3,
      total: 10,
      hizb: 25,
    });
    const nothingLeft: ReadingFeedback = { ...GROWS, growingKind: null, growth: null };
    expect(pillCopy(nothingLeft, 'falling')).toEqual({
      title: { key: 'reader:drop.towardGarden' },
      detail: { key: 'reader:drop.today', count: 5 },
      ring: 1,
    });
    expect(pillCopy(nothingLeft, 'received')).toEqual({
      title: { key: 'reader:drop.watered' },
      detail: { key: 'reader:drop.today', count: 6 },
      ring: 1,
    });
  });

  it('names the new element when the page completes a hizb, its ring full', () => {
    const completed: ReadingFeedback = {
      kind: 'hizb-completed',
      page: 302,
      elementKind: 'pomegranate',
      growth: { hizb: 25, pagesBefore: 9, pagesAfter: 10, pageCount: 10 },
      todayBefore: 7,
      todayAfter: 8,
    };
    expect(pillCopy(completed, 'falling')).toEqual({
      title: { key: 'reader:drop.toward.pomegranate' },
      detail: { key: 'reader:drop.hizbPages', count: 9, total: 10, hizb: 25 },
      ring: 0.9,
    });
    expect(pillCopy(completed, 'received')).toEqual({
      title: { key: 'reader:drop.hizbCompleted', hizb: 25 },
      detail: { key: 'reader:drop.newElement', element: 'pomegranate' },
      ring: 1,
    });
  });
});

describe('where the floating pieces lie (shots 14, 21, 22)', () => {
  const insets = { top: 47, bottom: 34 };
  const { glassBarHeight, dropPillHeight, dropPillGap } = readerShapes;

  it('puts the pill just above the bottom bar (owner’s decision), the drop starting well above it', () => {
    const geometry = readerGeometry({ windowHeight: 852, insets });
    const pillBottom = geometry.pillCenterY + dropPillHeight / 2;
    expect(geometry.bottomBarTop - pillBottom).toBe(dropPillGap);
    expect(geometry.pillCenterY - geometry.dropMaxY).toBe(READER_CONFIG.drop.minimumFallPoints);
    expect(geometry.bottomBarTop + glassBarHeight + geometry.bottomBarOffset).toBe(852);
  });

  it('lets the text fade in under the top controls and out above the bottom bar', () => {
    const geometry = readerGeometry({ windowHeight: 852, insets });
    expect(geometry.fadeTopStart).toBeGreaterThan(geometry.topBarTop);
    expect(geometry.fadeTopEnd).toBeGreaterThan(geometry.topBarBottom);
    expect(geometry.fadeBottomStart).toBeLessThan(geometry.bottomBarTop);
    expect(geometry.contentTop).toBeGreaterThan(geometry.fadeTopEnd);
    expect(852 - geometry.contentBottom).toBeLessThan(geometry.fadeBottomStart);
  });

  it('starts a drop at the end of its page, kept in the clear text', () => {
    const geometry = readerGeometry({ windowHeight: 852, insets });
    expect(dropStartY(400, geometry)).toBe(400);
    expect(dropStartY(-200, geometry)).toBe(geometry.dropMinY);
    expect(dropStartY(5000, geometry)).toBe(geometry.dropMaxY);
    expect(dropStartY(null, geometry)).toBe(geometry.dropMaxY);
  });
});
