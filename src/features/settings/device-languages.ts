import { getLocales } from 'expo-localization';

/**
 * The languages of the phone, most wanted first, as language codes ("fr", "ar"), in the order
 * expo-localization gives them (on iOS it reads `Locale.preferredLanguages`). A code is null when
 * the platform does not give one.
 */
export function readDeviceLanguageCodes(): readonly (string | null)[] {
  return getLocales().map((locale) => locale.languageCode);
}
