import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import {
  FALLBACK_LANGUAGE,
  NAMESPACES,
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
 * Initialises translations. Call once, before rendering, with the language to use
 * (the saved user choice, or `pickLanguage(...)` from the device locales).
 */
export function initI18n(language: AppLanguage): typeof i18n {
  if (!i18n.isInitialized) {
    void i18n.use(initReactI18next).init({
      resources,
      lng: language,
      fallbackLng: FALLBACK_LANGUAGE,
      ns: [...NAMESPACES],
      defaultNS: 'common',
      interpolation: { escapeValue: false }, // React already escapes rendered text.
      returnNull: false,
    });
  }
  return i18n;
}

export {
  FALLBACK_LANGUAGE,
  RTL_LANGUAGES,
  SUPPORTED_LANGUAGES,
  type AppLanguage,
} from './resources';
