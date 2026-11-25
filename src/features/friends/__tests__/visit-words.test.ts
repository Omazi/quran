/**
 * The words and colours of a friend as the validated mockups show them (docs/design/visite.png:
 * "38 hizb sur 60, arrosé depuis 21 jours"; docs/design/accueil.png: a coloured initial).
 */

import { showLanguage } from '@/features/garden/test-support/screen-conditions';
import { visitAvatarRoles } from '@/ui';

import { avatarRoleOf, initialOf } from '../friend-avatar';
import { cardDetails, visitSummary } from '../friend-words';
import type { FriendCard } from '../friends-model';

const IMANE: FriendCard = {
  userId: 'demo-imane',
  name: 'Imane',
  garden: null,
  hizbCompleted: 38,
  water: { kind: 'today' },
  streakDays: 21,
};

describe('the line under a friend’s name on their page', () => {
  it('says the hizb out of sixty, then how long they have been watering', async () => {
    const t = (await showLanguage('fr')).getFixedT('fr', 'friends');
    expect(visitSummary(IMANE, t)).toBe('38 hizb sur 60, arrosé depuis 21 jours');
  });

  it('says the same of a friend who watered yesterday: the streak still runs', async () => {
    const t = (await showLanguage('fr')).getFixedT('fr', 'friends');
    expect(visitSummary({ ...IMANE, water: { kind: 'days-ago', days: 1 } }, t)).toBe(
      '38 hizb sur 60, arrosé depuis 21 jours',
    );
  });

  it('says when they last watered once the streak is broken, never a streak of zero', async () => {
    const t = (await showLanguage('fr')).getFixedT('fr', 'friends');
    expect(visitSummary({ ...IMANE, water: { kind: 'days-ago', days: 6 }, streakDays: 0 }, t)).toBe(
      '38 hizb sur 60, pas arrosé depuis 6 jours',
    );
    expect(visitSummary({ ...IMANE, streakDays: 1 }, t)).toBe('38 hizb sur 60, arrosé aujourd’hui');
  });

  it('says the garden is not shared when it is hidden', async () => {
    const t = (await showLanguage('fr')).getFixedT('fr', 'friends');
    expect(visitSummary({ ...IMANE, hizbCompleted: null, water: null, streakDays: null }, t)).toBe(
      'Jardin non partagé',
    );
  });

  it('is written in Arabic too', async () => {
    const t = (await showLanguage('ar')).getFixedT('ar', 'friends');
    expect(visitSummary(IMANE, t)).toContain('60');
  });
});

describe('the line of a garden card', () => {
  it('joins the hizb and the water with a comma, as the home screen does', async () => {
    const t = (await showLanguage('fr')).getFixedT('fr', 'friends');
    expect(cardDetails(IMANE, t)).toBe('38 hizb, arrosé depuis 21 jours');
    expect(cardDetails({ ...IMANE, water: { kind: 'days-ago', days: 2 }, streakDays: 0 }, t)).toBe(
      '38 hizb, pas arrosé depuis 2 jours',
    );
  });
});

describe('a friend’s colour and initial', () => {
  it('gives each person always the same colour of the palette', () => {
    const role = avatarRoleOf('demo-sarah');
    expect(visitAvatarRoles).toContain(role);
    expect(avatarRoleOf('demo-sarah')).toBe(role);
  });

  it('gives the three friends of the demonstration three different colours', () => {
    const roles = new Set(['demo-mustapha', 'demo-sarah', 'demo-taghread'].map(avatarRoleOf));
    expect(roles.size).toBe(3);
  });

  it('takes the first letter of the name, in capitals, Arabic included', () => {
    expect(initialOf('imane')).toBe('I');
    expect(initialOf('  Bilal')).toBe('B');
    expect(initialOf('تغريد')).toBe('ت');
    expect(initialOf('')).toBe('');
  });
});
