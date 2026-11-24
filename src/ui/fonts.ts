import { Amiri_700Bold } from '@expo-google-fonts/amiri';
import { AmiriQuran_400Regular } from '@expo-google-fonts/amiri-quran';

/**
 * Fonts bundled with the app (Quran text only), keyed by the names used in `fontFamily` tokens.
 * Pass this map to `useFonts` once, in the root layout.
 */
export const appFonts = {
  AmiriQuran_400Regular,
  Amiri_700Bold,
} as const;
