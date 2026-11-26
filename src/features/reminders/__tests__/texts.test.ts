/**
 * The example words of each kind (`kinds.<kind>`), shown by the previews of the first launch: in
 * the three languages, short, in the spiritual voice of the reminders, and without data (the
 * notifications themselves are `variants.<kind>`, see reminder-copy.test.ts and
 * docs/specs/reminders-copy.md).
 */
import { REMINDER_PRIORITY } from '@/domain/reminders';
import ar from '@/i18n/locales/ar/notifications.json';
import en from '@/i18n/locales/en/notifications.json';
import fr from '@/i18n/locales/fr/notifications.json';

const KINDS = [...REMINDER_PRIORITY, 'friday-kahf'] as const;
const LANGUAGES = { fr, en, ar } as const;

/** Letters only: the vowel marks of the Arabic take no width on a lock screen. */
function visibleLength(text: string): number {
  return [...text.normalize('NFC').replace(/\p{M}/gu, '')].length;
}

describe.each(Object.entries(LANGUAGES))('%s', (_language, texts) => {
  it.each(KINDS)('has a title and a body for %s', (kind) => {
    const entry = texts.kinds[kind];
    expect(entry.title.trim().length).toBeGreaterThan(0);
    expect(entry.body.trim().length).toBeGreaterThan(0);
  });

  it('has no text for a kind that does not exist', () => {
    expect(Object.keys(texts.kinds).sort()).toEqual([...KINDS].sort());
  });

  it('keeps every text short enough for a lock screen', () => {
    for (const { title, body } of Object.values(texts.kinds)) {
      expect(visibleLength(title)).toBeLessThanOrEqual(35);
      expect(visibleLength(body)).toBeLessThanOrEqual(90);
    }
  });

  it('says no number in the examples: they show no one’s reading', () => {
    const all = Object.values(texts.kinds).flatMap(({ title, body }) => [title, body]);
    expect(all.filter((text) => /[0-9٠-٩]/.test(text))).toEqual([]);
  });

  it('never shouts or scolds', () => {
    const all = Object.values(texts.kinds).flatMap(({ title, body }) => [title, body]);
    expect(all.filter((text) => /!/.test(text))).toEqual([]);
  });

  it('has a channel name and a hidden-preview text', () => {
    expect(texts.channel.length).toBeGreaterThan(0);
    expect(texts.hiddenPreview.length).toBeGreaterThan(0);
  });
});

it('Arabic is written in Arabic letters', () => {
  const all = Object.values(ar.kinds).flatMap(({ title, body }) => [title, body]);
  expect(all.every((text) => /[؀-ۿ]/.test(text))).toBe(true);
});

it('among the examples, only the Friday reminder names a sourate', () => {
  for (const [kind, { title, body }] of Object.entries(fr.kinds)) {
    const mentionsSurah = /Al-Kahf|sourate/i.test(`${title} ${body}`);
    expect(mentionsSurah).toBe(kind === 'friday-kahf');
  }
});
