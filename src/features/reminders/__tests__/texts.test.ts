/**
 * The words of the notifications (docs/specs/reminders.md, "Texte des notifications"): every
 * kind has them in the three languages, short, in the voice of the garden, and nothing on the
 * lock screen says how much the person reads.
 */
import { REMINDER_PRIORITY } from '@/domain/reminders';
import ar from '@/i18n/locales/ar/notifications.json';
import en from '@/i18n/locales/en/notifications.json';
import fr from '@/i18n/locales/fr/notifications.json';

const KINDS = [...REMINDER_PRIORITY, 'friday-kahf'] as const;
const LANGUAGES = { fr, en, ar } as const;

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
      expect(title.length).toBeLessThanOrEqual(40);
      expect(body.length).toBeLessThanOrEqual(90);
    }
  });

  it('says no number: not the pages read, not the days without reading', () => {
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

it('only the Friday reminder names a sourate, and the others stay about the garden', () => {
  for (const [kind, { title, body }] of Object.entries(fr.kinds)) {
    const mentionsSurah = /Al-Kahf|sourate/i.test(`${title} ${body}`);
    expect(mentionsSurah).toBe(kind === 'friday-kahf');
  }
});
