import arCommon from './locales/ar/common.json';
import arGarden from './locales/ar/garden.json';
import arHome from './locales/ar/home.json';
import arListening from './locales/ar/listening.json';
import arOnboarding from './locales/ar/onboarding.json';
import arProfile from './locales/ar/profile.json';
import arReader from './locales/ar/reader.json';
import arSettings from './locales/ar/settings.json';
import enCommon from './locales/en/common.json';
import enGarden from './locales/en/garden.json';
import enHome from './locales/en/home.json';
import enListening from './locales/en/listening.json';
import enOnboarding from './locales/en/onboarding.json';
import enProfile from './locales/en/profile.json';
import enReader from './locales/en/reader.json';
import enSettings from './locales/en/settings.json';
import frCommon from './locales/fr/common.json';
import frGarden from './locales/fr/garden.json';
import frHome from './locales/fr/home.json';
import frListening from './locales/fr/listening.json';
import frOnboarding from './locales/fr/onboarding.json';
import frProfile from './locales/fr/profile.json';
import frReader from './locales/fr/reader.json';
import frSettings from './locales/fr/settings.json';

export const SUPPORTED_LANGUAGES = ['fr', 'en', 'ar'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** French is the reference language: a key missing elsewhere falls back to it. */
export const FALLBACK_LANGUAGE: AppLanguage = 'fr';

export const RTL_LANGUAGES: readonly AppLanguage[] = ['ar'];

/** One namespace per feature, so each feature owns its own translation files. */
export const NAMESPACES = [
  'common',
  'onboarding',
  'home',
  'garden',
  'reader',
  'listening',
  'settings',
  'profile',
] as const;

export const resources = {
  fr: {
    common: frCommon,
    onboarding: frOnboarding,
    home: frHome,
    garden: frGarden,
    reader: frReader,
    profile: frProfile,
    listening: frListening,
    settings: frSettings,
  },
  en: {
    common: enCommon,
    onboarding: enOnboarding,
    home: enHome,
    garden: enGarden,
    reader: enReader,
    profile: enProfile,
    listening: enListening,
    settings: enSettings,
  },
  ar: {
    common: arCommon,
    onboarding: arOnboarding,
    home: arHome,
    garden: arGarden,
    reader: arReader,
    profile: arProfile,
    listening: arListening,
    settings: arSettings,
  },
} as const;
