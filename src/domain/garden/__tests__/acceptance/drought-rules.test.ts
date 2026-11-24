/**
 * Acceptance tests of docs/specs/garden.md, section "Sécheresse et santé": one test per rule.
 * Histories use the notation of acceptance-kit.ts (W watered, M missed, P paused, last
 * letter = today, "." = nothing read yet today). Expected values are worked out by hand.
 */
import { computeGardenState } from '@/domain/garden';
import { addDays } from '@/domain/shared/local-date';

import { bareEarthInput, day, FIRST_DAY, historyInput } from './acceptance-kit';

function droughtAfter(history: string): number {
  return computeGardenState(historyInput(history)).droughtDays;
}

describe('rule "jour manqué": drought + 1, capped at 14', () => {
  it.each([
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 3],
    [5, 5],
    [6, 6],
    [9, 9],
    [10, 10],
    [13, 13],
    [14, 14],
    [15, 14],
    [30, 14],
    [400, 14],
  ])('a healthy garden left %i whole days has %i drought days', (missedDays, expected) => {
    expect(droughtAfter('W' + 'M'.repeat(missedDays) + '.')).toBe(expected);
  });

  it('a missed day counts even when the garden was never watered (first day included)', () => {
    // First day missed, second day missed, today open: 0 + 1 + 1 = 2.
    expect(droughtAfter('MM.')).toBe(2);
  });
});

describe('rule "jour arrosé": drought − 3, never below 0', () => {
  it.each([
    // From the dead earth (14): 14 − 3 = 11, 8, 5, 2, then max(0, 2 − 3) = 0.
    [1, 11],
    [2, 8],
    [3, 5],
    [4, 2],
    [5, 0],
    [6, 0],
  ])('dead earth then %i watered days: drought %i', (wateredDays, expected) => {
    // Seen on the last watered day itself...
    expect(droughtAfter('W' + 'M'.repeat(14) + 'W'.repeat(wateredDays))).toBe(expected);
    // ...and the same the next morning, before anything is read.
    expect(droughtAfter('W' + 'M'.repeat(14) + 'W'.repeat(wateredDays) + '.')).toBe(expected);
  });

  it.each([
    ['WM' + 'W', 0], // 1 − 3 → 0
    ['WMM' + 'W', 0], // 2 − 3 → 0
    ['WMMM' + 'W', 0], // 3 − 3 = 0
    ['WMMMM' + 'W', 1], // 4 − 3 = 1
    ['WMMMMMMM' + 'W', 4], // 7 − 3 = 4
  ])('%s: drought %i', (history, expected) => {
    expect(droughtAfter(history)).toBe(expected);
  });

  it('watering a garden that is not dry keeps it at 0', () => {
    expect(droughtAfter('W'.repeat(40))).toBe(0);
  });

  it('a long reading streak gives no credit: 3 missed days still make 3 drought days', () => {
    expect(droughtAfter('W'.repeat(100) + 'MMM.')).toBe(3);
  });

  it('reading one day in four keeps the garden between 0 and 3', () => {
    // W: 0; MMM: 3; W: 0... seen at the end of each stretch of three missed days.
    expect(droughtAfter('WMMM'.repeat(25) + '.')).toBe(3);
    expect(droughtAfter('WMMM'.repeat(25) + 'W')).toBe(0);
  });

  it('reading one day in five slowly dries the garden: +1 per period of five days', () => {
    // Each "MMMMW" is +4 − 3 = +1 (no floor reached). After 6 periods: 6, then 4 more: 10.
    expect(droughtAfter('W' + 'MMMMW'.repeat(6) + '.')).toBe(6);
    expect(droughtAfter('W' + 'MMMMW'.repeat(6) + 'MMMM.')).toBe(10);
  });
});

describe('rule "jour en pause": nothing changes', () => {
  it.each([
    ['WMMMM' + 'PPPP' + '.', 4],
    ['WMM' + 'PPP' + 'MM.', 4],
    ['W' + 'P'.repeat(400) + '.', 0],
    ['W' + 'M'.repeat(14) + 'P'.repeat(30) + '.', 14],
    ['W' + 'M'.repeat(20) + 'PPP' + 'W', 11],
    ['WMM' + 'P' + 'W', 0],
    ['P'.repeat(10) + '.', 0],
    ['PMPMPMP' + '.', 3],
  ])('%s: drought %i', (history, expected) => {
    expect(droughtAfter(history)).toBe(expected);
  });

  it('the run of missed days is neither extended nor reset by a pause', () => {
    const state = computeGardenState(historyInput('WMM' + 'PPP' + 'MM.'));
    expect(state.missedDaysInARow).toBe(4);
    expect(computeGardenState(historyInput('WMM' + 'PPP' + '.')).missedDaysInARow).toBe(2);
  });

  it.each(['one-per-run', 'one-per-day', 'overlapping'] as const)(
    'the way the paused days are cut into pauses (%s) does not matter',
    (pauseStyle) => {
      const history = 'WMMPPPPPMMPMMPP.';
      // Missed days: 2 + 2 + 2 = 6.
      const state = computeGardenState(historyInput(history, { pauseStyle }));
      expect(state.droughtDays).toBe(6);
      expect(state.missedDaysInARow).toBe(6);
    },
  );

  it('a pause that started before the garden and ends after today freezes every day', () => {
    const input = historyInput('WMMMMM.', {
      extraPauses: [{ from: addDays(FIRST_DAY, -30), to: addDays(FIRST_DAY, 60) }],
    });
    expect(computeGardenState(input).droughtDays).toBe(0);
  });

  it('pauses entirely before the first day or after today change nothing', () => {
    const input = historyInput('WMMMMM.', {
      extraPauses: [
        { from: addDays(FIRST_DAY, -30), to: addDays(FIRST_DAY, -1) },
        { from: addDays(FIRST_DAY, 7), to: addDays(FIRST_DAY, 20) },
      ],
    });
    expect(computeGardenState(input).droughtDays).toBe(5);
  });

  it('both ends of a pause are included', () => {
    // Days 0..6; the pause covers days 2 to 4 exactly: missed days are 1 and 5.
    const input = historyInput('WMMMMM.', {
      extraPauses: [{ from: addDays(FIRST_DAY, 2), to: addDays(FIRST_DAY, 4) }],
    });
    expect(computeGardenState(input).droughtDays).toBe(2);
  });
});

describe('rule "la journée en cours ne pénalise jamais"', () => {
  it('today is ignored while nothing is read, and becomes a missed day the day after', () => {
    expect(droughtAfter('WMM' + '.')).toBe(2);
    expect(droughtAfter('WMM' + 'M' + '.')).toBe(3);
  });

  it('today counts as soon as it is watered', () => {
    expect(droughtAfter('WMMMMM' + '.')).toBe(5);
    expect(droughtAfter('WMMMMM' + 'W')).toBe(2);
  });

  it('on the last day before death, today still shows 13 and not 14', () => {
    expect(droughtAfter('W' + 'M'.repeat(13) + '.')).toBe(13);
  });
});

describe('rule "avant le premier hizb": the garden does not exist yet, nothing can dry', () => {
  it('a bare earth never dries, however long nothing is read', () => {
    const state = computeGardenState(bareEarthInput(day('2027-06-01'), [day('2026-01-10')]));
    expect(state.phase).toBe('bare');
    expect(state.droughtDays).toBe(0);
    expect(state.health).toBe(1);
    expect(state.missedDaysInARow).toBe(0);
    expect(state.visibleElements).toEqual([]);
  });

  it('the days before firstHizbCompletedOn do not count, read or not', () => {
    // The user read on scattered days, was away 40 days, then finished the first hizb.
    const before = [-90, -89, -70, -41].map((offset) => addDays(FIRST_DAY, offset));
    const input = historyInput('WMM.', { hizbCompleted: 1, extraWateredDays: before });
    expect(computeGardenState(input).droughtDays).toBe(2);
  });
});

describe('health = 1 − drought / 14', () => {
  it.each(Array.from({ length: 15 }, (_, droughtDays) => droughtDays))(
    'drought %i',
    (droughtDays) => {
      const state = computeGardenState(historyInput('W' + 'M'.repeat(droughtDays) + '.'));
      expect(state.droughtDays).toBe(droughtDays);
      expect(state.health).toBeCloseTo(1 - droughtDays / 14, 12);
    },
  );

  it('is exactly 1 at full health and exactly 0 on the dead earth', () => {
    expect(computeGardenState(historyInput('W')).health).toBe(1);
    expect(computeGardenState(historyInput('W' + 'M'.repeat(14) + '.')).health).toBe(0);
    expect(computeGardenState(historyInput('W' + 'M'.repeat(7) + '.')).health).toBe(0.5);
  });
});

describe('landmarks of the spec ("Repères, depuis un jardin en pleine santé")', () => {
  it.each([
    [2, 'thriving'],
    [3, 'thirsty'],
    [6, 'wilting'],
    [10, 'dying'],
    [14, 'dead'],
  ])('%i days without reading: %s', (missedDays, phase) => {
    expect(computeGardenState(historyInput('W' + 'M'.repeat(missedDays) + '.')).phase).toBe(phase);
  });

  it('from the dead earth, five days of reading bring back full health', () => {
    const dead = 'W' + 'M'.repeat(30);
    const healthByReadingDay = [1, 2, 3, 4, 5].map(
      (readingDays) => computeGardenState(historyInput(dead + 'W'.repeat(readingDays))).health,
    );
    expect(healthByReadingDay[3]).toBeLessThan(1);
    expect(healthByReadingDay[4]).toBe(1);
  });

  it('from the dead earth, the first day of reading already revives the garden', () => {
    const state = computeGardenState(historyInput('W' + 'M'.repeat(30) + 'W'));
    expect(state.phase).toBe('dying');
    expect(state.visibleElements.length).toBeGreaterThan(0);
    expect(state.water).toBe('flowing');
  });
});
