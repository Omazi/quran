// Each variant is imported from its own folder: the package index would bundle every variant.
import { Amiri_700Bold } from '@expo-google-fonts/amiri/700Bold';
import { AmiriQuran_400Regular } from '@expo-google-fonts/amiri-quran/400Regular';

/**
 * Fonts bundled with the app, for Quran text only, keyed by the names used in the `fontFamily`
 * tokens. The interface itself uses the system fonts. Pass this map to `useFonts` once, in the
 * root layout.
 */
export const appFonts = {
  AmiriQuran_400Regular,
  Amiri_700Bold,
} as const;
