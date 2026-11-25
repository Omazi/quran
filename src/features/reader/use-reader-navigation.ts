import { useRouter } from 'expo-router';
import { useCallback } from 'react';

/** The two ways out of the reader: back where the person came from, or to the contents. */
export interface ReaderNavigation {
  readonly close: () => void;
  readonly openContents: () => void;
  /** The listening screen, from the reader's microphone (owner's decision, 25 November 2026). */
  readonly openListening: () => void;
}

const CONTENTS_ROUTE = '/(tabs)/quran';
const LISTENING_ROUTE = '/listening';

/**
 * Leaves the reader. Back goes where the person came from (the home screen or the Quran tab);
 * a reader opened by a link has nowhere to go back to, so it goes to the contents instead
 * (toolbars.md › Navigation: the back button retraces the person's steps).
 */
export function useReaderNavigation(): ReaderNavigation {
  const router = useRouter();
  const openContents = useCallback(() => router.replace(CONTENTS_ROUTE), [router]);
  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(CONTENTS_ROUTE);
  }, [router]);
  const openListening = useCallback(() => router.push(LISTENING_ROUTE), [router]);
  return { close, openContents, openListening };
}
