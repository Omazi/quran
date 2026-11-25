/**
 * The last page opened in the reader, which the page to resume starts from (spec 1).
 *
 * PROVISIONAL, reported to the architect: the store of the app has no place for this page, and
 * the spec forbids working around a missing piece of the store in a screen. Until the store keeps
 * it, the page is remembered here, in memory, for as long as the app runs: after a relaunch the
 * page to resume falls back to the first unread page of the khatma (`resolveResumePage`).
 */

import { useSyncExternalStore } from 'react';

import { assertPageNumber } from '@/domain/quran';

type Listener = () => void;

let lastOpenedPage: number | null = null;
const listeners = new Set<Listener>();

export function rememberOpenedPage(page: number): void {
  assertPageNumber(page);
  if (page === lastOpenedPage) return;
  lastOpenedPage = page;
  for (const listener of listeners) listener();
}

export function getLastOpenedPage(): number | null {
  return lastOpenedPage;
}

/** Forgets the page: for tests, which must not depend on each other. */
export function forgetOpenedPage(): void {
  lastOpenedPage = null;
  for (const listener of listeners) listener();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The last page opened in the reader, kept up to date. */
export function useLastOpenedPage(): number | null {
  return useSyncExternalStore(subscribe, getLastOpenedPage, getLastOpenedPage);
}
