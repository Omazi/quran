import {
  FALLBACK_LANGUAGE,
  SUPPORTED_LANGUAGES,
  getDisplayedLanguage,
  initI18n,
  isRightToLeftLanguage,
  isSupportedLanguage,
  pickLanguage,
  resolveLanguage,
  setDisplayedLanguage,
} from '@/i18n';
import { resources } from '@/i18n/resources';
import { ONBOARDING_PAGES_FULL } from '@/features/onboarding';

/** The namespaces of the shell: the ones this lot writes. */
const NAMESPACES = ['common', 'onboarding', 'settings'] as const;

/** Suffixes i18next adds to a key that depends on a number, by plural category. */
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

/** Every key of a translation file, as "a.b.c", with the text it holds. */
function flatten(value: unknown, prefix = ''): Map<string, string> {
  if (typeof value === 'string') return new Map([[prefix, value]]);
  if (typeof value !== 'object' || value === null) return new Map();
  const keys = new Map<string, string>();
  for (const [key, child] of Object.entries(value)) {
    for (const [path, text] of flatten(child, prefix === '' ? key : `${prefix}.${key}`)) {
      keys.set(path, text);
    }
  }
  return keys;
}

function keysWithoutPlural(namespace: (typeof NAMESPACES)[number], language: 'fr' | 'en' | 'ar') {
  const keys = [...flatten(resources[language][namespace]).keys()];
  return [...new Set(keys.map((key) => key.replace(PLURAL_SUFFIX, '')))].sort();
}

describe('language of the app', () => {
  it('is the saved choice first', () => {
    expect(resolveLanguage('ar', ['fr', 'en'])).toBe('ar');
    expect(resolveLanguage('en', [])).toBe('en');
  });

  it('is otherwise the first device language the app has', () => {
    expect(resolveLanguage(null, ['de', 'ar', 'fr'])).toBe('ar');
    expect(resolveLanguage(null, ['en'])).toBe('en');
    expect(pickLanguage([null, 'fr'])).toBe('fr');
  });

  it('is otherwise French', () => {
    expect(FALLBACK_LANGUAGE).toBe('fr');
    expect(resolveLanguage(null, ['de', 'es'])).toBe('fr');
    expect(resolveLanguage(null, [])).toBe('fr');
    expect(resolveLanguage(null, [null])).toBe('fr');
  });

  it('knows French, English and Arabic, and that only Arabic is written right to left', () => {
    expect([...SUPPORTED_LANGUAGES]).toEqual(['fr', 'en', 'ar']);
    expect(SUPPORTED_LANGUAGES.filter(isRightToLeftLanguage)).toEqual(['ar']);
    expect(isSupportedLanguage('ar')).toBe(true);
    expect(isSupportedLanguage('fa')).toBe(false);
    expect(isSupportedLanguage('')).toBe(false);
  });
});

describe('translations', () => {
  it('are ready as soon as they are initialised, and switch at once', () => {
    const i18n = initI18n('fr');
    expect(getDisplayedLanguage()).toBe('fr');
    expect(i18n.t('settings:title')).toBe('Réglages');

    setDisplayedLanguage('ar');
    expect(getDisplayedLanguage()).toBe('ar');
    expect(i18n.t('settings:title')).toBe('الإعدادات');

    // Initialising again only switches the language.
    expect(initI18n('en')).toBe(i18n);
    expect(i18n.t('settings:title')).toBe('Settings');
  });

  it.each(NAMESPACES)('have the same keys in English and Arabic as in French: %s', (namespace) => {
    const reference = keysWithoutPlural(namespace, 'fr');
    expect(reference.length).toBeGreaterThan(0);
    expect(keysWithoutPlural(namespace, 'en')).toEqual(reference);
    expect(keysWithoutPlural(namespace, 'ar')).toEqual(reference);
  });

  it.each(SUPPORTED_LANGUAGES)('leave no text empty: %s', (language) => {
    const emptyKeys = NAMESPACES.flatMap((namespace) =>
      [...flatten(resources[language][namespace])]
        .filter(([, text]) => text.trim() === '')
        .map(([key]) => `${namespace}:${key}`),
    );
    expect(emptyKeys).toEqual([]);
  });

  it.each(SUPPORTED_LANGUAGES)('have a title and a sentence for every page: %s', (language) => {
    const keys = flatten(resources[language].onboarding);
    for (const page of ONBOARDING_PAGES_FULL) {
      expect(keys.has(page.title)).toBe(true);
      expect(keys.has(page.text)).toBe(true);
    }
  });

  it.each(SUPPORTED_LANGUAGES)(
    'have every plural form the language needs, so no number shows a raw key: %s',
    (language) => {
      const i18n = initI18n(language);
      for (let count = 1; count <= 604; count += 1) {
        for (const key of [
          'settings:goal.pace',
          'settings:goal.duration',
          'onboarding:scenes.drought',
        ]) {
          const text = i18n.t(key, { count });
          expect(text).not.toContain('goal.');
          expect(text).not.toContain('scenes.');
          expect(text).not.toContain('{{');
        }
      }
    },
  );

  it('write the goal note as one sentence in each language', () => {
    const note = (language: 'fr' | 'en' | 'ar', pages: number, days: number) => {
      const i18n = initI18n(language);
      return i18n.t('settings:goal.noteWithLandmark', {
        pace: i18n.t('settings:goal.pace', { count: pages }),
        landmark: i18n.t('settings:goal.landmark.half-hizb'),
        duration: i18n.t('settings:goal.duration', { count: days }),
      });
    };
    expect(note('fr', 5, 121)).toBe(
      '5 pages par jour, soit un demi-hizb : une khatma en 121 jours.',
    );
    expect(note('en', 5, 121)).toBe('5 pages a day, half a hizb: a khatma in 121 days.');
    expect(note('ar', 5, 121)).toBe('5 صفحات في اليوم، أي نصف حزب: ختمة في 121 يومًا.');
  });

  it('follow the Arabic rules for numbers: one, two, a few, many', () => {
    const i18n = initI18n('ar');
    const pace = (count: number) => i18n.t('settings:goal.pace', { count });
    expect(pace(1)).toBe('صفحة واحدة في اليوم');
    expect(pace(2)).toBe('صفحتان في اليوم');
    expect(pace(10)).toBe('10 صفحات في اليوم');
    expect(pace(11)).toBe('11 صفحة في اليوم');
    expect(pace(60)).toBe('60 صفحة في اليوم');
    const duration = (count: number) => i18n.t('settings:goal.duration', { count });
    expect(duration(11)).toBe('ختمة في 11 يومًا');
    expect(duration(101)).toBe('ختمة في 101 يوم');
    expect(duration(604)).toBe('ختمة في 604 أيام');
  });
});
