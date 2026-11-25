import { addDays, parseLocalDate } from '@/domain/shared/local-date';
import type { FriendView, SharedGarden } from '@/domain/social';

import { initialOf, neighbourGardenOf } from '../neighbours';

const TODAY = parseLocalDate('2026-11-24');

function friend(name: string, garden: Partial<SharedGarden> | null): FriendView {
  return {
    kind: 'friend',
    userId: `id-${name}`,
    displayName: name,
    garden:
      garden === null
        ? null
        : {
            hizbCompleted: 38,
            health: 1,
            lastWateredOn: TODAY,
            streakDays: 21,
            updatedOn: TODAY,
            ...garden,
          },
    level: null,
  };
}

describe('neighbourGardenOf: a friend\'s card in "Jardins voisins" (accueil.png)', () => {
  it('a friend who reads every day: "38 hizb, arrosé depuis 21 j"', () => {
    const card = neighbourGardenOf(friend('Imane', {}), 0, TODAY);
    expect(card).toMatchObject({
      userId: 'id-Imane',
      name: 'Imane',
      initial: 'I',
      colorIndex: 0,
      detail: { kind: 'watered', hizb: 38, days: 21 },
    });
    expect(card.garden?.hizbCompleted).toBe(38);
    expect(card.garden?.phase).toBe('thriving');
  });

  it('a thirsty friend: "14 hizb, a soif depuis 6 j", told by the garden module\'s phase', () => {
    const card = neighbourGardenOf(
      friend('Bilal', {
        hizbCompleted: 14,
        health: 0.25,
        lastWateredOn: addDays(TODAY, -6),
        streakDays: 0,
      }),
      1,
      TODAY,
    );
    expect(card.detail).toEqual({ kind: 'thirsty', hizb: 14, days: 6 });
    expect(card.garden?.phase).not.toBe('thriving');
  });

  it('a friend in good health who has not read since yesterday: watered a day ago', () => {
    const card = neighbourGardenOf(
      friend('Sara', { lastWateredOn: addDays(TODAY, -1), streakDays: 30, health: 1 }),
      2,
      TODAY,
    );
    expect(card.detail).toEqual({ kind: 'watered', hizb: 38, days: 30 });
  });

  it('a friend in good health with no streak: "arrosé il y a 2 j"', () => {
    const card = neighbourGardenOf(
      friend('Yacine', { lastWateredOn: addDays(TODAY, -2), streakDays: 0, health: 0.95 }),
      3,
      TODAY,
    );
    expect(card.detail).toEqual({ kind: 'rested', hizb: 38, days: 2 });
  });

  it('a complete garden says so', () => {
    const card = neighbourGardenOf(friend('Taghread', { hizbCompleted: 60 }), 3, TODAY);
    expect(card.detail).toEqual({ kind: 'complete' });
  });

  it('a dead garden says so', () => {
    const card = neighbourGardenOf(
      friend('Nour', { health: 0, lastWateredOn: addDays(TODAY, -20), streakDays: 0 }),
      4,
      TODAY,
    );
    expect(card.detail).toEqual({ kind: 'dry', hizb: 38 });
  });

  it('a hidden garden has no picture and says it is hidden', () => {
    const card = neighbourGardenOf(friend('Sami', null), 5, TODAY);
    expect(card.garden).toBeNull();
    expect(card.detail).toEqual({ kind: 'hidden' });
  });
});

describe('initialOf', () => {
  it('takes the first letter, in capitals, whole even outside the Latin alphabet', () => {
    expect(initialOf('imane')).toBe('I');
    expect(initialOf('  Éloïse')).toBe('É');
    expect(initialOf('تغريد')).toBe('ت');
  });

  it('gives nothing for an empty name', () => {
    expect(initialOf('   ')).toBeNull();
  });
});
