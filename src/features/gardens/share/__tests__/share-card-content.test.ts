import { initI18n, type AppLanguage } from '@/i18n';
import type { LocalDate } from '@/domain/shared/local-date';

import { buildShareCardContent, type ShareCardInput } from '../share-card-content';

const BADGE: ShareCardInput = {
  khatm: 3,
  styleId: 'waterside-orchard',
  completedOn: '2026-03-19' as LocalDate,
  days: 24,
};

async function contentIn(language: AppLanguage, input = BADGE, name: string | null = null) {
  const i18n = initI18n(language);
  await i18n.changeLanguage(language);
  return buildShareCardContent(input, {
    t: i18n.getFixedT(language, 'gardens'),
    appName: i18n.getFixedT(language, 'common')('appName'),
    language,
    name,
  });
}

describe('the content of the card of a shared badge', () => {
  it('is written in French: number of the khatma, garden, date, the three figures, the invocation', async () => {
    const card = await contentIn('fr');
    expect(card.appName).toBe('Jannatuk');
    expect(card.title).toBe('Khatma n°3 terminée');
    expect(card.garden).toBe('Verger au bord de l’eau');
    expect(card.date).toBe('19 mars 2026');
    expect(card.figures).toEqual([
      { value: '60', label: 'hizb' },
      { value: '604', label: 'pages' },
      { value: '24', label: 'jours' },
    ]);
    expect(card.dua).toBe('تقبّل الله منك');
  });

  it('is written in English', async () => {
    const card = await contentIn('en');
    expect(card.title).toBe('Khatma no. 3 complete');
    expect(card.garden).toBe('Waterside Orchard');
    expect(card.date).toBe('March 19, 2026');
    expect(card.figures.map((figure) => figure.label)).toEqual(['hizb', 'pages', 'days']);
  });

  it('is written in Arabic, with Western digits as the rest of the app', async () => {
    const card = await contentIn('ar');
    expect(card.appName).toBe('جنتك');
    expect(card.title).toBe('تمّت الختمة رقم 3');
    expect(card.figures.map((figure) => figure.value)).toEqual(['60', '604', '24']);
    expect(card.date).toMatch(/2026/);
    expect(card.date).not.toMatch(/[٠-٩]/);
    expect(card.dua).toBe('تقبّل الله منك');
  });

  it('says one day in the singular and the plural of each language', async () => {
    const one = { ...BADGE, days: 1 };
    expect((await contentIn('fr', one)).figures[2]).toEqual({ value: '1', label: 'jour' });
    expect((await contentIn('en', one)).figures[2]).toEqual({ value: '1', label: 'day' });
    expect((await contentIn('ar', { ...BADGE, days: 2 })).figures[2]?.label).toBe('يومان');
  });

  it('carries no name unless one is given, and then the name as written', async () => {
    expect((await contentIn('fr')).name).toBeNull();
    expect((await contentIn('fr', BADGE, '  Omar ')).name).toBe('Omar');
    expect((await contentIn('fr', BADGE, '   ')).name).toBeNull();
  });

  it('describes the picture in a sentence for VoiceOver', async () => {
    expect((await contentIn('fr')).label).toBe('Image du badge de la khatma 3');
  });

  it('refuses a khatma that is not a whole number from 1', async () => {
    await expect(contentIn('fr', { ...BADGE, khatm: 0 })).rejects.toThrow(RangeError);
    await expect(contentIn('fr', { ...BADGE, days: 0 })).rejects.toThrow(RangeError);
  });
});
