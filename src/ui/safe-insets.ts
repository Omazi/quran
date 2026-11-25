import { useContext } from 'react';
import { SafeAreaInsetsContext, type EdgeInsets } from 'react-native-safe-area-context';

const NO_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * The safe-area insets of the screen (layout.md › Guides and safe areas). Expo Router provides
 * them to every route; a screen rendered alone, as in a test, gets none instead of an error.
 */
export function useSafeInsets(): EdgeInsets {
  return useContext(SafeAreaInsetsContext) ?? NO_INSETS;
}
