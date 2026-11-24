import { HIZB_COUNT, PAGE_COUNT, SURAH_COUNT } from './types';

/**
 * Guards of the module. Invalid input always raises an explicit error; nothing is silently
 * corrected (see docs/CONTRIBUTING.md).
 */

function assertWholeNumberInRange(value: number, max: number, label: string): void {
  if (!Number.isInteger(value) || value < 1 || value > max) {
    throw new RangeError(`Invalid ${label}: ${value} (expected a whole number from 1 to ${max})`);
  }
}

export function assertSurahNumber(surah: number): void {
  assertWholeNumberInRange(surah, SURAH_COUNT, 'surah');
}

export function assertPageNumber(page: number): void {
  assertWholeNumberInRange(page, PAGE_COUNT, 'page');
}

export function assertHizbNumber(hizb: number): void {
  assertWholeNumberInRange(hizb, HIZB_COUNT, 'hizb');
}
