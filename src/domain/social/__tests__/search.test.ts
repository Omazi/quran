import sharedCases from '../../../../supabase/tests/search-normalization.json';

import {
  blockPerson,
  acceptFriendRequest,
  NO_BOND,
  normalizeSearchText,
  parseSearchQuery,
  requestFriendship,
  declineFriendRequest,
  searchPeople,
  SOCIAL_CONFIG,
  type Bond,
  type SearchCandidate,
} from '../index';
import {
  expectRefusal,
  MUSTAPHA,
  NOT_TEXT,
  OMAR,
  profileOf,
  SARAH,
  TAGHREAD,
  TODAY,
} from '../test-support/social-test-kit';

/** Rule 11: search by name (D36). */

const candidate = (id: string, name: string, bond: Bond = NO_BOND): SearchCandidate => ({
  profile: profileOf(id, name),
  bond,
});

const namesFound = (query: string, candidates: readonly SearchCandidate[]): string[] =>
  searchPeople(OMAR, query, candidates).map((result) => result.displayName);

describe('Rule 11 — search by name (recherche par nom)', () => {
  describe('the query', () => {
    it('is trimmed', () => {
      expect(parseSearchQuery('  sar  ')).toBe('sar');
      expect(parseSearchQuery(' Sarah　')).toBe('Sarah');
    });

    it('has at least 2 characters once trimmed', () => {
      expectRefusal(() => parseSearchQuery(''), 'search-query-too-short');
      expectRefusal(() => parseSearchQuery('   '), 'search-query-too-short');
      expectRefusal(() => parseSearchQuery(' a '), 'search-query-too-short');
      expect(parseSearchQuery('ab')).toBe('ab');
      expect(SOCIAL_CONFIG.searchMinLength).toBe(2);
    });

    it('counts characters, not UTF-16 units: one emoji is one character', () => {
      expectRefusal(() => parseSearchQuery('😀'), 'search-query-too-short');
      expect(parseSearchQuery('😀😀')).toBe('😀😀');
    });

    it('is refused when only marks and tatweel remain after normalisation', () => {
      expectRefusal(() => parseSearchQuery('ـَ'), 'search-query-too-short');
      expectRefusal(() => parseSearchQuery('á- '), 'search-query-too-short');
      expectRefusal(() => parseSearchQuery('-.'), 'search-query-too-short');
    });

    it('is at most as long as a name', () => {
      expect(parseSearchQuery('a'.repeat(SOCIAL_CONFIG.nameMaxLength))).toHaveLength(30);
      expectRefusal(
        () => parseSearchQuery('a'.repeat(SOCIAL_CONFIG.nameMaxLength + 1)),
        'search-query-too-long',
      );
    });

    it('holds no line break, control character or direction mark', () => {
      expectRefusal(() => parseSearchQuery('om\nar'), 'search-query-forbidden-character');
      expectRefusal(() => parseSearchQuery('om\u0000'), 'search-query-forbidden-character');
      expectRefusal(() => parseSearchQuery('om‮ar'), 'search-query-forbidden-character');
    });

    it('is a TypeError, not a refusal, when it is not text', () => {
      expect(() => parseSearchQuery(NOT_TEXT)).toThrow(TypeError);
      expect(() => searchPeople(OMAR, NOT_TEXT, [])).toThrow(TypeError);
    });
  });

  describe('normalisation (case, accents, Arabic)', () => {
    it('ignores case', () => {
      expect(normalizeSearchText('SARAH')).toBe('sarah');
      expect(namesFound('SAR', [candidate(SARAH, 'sarah')])).toEqual(['sarah']);
    });

    it('ignores accents, in the query and in the name', () => {
      expect(namesFound('eloi', [candidate(SARAH, 'Éloïse')])).toEqual(['Éloïse']);
      expect(namesFound('ÉLOÏ', [candidate(SARAH, 'eloise')])).toEqual(['eloise']);
      expect(namesFound('rene', [candidate(SARAH, 'René')])).toEqual(['René']);
    });

    it('is the same whether an accent is one character or two', () => {
      expect(normalizeSearchText('é')).toBe(normalizeSearchText('é'));
    });

    it('ignores Arabic vowel marks and the tatweel', () => {
      expect(namesFound('محمد', [candidate(SARAH, 'مُحَمَّد')])).toEqual(['مُحَمَّد']);
      expect(namesFound('مُحَم', [candidate(SARAH, 'محمد')])).toEqual(['محمد']);
      expect(namesFound('محـمد', [candidate(SARAH, 'محمد')])).toEqual(['محمد']);
    });

    it('treats every alef, the alef maqsura and the ta marbuta as their plain letters', () => {
      expect(namesFound('احمد', [candidate(SARAH, 'أحمد')])).toEqual(['أحمد']);
      expect(namesFound('إبراهيم', [candidate(SARAH, 'ابراهيم')])).toEqual(['ابراهيم']);
      expect(namesFound('آمنه', [candidate(SARAH, 'آمنة')])).toEqual(['آمنة']);
      expect(namesFound('ٱلله', [candidate(SARAH, 'الله')])).toEqual(['الله']);
      expect(namesFound('مصطفي', [candidate(SARAH, 'مصطفى')])).toEqual(['مصطفى']);
      expect(namesFound('فاطمه', [candidate(SARAH, 'فاطمة')])).toEqual(['فاطمة']);
    });

    it('treats the Persian ya and kaf as the Arabic ones', () => {
      expect(normalizeSearchText('کریم')).toBe(normalizeSearchText('كريم'));
    });

    it('does not mix Arabic and Latin letters', () => {
      expect(namesFound('omar', [candidate(SARAH, 'عمر')])).toEqual([]);
    });

    it('gives what the server gives, on every case of the shared list', () => {
      for (const [text, expected] of sharedCases.cases) {
        expect(normalizeSearchText(text as string)).toBe(expected);
      }
    });

    it('is idempotent', () => {
      for (const text of ['Éloïse Al-Sayed', 'أَحْمَد', 'a  b']) {
        expect(normalizeSearchText(normalizeSearchText(text))).toBe(normalizeSearchText(text));
      }
    });
  });

  describe('prefix match on any word of the name', () => {
    const people = [candidate(SARAH, 'Mary Anne Al-Sayed')];

    it('matches the start of the first word', () => {
      expect(namesFound('ma', people)).toHaveLength(1);
      expect(namesFound('mary', people)).toHaveLength(1);
    });

    it('matches the start of any other word, hyphenated parts included', () => {
      expect(namesFound('ann', people)).toHaveLength(1);
      expect(namesFound('sayed', people)).toHaveLength(1);
      expect(namesFound('al', people)).toHaveLength(1);
    });

    it('does not match the middle or the end of a word', () => {
      expect(namesFound('ary', people)).toEqual([]);
      expect(namesFound('yed', people)).toEqual([]);
      expect(namesFound('nne', people)).toEqual([]);
    });

    it('matches several words typed together, whatever the separator typed', () => {
      expect(namesFound('mary an', people)).toHaveLength(1);
      expect(namesFound('anne   al-s', people)).toHaveLength(1);
      expect(namesFound('al sayed', people)).toHaveLength(1);
    });

    it('does not match words out of order or across a skipped word', () => {
      expect(namesFound('mary al', people)).toEqual([]);
      expect(namesFound('sayed mary', people)).toEqual([]);
    });

    it('treats apostrophes and dots as word separators', () => {
      expect(namesFound('brien', [candidate(SARAH, "Sean O'Brien")])).toHaveLength(1);
      expect(namesFound('smith', [candidate(SARAH, 'J.Smith')])).toHaveLength(1);
    });

    it('is not fooled by the wildcard characters of a database', () => {
      expect(namesFound('%%', people)).toEqual([]);
      expect(namesFound('ma%', people)).toEqual([]);
      expect(namesFound('m\\', people)).toEqual([]);
      expect(namesFound('m%', people)).toEqual([]);
    });
  });

  describe('who can appear', () => {
    it('never oneself', () => {
      expect(namesFound('om', [candidate(OMAR, 'Omar'), candidate(SARAH, 'Omara')])).toEqual([
        'Omara',
      ]);
    });

    it('never someone I blocked', () => {
      const blocked = blockPerson(NO_BOND, OMAR, TAGHREAD, TODAY);
      expect(namesFound('tag', [candidate(TAGHREAD, 'Taghread', blocked)])).toEqual([]);
    });

    it('never someone who blocked me, and nothing tells me so', () => {
      const blockedMe = blockPerson(NO_BOND, TAGHREAD, OMAR, TODAY);
      expect(namesFound('tag', [candidate(TAGHREAD, 'Taghread', blockedMe)])).toEqual([]);
      // Same answer as for a name nobody has.
      expect(namesFound('tag', [])).toEqual(
        namesFound('tag', [candidate(TAGHREAD, 'Taghread', blockedMe)]),
      );
    });

    it('never someone blocked in both directions', () => {
      const both = blockPerson(blockPerson(NO_BOND, OMAR, TAGHREAD, TODAY), TAGHREAD, OMAR, TODAY);
      expect(namesFound('tag', [candidate(TAGHREAD, 'Taghread', both)])).toEqual([]);
    });

    it('a bond that links two other people is a damaged bond, not an empty result', () => {
      const elsewhere = blockPerson(NO_BOND, SARAH, TAGHREAD, TODAY);
      expect(() => namesFound('tag', [candidate(TAGHREAD, 'Taghread', elsewhere)])).toThrow(
        RangeError,
      );
    });

    it('a stranger appears by default', () => {
      expect(namesFound('mos', [candidate(MUSTAPHA, 'Mostapha')])).toEqual(['Mostapha']);
    });
  });

  describe('what a result shows', () => {
    it('only the identifier, the name and the relation', () => {
      const [result] = searchPeople(OMAR, 'mos', [candidate(MUSTAPHA, 'Mostapha')]);
      expect(result).toEqual({ userId: MUSTAPHA, displayName: 'Mostapha', relation: 'none' });
      expect(Object.keys(result ?? {}).sort()).toEqual(['displayName', 'relation', 'userId']);
    });

    it('says friend, request-sent, request-received or none', () => {
      const friends = acceptFriendRequest(
        requestFriendship(NO_BOND, SARAH, OMAR, TODAY),
        OMAR,
        TODAY,
      );
      const sent = requestFriendship(NO_BOND, OMAR, MUSTAPHA, TODAY);
      const received = requestFriendship(NO_BOND, 'user-yacine', OMAR, TODAY);
      const relations = searchPeople(OMAR, 'ya', [
        candidate(SARAH, 'Yara', friends),
        candidate(MUSTAPHA, 'Yasmine', sent),
        candidate('user-yacine', 'Yacine', received),
        candidate('user-yusuf', 'Yann'),
      ]).map((result) => [result.displayName, result.relation]);
      expect(relations).toEqual([
        ['Yacine', 'request-received'],
        ['Yann', 'none'],
        ['Yara', 'friend'],
        ['Yasmine', 'request-sent'],
      ]);
    });

    it('a declined request shows as none: the sender is not told', () => {
      const declined = declineFriendRequest(
        requestFriendship(NO_BOND, OMAR, SARAH, TODAY),
        SARAH,
        TODAY,
      );
      expect(searchPeople(OMAR, 'sar', [candidate(SARAH, 'Sarah', declined)])[0]?.relation).toBe(
        'none',
      );
    });
  });

  describe('the list', () => {
    const many = Array.from({ length: 25 }, (_, index) =>
      candidate(`user-${String(index).padStart(2, '0')}`, `Sam ${String.fromCharCode(97 + index)}`),
    );

    it('is capped at 20 results', () => {
      expect(SOCIAL_CONFIG.searchMaxResults).toBe(20);
      expect(searchPeople(OMAR, 'sam', many)).toHaveLength(20);
      expect(searchPeople(OMAR, 'sam', many.slice(0, 20))).toHaveLength(20);
      expect(searchPeople(OMAR, 'sam', many.slice(0, 3))).toHaveLength(3);
    });

    it('keeps the first 20 by name, whatever the order they come in', () => {
      const shuffled = [...many].reverse();
      expect(namesFound('sam', shuffled)).toEqual(namesFound('sam', many));
      expect(namesFound('sam', many)[0]).toBe('Sam a');
      expect(namesFound('sam', many)[19]).toBe('Sam t');
    });

    it('is sorted by name, then by identifier when two people have the same name', () => {
      const found = searchPeople(OMAR, 'sam', [
        candidate('user-b', 'Sam'),
        candidate('user-a', 'Sam'),
        candidate('user-c', 'Samir'),
      ]);
      expect(found.map((result) => result.userId)).toEqual(['user-a', 'user-b', 'user-c']);
    });

    it('is empty when nobody matches, and when there is nobody', () => {
      expect(searchPeople(OMAR, 'zz', many)).toEqual([]);
      expect(searchPeople(OMAR, 'zz', [])).toEqual([]);
    });
  });

  describe('invalid input', () => {
    it('refuses a bad query before looking at anyone', () => {
      expectRefusal(
        () => searchPeople(OMAR, 'a', [candidate(SARAH, 'Sarah')]),
        'search-query-too-short',
      );
    });

    it('refuses an empty searcher identifier', () => {
      expect(() => searchPeople('', 'sar', [])).toThrow(RangeError);
    });

    it('refuses candidates that are not a list or hold a damaged row', () => {
      expect(() =>
        searchPeople(OMAR, 'sar', null as unknown as readonly SearchCandidate[]),
      ).toThrow(TypeError);
      expect(() => searchPeople(OMAR, 'sar', [null as unknown as SearchCandidate])).toThrow(
        TypeError,
      );
    });
  });
});
