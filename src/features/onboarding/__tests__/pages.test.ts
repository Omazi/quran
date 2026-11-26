import fr from '@/i18n/locales/fr/onboarding.json';

import { ONBOARDING_PAGES, GROWS_FROM, pageIndexOf } from '../pages';

function translate(key: string): string {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], fr);
  if (typeof value !== 'string') throw new Error(`No French words for ${key}`);
  return value;
}

describe('the pages of the first launch (owner’s chosen "voix" prototype)', () => {
  it('has the prototype’s sixteen pages, the voice page before the recognition', () => {
    expect(ONBOARDING_PAGES.map((page) => page.id)).toEqual([
      'bareEarth',
      'hizb8',
      'hizb20',
      'hizb30',
      'hizb40',
      'hizb60',
      'thirsty',
      'wilting',
      'dying',
      'dead',
      'revival',
      'voice',
      'recognition',
      'friends',
      'goal',
      'reminders',
    ]);
    expect(pageIndexOf('voice')).toBeLessThan(pageIndexOf('recognition'));
  });

  it('says the prototype’s words, exactly, in French', () => {
    const titles = ONBOARDING_PAGES.map((page) => translate(page.title));
    expect(titles).toEqual([
      'Une terre nue.',
      'Lis, et l’eau coule.',
      'Un hizb, un nouvel élément.',
      'À mi-chemin, les murs s’élèvent.',
      'Les portes s’ouvrent.',
      'Ton jardin est complet.',
      'Si tu arrêtes de lire, il a soif.',
      'Puis il fane.',
      'Les arbres se dénudent.',
      'Et il redevient une terre morte.',
      'Une page suffit pour le faire revivre.',
      'Lis à voix haute, l’appli te suit.',
      'D’où vient ce passage ?',
      'Avec tes proches.',
      'Ton objectif du jour.',
      'Tes rappels.',
    ]);
    expect(translate('pages.hizb60.text')).toBe('Soixante hizb : tu as lu le Coran en entier.');
    expect(translate('pages.wilting.text')).toBe(
      'L’herbe jaunit, les arbres prennent leurs couleurs d’automne, les canaux sont à sec.',
    );
    expect(translate('pages.voice.text')).toBe(
      'Chaque mot s’allume quand tu le récites. Un mot mal lu passe en rouge, pour que tu le reprennes.',
    );
    expect(translate('hint')).toBe('Glisse vers le haut');
    expect(translate('finish.start')).toBe('Créer mon jardin');
  });

  it('grows the garden, dries the complete one, revives it, as the prototype’s stops', () => {
    expect(ONBOARDING_PAGES.map((page) => page.garden)).toEqual([
      'g0',
      'g8',
      'g20',
      'g30',
      'g40',
      'g60',
      'd3',
      'd6',
      'd10',
      'd14',
      'g60',
      null,
      null,
      null,
      'preview',
      'preview',
    ]);
    expect(GROWS_FROM).toEqual({ g8: 'g0', g20: 'g8', g30: 'g20', g40: 'g30', g60: 'g40' });
  });

  it('greys the sky and silences the voice over the drought, and darkens it for the voice pages', () => {
    expect(ONBOARDING_PAGES.map((page) => page.sky.grey)).toEqual([
      0, 0, 0, 0, 0, 0, 0.4, 0.65, 0.85, 1, 0, 0, 0, 0, 0, 0,
    ]);
    expect(ONBOARDING_PAGES.map((page) => page.voice)).toEqual([
      1, 1, 1, 1, 1, 1, 0.5, 0.22, 0.06, 0, 1, 1, 1, 0, 0, 0,
    ]);
    expect(ONBOARDING_PAGES.filter((page) => page.sky.dusk === 1).map((page) => page.id)).toEqual([
      'voice',
      'recognition',
    ]);
    // The camera walks around the garden, a few degrees a page (`TURN`).
    expect(ONBOARDING_PAGES.map((page) => page.turn)).toEqual([
      -5, -3, -1, 1, 3, 5, 4, 3, 2, 1, 0, 0, 0, 0, 0, 0,
    ]);
  });
});
