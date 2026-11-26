import { router } from 'expo-router';
import { useCallback } from 'react';

import { markOpenedInApp } from './in-app-open';

type Navigate = (href: '/listening') => void;

const pushRoute: Navigate = (href) => router.push(href);

/**
 * Opens the recognition of a passage (`/listening`) from a button of the app: the card
 * "Quel est ce passage ?" of the Quran tab and "Reconnaître" on the home screen (maquettes
 * 2026-11-26, 3A and 3C). The opening is marked as the app's own first (`markOpenedInApp`), so the
 * microphone starts at once after this tap, and never after a link that opens the same screen.
 */
export function useOpenRecognition(navigate: Navigate = pushRoute): () => void {
  return useCallback(() => {
    markOpenedInApp('listening');
    navigate('/listening');
  }, [navigate]);
}
