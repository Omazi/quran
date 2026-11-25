/**
 * The time a page asks before it counts (owner's decision, 25 November 2026): it grows with the
 * number of words of that page of the mushaf, with a floor so that the short pages count too.
 */

import { requiredReadingSeconds } from '../reading-time';

const RULES = { secondsPerWord: 0.2, minimumSeconds: 8 } as const;

describe('requiredReadingSeconds', () => {
  it('asks a fixed time per word: a median page of 128 words asks about 25 seconds', () => {
    expect(requiredReadingSeconds(128, RULES)).toBeCloseTo(25.6);
    expect(requiredReadingSeconds(200, RULES)).toBeCloseTo(40);
  });

  it('never asks less than the minimum, so that short pages (1, 2, 604) can count', () => {
    expect(requiredReadingSeconds(29, RULES)).toBe(8);
    expect(requiredReadingSeconds(40, RULES)).toBe(8);
    expect(requiredReadingSeconds(41, RULES)).toBeCloseTo(8.2);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('refuses %p words', (words) => {
    expect(() => requiredReadingSeconds(words, RULES)).toThrow(RangeError);
  });

  it.each([
    { secondsPerWord: 0, minimumSeconds: 8 },
    { secondsPerWord: -0.2, minimumSeconds: 8 },
    { secondsPerWord: 0.2, minimumSeconds: -1 },
    { secondsPerWord: Number.NaN, minimumSeconds: 8 },
  ])('refuses rules that are not positive numbers (%p)', (rules) => {
    expect(() => requiredReadingSeconds(100, rules)).toThrow(RangeError);
  });
});
