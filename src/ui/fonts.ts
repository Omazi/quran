// Each variant is imported from its own folder: the package index would bundle every variant.
import { Amiri_700Bold } from '@expo-google-fonts/amiri/700Bold';

/**
 * The Quran font: "KFGQPC HAFS Uthmanic Script" version 0.18 of the King Fahd Complex,
 * shipped unmodified (docs/DECISIONS.md, D19; licence in assets/fonts/NOTICE.txt).
 *
 * The Uthmani text of the app was published for this exact version: some of its signs only
 * have the right shape in it. Never swap the file for another version on its own (see
 * docs/DATA_SOURCES.md). `require` is how Metro and Jest turn a font file into an asset.
 */
const KFGQPCHafsUthmanic: number = require('../../assets/fonts/KFGQPC-HAFS-Uthmanic-Script-v0.18.ttf');

/**
 * Fraunces SemiBold, the serif of the titles in the validated mockups (owner's decision of
 * 25 November 2026; SIL Open Font License, see assets/fonts/NOTICE.txt). One weight is shipped:
 * every title is set in it.
 */
const FrauncesSemiBold: number = require('../../assets/fonts/Fraunces-SemiBold.ttf');

/**
 * Fonts bundled with the app, keyed by the names used in the `fontFamily` tokens: the Quran
 * fonts, and the serif of the titles. The rest of the interface uses the system font. Pass this
 * map to `useFonts` once, in the root layout, which waits for them before the first screen.
 */
export const appFonts = {
  KFGQPCHafsUthmanic,
  Amiri_700Bold,
  FrauncesSemiBold,
} as const;
