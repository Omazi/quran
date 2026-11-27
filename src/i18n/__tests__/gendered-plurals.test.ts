/**
 * Second pass of D47: a feminine form of a text that counts ("description_female_one") must have
 * its plain plural ("description_one") and the same variables, and the texts that speak to the
 * person say the feminine in Arabic and French.
 */
import { getTranslator, initI18n, type AppLanguage } from '../index';
import { NAMESPACES, resources } from '../resources';

beforeAll(() => initI18n('fr'));

const PLURAL = '(?:_(?:zero|one|two|few|many|other))?';
const GENDERED = new RegExp(`^(.*?)_(male|female)${PLURAL}$`);

function entriesOf(value: unknown, prefix = ''): [string, string][] {
  if (typeof value === 'string') return [[prefix, value]];
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) =>
    entriesOf(child, prefix === '' ? key : `${prefix}.${key}`),
  );
}

const variables = (text: string) =>
  [...new Set([...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))].sort();

describe.each(['fr', 'en', 'ar'] as const)(
  'every gendered text of %s, plurals included',
  (lang) => {
    const entries = NAMESPACES.flatMap((ns) =>
      entriesOf(resources[lang][ns]).map(([key, text]): [string, string, string] => [
        ns,
        key,
        text,
      ]),
    );
    const byKey = new Map(entries.map(([ns, key, text]) => [`${ns}:${key}`, text]));
    const gendered = entries.filter(([, key]) => GENDERED.test(key.split('.').pop() ?? ''));

    /** The plain key of a gendered key: "description_female_one" is "description_one". */
    const plainKey = (key: string) =>
      key.replace(/_(male|female)(?=(_(zero|one|two|few|many|other))?$)/, '');

    it('has its plain key, with the same variables (a friend page may use a pronoun for a name)', () => {
      expect(gendered.length).toBeGreaterThan(0);
      for (const [ns, key, text] of gendered) {
        const plain = byKey.get(`${ns}:${plainKey(key)}`);
        expect([ns, key, plain === undefined]).toEqual([ns, key, false]);
        // A form may replace a name by a pronoun ("lui", "معه"), never add a variable.
        const extra = variables(text).filter((name) => !variables(plain ?? '').includes(name));
        expect([ns, key, extra]).toEqual([ns, key, []]);
        // The texts that speak to the person keep every variable of the plain text.
        if (ns !== 'friends')
          expect([ns, key, variables(text)]).toEqual([ns, key, variables(plain ?? '')]);
      }
    });

    it('has a feminine for every masculine, and the other way round', () => {
      for (const [ns, key] of gendered) {
        const other = key.includes('_male') ? key.replace('_male', '_female') : null;
        if (other !== null) expect(byKey.has(`${ns}:${other}`)).toBe(true);
      }
    });
  },
);

describe('the Arabic of the second pass', () => {
  const t = (ns: 'home' | 'listening' | 'reader' | 'settings' | 'garden') =>
    getTranslator('ar', ns);

  it.each([
    ['garden', 'view3d.hint', 'اسحب للتدوير، واقرص للتكبير', 'اسحبي للتدوير، واقرصي للتكبير'],
    ['reader', 'bar.listen', 'رتّل ويتابعك التطبيق', 'رتّلي ويتابعك التطبيق'],
    ['home', 'actions.read', 'اقرأ واسقِ', 'اقرئي واسقي'],
    ['settings', 'reminders.notice.denied', 'اسمح بها', 'اسمحي بها'],
    ['listening', 'actions.start', 'ابدأ الاستماع', 'ابدئي الاستماع'],
  ] as const)('%s %s', (ns, key, masculine, feminine) => {
    expect(t(ns)(key, { context: undefined })).toContain(masculine);
    expect(t(ns)(key, { context: 'male' })).toContain(masculine);
    expect(t(ns)(key, { context: 'female' })).toContain(feminine);
  });

  it.each([
    [1, 'موضع واحد'],
    [2, 'موضعين'],
    [3, '3 مواضع'],
    [11, '11 موضعًا'],
    [100, '100 موضع'],
  ] as const)('keeps the plural of %s with the feminine', (count, words) => {
    const text = t('listening')('several.description', { count, context: 'female' });
    expect(text).toContain(words);
    expect(text).toContain('اختاري');
    expect(text).toContain('تتلينه');
  });

  it('keeps the plain plural when no form is written for a count', () => {
    expect(t('listening')('several.description', { count: 0, context: 'female' })).toBe(
      t('listening')('several.description', { count: 0 }),
    );
  });
});

describe('the French of the second pass', () => {
  const t = (language: AppLanguage) => getTranslator(language, 'listening');

  it.each([
    ['male', 'Je ne t’ai pas entendu'],
    ['female', 'Je ne t’ai pas entendue'],
    [undefined, 'Je ne t’ai pas entendu'],
  ] as const)('"Je ne t’ai pas entendu", for a person who is %s', (context, expected) => {
    expect(t('fr')('nothingHeard.title', { context })).toBe(expected);
  });

  it.each([
    ['male', 'Prêt quand tu l’es'],
    ['female', 'Prête quand tu l’es'],
    [undefined, 'Prêt quand tu l’es'],
  ] as const)('the listening page, for a person who is %s', (context, expected) => {
    expect(t('fr')('ready.title', { context })).toBe(expected);
  });

  it('needs nothing in English', () => {
    expect(t('en')('nothingHeard.title', { context: 'female' })).toBe(
      t('en')('nothingHeard.title'),
    );
  });
});
