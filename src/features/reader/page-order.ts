/**
 * The order of the pages and their bounds (docs/specs/reader.md, section 2). Pages are numbered
 * 1 to 604, as readers know them.
 */

import { assertPageNumber, PAGE_COUNT } from '@/domain/quran';

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

/** The page after this one, or null on the last page. */
export function nextPage(page: number): number | null {
  assertPageNumber(page);
  return page === LAST_PAGE ? null : page + 1;
}

/** The page before this one, or null on the first page. */
export function previousPage(page: number): number | null {
  assertPageNumber(page);
  return page === FIRST_PAGE ? null : page - 1;
}

/**
 * The pager lays its pages out from left to right in every interface language (the content is
 * not mirrored: right-to-left.md, and spec 2). To read like the printed book, where the next page
 * is on the left, the pages are laid out from 604 on the left to 1 on the right.
 */
export function pagerIndexOfPage(page: number): number {
  assertPageNumber(page);
  return LAST_PAGE - page;
}

export function pageAtPagerIndex(index: number): number {
  if (!Number.isInteger(index) || index < 0 || index >= LAST_PAGE) {
    throw new RangeError(`Invalid pager index: ${index} (expected 0 to ${LAST_PAGE - 1})`);
  }
  return LAST_PAGE - index;
}
