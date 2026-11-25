/**
 * The bounds of the pages (docs/specs/reader.md, section 2). Pages are numbered 1 to 604, as
 * readers know them.
 */

import { PAGE_COUNT } from '@/domain/quran';

export const FIRST_PAGE = 1;
export const LAST_PAGE = PAGE_COUNT;

/** Digits only, without a leading zero: "007" and "7 " are not addresses of page 7. */
const PAGE_PARAM = /^[1-9][0-9]*$/;

export function isPageNumber(value: number): boolean {
  return Number.isInteger(value) && value >= FIRST_PAGE && value <= LAST_PAGE;
}

/**
 * The page of a route such as `/reader/293`, or null when the address names no page of the
 * mushaf: the screen then says the page was not found.
 */
export function parsePageParam(param: string | readonly string[] | undefined): number | null {
  if (typeof param !== 'string' || !PAGE_PARAM.test(param)) return null;
  const page = Number(param);
  return isPageNumber(page) ? page : null;
}
