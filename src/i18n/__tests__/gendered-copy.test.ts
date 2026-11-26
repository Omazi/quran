/**
 * The texts that depend on gender (owner decision of 26 November 2026, "on demandera le genre"):
 * which wording each language gives to a man, a woman and a person who has not said, and the
 * rules every `key_male` / `key_female` follows.
 */
import { genderContext, getTranslator, initI18n, type AppLanguage } from '../index';
import { NAMESPACES, resources } from '../resources';

beforeAll(() => initI18n('fr'));

const friends = (language: AppLanguage) => getTranslator(language, 'friends');

describe('genderContext', () => {
  it('is the gender itself, and nothing for a person who has not said', () => {
    expect(genderContext('male')).toBe('male');
    expect(genderContext('female')).toBe('female');
    expect(genderContext(null)).toBeUndefined();
    expect(genderContext(undefined)).toBeUndefined();
  });
});

describe('texts about a friend', () => {
  it.each([
    ['fr', 'male', 'Lire avec lui'],
    ['fr', 'female', 'Lire avec elle'],
    ['fr', undefined, 'Lire avec Sarah'],
    ['en', 'male', 'Read with him'],
    ['en', 'female', 'Read with her'],
    ['en', undefined, 'Read with Sarah'],
    ['ar', 'male', 'اقرأ معه'],
    ['ar', 'female', 'اقرأ معها'],
    ['ar', undefined, 'اقرأ مع Sarah'],
  ] as const)('%s, friend %s: "%s"', (language, context, expected) => {
    const t = friends(language);
    expect(t('friend.readWith', { name: 'Sarah', verb: t('friend.readVerb'), context })).toBe(
      expected,
    );
  });

  it.each([
    ['fr', 'male', 'Encouragé aujourd’hui'],
    ['fr', 'female', 'Encouragée aujourd’hui'],
    ['fr', undefined, 'Encouragement envoyé'],
  ] as const)(
    '%s, the status after an encouragement, friend %s: "%s"',
    (language, context, text) => {
      expect(friends(language)('friend.encouraged', { context })).toBe(text);
    },
  );

  it.each([
    ['en', 'male', 'Sarah doesn’t share his garden.'],
    ['en', 'female', 'Sarah doesn’t share her garden.'],
    ['en', undefined, 'Sarah doesn’t share their garden.'],
    ['ar', 'male', 'لا يشارك Sarah حديقته.'],
    ['ar', 'female', 'لا تشارك Sarah حديقتها.'],
    ['ar', undefined, 'حديقة Sarah غير مشارَكة.'],
  ] as const)('%s, a garden not shared, friend %s', (language, context, expected) => {
    expect(friends(language)('friend.gardenHidden', { name: 'Sarah', context })).toBe(expected);
  });

  it.each([
    ['male', 'He will no longer be able to find you'],
    ['female', 'She will no longer be able to find you'],
    [undefined, 'They will no longer be able to find you'],
  ] as const)('en, the blocking message, friend %s', (context, start) => {
    expect(friends('en')('friend.blockMessage', { context })).toMatch(new RegExp(`^${start}`));
  });

  it('French needs no form for what it says of a friend except lui, elle and the participle', () => {
    const t = friends('fr');
    for (const key of ['friend.readingTitle', 'friend.gardenHidden', 'friend.levelHidden']) {
      expect(t(key, { name: 'Sarah', context: 'female' })).toBe(
        t(key, { name: 'Sarah', context: undefined }),
      );
    }
  });
});

describe('texts to the person who reads', () => {
  it.each([
    ['friend.readHint', 'male', 'Ouvre le Coran où tu t’es arrêté.'],
    ['friend.readHint', 'female', 'Ouvre le Coran où tu t’es arrêtée.'],
    ['friend.readHint', undefined, 'Ouvre le Coran là où tu en étais.'],
  ] as const)('fr, %s for a person who is %s', (key, context, expected) => {
    expect(friends('fr')(key, { context })).toBe(expected);
  });

  it.each([
    ['failed.text', 'حاول مرة أخرى بعد قليل.', 'حاولي مرة أخرى بعد قليل.'],
    ['signIn.heading', 'اقرأ مع أحبّتك', 'اقرئي مع أحبّتك'],
    ['list.noFriendsNote', 'أضف أحدًا برمزك، أو بمسح رمزه.', 'أضيفي أحدًا برمزك، أو بمسح رمزه.'],
    ['list.scan', 'امسح', 'امسحي'],
    ['add.shareShort', 'شارك', 'شاركي'],
    ['scan.openSettings', 'افتح الإعدادات', 'افتحي الإعدادات'],
    ['refusals.name-empty', 'اكتب اسمًا.', 'اكتبي اسمًا.'],
    [
      'refusals.invite-expired',
      'لم يعد هذا الرمز صالحًا. اطلب رمزًا جديدًا.',
      'لم يعد هذا الرمز صالحًا. اطلبي رمزًا جديدًا.',
    ],
    [
      'group.notFoundText',
      'لست عضوًا في هذه المجموعة، أو لم تعد كذلك.',
      'لستِ عضوةً في هذه المجموعة، أو لم تعودي كذلك.',
    ],
    [
      'newGroup.note',
      'ستكون مالكها، ثم تضيف إليها أحبّتك.',
      'ستكونين مالكتها، ثم تضيفين إليها أحبّتك.',
    ],
  ] as const)(
    'ar, %s: the masculine imperative for a man or when not said, the feminine for a woman',
    (key, masculine, feminine) => {
      const t = friends('ar');
      expect(t(key, { context: 'male' })).toBe(masculine);
      expect(t(key, { context: undefined })).toBe(masculine);
      expect(t(key, { context: 'female' })).toBe(feminine);
    },
  );

  it('a language with no form for a gender gives the plain text, never the key', () => {
    for (const language of ['fr', 'en', 'ar'] as const) {
      const t = friends(language);
      for (const context of ['male', 'female', undefined] as const) {
        const text = t('friend.cancel', { context });
        expect(text).not.toBe('friend.cancel');
        expect(text).toBe(t('friend.cancel'));
      }
    }
  });
});

/** Every key of a namespace, as a path, with the text. */
function entriesOf(value: unknown, prefix = ''): [string, string][] {
  if (typeof value === 'string') return [[prefix, value]];
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) =>
    entriesOf(child, prefix === '' ? key : `${prefix}.${key}`),
  );
}

describe.each(['fr', 'en', 'ar'] as const)('every gendered text of %s', (language) => {
  const entries = NAMESPACES.flatMap((namespace) =>
    entriesOf(resources[language][namespace]).map(([key, text]): [string, string, string] => [
      namespace,
      key,
      text,
    ]),
  );
  const gendered = entries.filter(([, key]) => /_(male|female)$/.test(key));

  it('has its plain text, and the masculine comes with the feminine', () => {
    const known = new Set(entries.map(([namespace, key]) => `${namespace}:${key}`));
    expect(gendered.length).toBeGreaterThan(0);
    for (const [namespace, key] of gendered) {
      expect(known).toContain(`${namespace}:${key.replace(/_(male|female)$/, '')}`);
      if (key.endsWith('_male'))
        expect(known).toContain(`${namespace}:${key.replace(/_male$/, '_female')}`);
    }
  });

  it('keeps the same placeholders as its plain text, so no form loses a name or a number', () => {
    const placeholders = (text: string) =>
      [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();
    const byKey = new Map(entries.map(([namespace, key, text]) => [`${namespace}:${key}`, text]));
    for (const [namespace, key, text] of gendered) {
      const plain = byKey.get(`${namespace}:${key.replace(/_(male|female)$/, '')}`) ?? '';
      // A neutral wording may need a placeholder a gendered form replaces by a pronoun ("lui",
      // "معه"), never the other way round.
      for (const name of placeholders(text)) expect(placeholders(plain)).toContain(name);
    }
  });

  it('differs from the plain text, or it would not need to exist', () => {
    const byKey = new Map(entries.map(([namespace, key, text]) => [`${namespace}:${key}`, text]));
    for (const [namespace, key, text] of gendered) {
      const plain = byKey.get(`${namespace}:${key.replace(/_(male|female)$/, '')}`);
      // The masculine of Arabic imperatives is the plain text; only a feminine form is written.
      if (language === 'ar' && key.endsWith('_male') && plain === text) continue;
      expect([namespace, key, text === plain]).toEqual([namespace, key, false]);
    }
  });
});
