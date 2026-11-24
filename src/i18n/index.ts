import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import {
  FALLBACK_LANGUAGE,
  NAMESPACES,
  RTL_LANGUAGES,
  SUPPORTED_LANGUAGES,
  resources,
  type AppLanguage,
} from './resources';

/** The app's single translation instance. */
const i18n = createInstance();

export function isSupportedLanguage(code: string): code is AppLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(code);
}

/** Picks the first device language the app supports, or the fallback. */
export function pickLanguage(deviceLanguageCodes: readonly (string | null)[]): AppLanguage {
  for (const code of deviceLanguageCodes) {
    if (code && isSupportedLanguage(code)) return code;
  }
  return FALLBACK_LANGUAGE;
}

/**
 * The language to show: the choice the person saved in the app, otherwise the first device
 * language the app supports, otherwise French.
 */
export function resolveLanguage(
  savedLanguage: AppLanguage | null,
  deviceLanguageCodes: readonly (string | null)[],
): AppLanguage {
  return savedLanguage ?? pickLanguage(deviceLanguageCodes);
}

/** Whether a language is written from right to left, which mirrors the whole interface. */
export function isRightToLeftLanguage(language: AppLanguage): boolean {
  return RTL_LANGUAGES.includes(language);
}

/**
 * Initialises translations with the language to use (see `resolveLanguage`). Call it before
 * rendering. The resources are bundled, so the translations are ready when it returns. Calling it
 * again only switches the language.
 */
export function initI18n(language: AppLanguage): typeof i18n {
  if (i18n.isInitialized) {
    setDisplayedLanguage(language);
    return i18n;
  }
  void i18n.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: FALLBACK_LANGUAGE,
    ns: [...NAMESPACES],
    defaultNS: 'common',
    interpolation: { escapeValue: false }, // React already escapes rendered text.
    returnNull: false,
  });
  return i18n;
}

/** The language the interface is shown in right now. */
export function getDisplayedLanguage(): AppLanguage {
  const language = i18n.language;
  return typeof language === 'string' && isSupportedLanguage(language)
    ? language
    : FALLBACK_LANGUAGE;
}

/**
 * Switches the texts to another language, at once. It does not mirror the layout: the writing
 * direction of a React Native app is fixed when it starts.
 */
export function setDisplayedLanguage(language: AppLanguage): void {
  if (i18n.language !== language) void i18n.changeLanguage(language);
}

export {
  FALLBACK_LANGUAGE,
  RTL_LANGUAGES,
  SUPPORTED_LANGUAGES,
  type AppLanguage,
} from './resources';
