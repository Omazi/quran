import { router, type Href } from 'expo-router';
import { useCallback } from 'react';
import { Linking } from 'react-native';

/**
 * The address of the reader at a page (docs/specs/reader.md). The reader is built in another
 * lot: until its route exists, typed routes cannot know this address, hence the cast.
 */
export function readerHref(page: number): Href {
  return `/reader/${page}` as Href;
}

export interface ListeningNavigation {
  readonly close: () => void;
  readonly openPage: (page: number) => void;
  readonly openSettings: () => void;
}

/** Where the listening screen leads: back, the reader, the system settings. */
export function useListeningNavigation(): ListeningNavigation {
  const close = useCallback(() => {
    // Opened by its address, the screen may have nothing behind it: then home.
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);
  const openPage = useCallback((page: number) => router.push(readerHref(page)), []);
  // The app's own page in Settings (writing.md › Best practices: a button, not directions).
  const openSettings = useCallback(() => void Linking.openSettings(), []);
  return { close, openPage, openSettings };
}
