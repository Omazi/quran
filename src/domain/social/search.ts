import { assertBondBetween, type Bond } from './bond';
import { isBlockedEitherWay } from './blocking';
import {
  FORBIDDEN_NAME_CODE_POINTS,
  SEARCH_WORD_SEPARATOR_CODE_POINTS,
  SOCIAL_CONFIG,
  type CodePointRange,
} from './config';
import { SocialRuleError } from './errors';
import type { PersonSearchResult, Profile, SearchRelation, UserId } from './types';
import { assertId, assertList, assertObject } from './validation';

/**
 * Rule 11: search by name (D36). Whoever types the first letters of a name finds the person,
 * unless they blocked each other or the person asked not to be found. A result shows the name
 * and what the two people are to each other: nothing else.
 *
 * The server does the same in `public.search_profiles` with the same lists (see
 * docs/specs/social-database.md): a change here is a change there.
 */

/** Combining marks that carry no letter: accents, then Arabic vowels and Quranic signs. */
const IGNORED_CODE_POINTS: readonly CodePointRange[] = [
  { first: 0x0300, last: 0x036f }, // combining diacritical marks (accents)
  { first: 0x0610, last: 0x061a }, // Arabic honorific and annotation signs
  { first: 0x0640, last: 0x0640 }, // tatweel (the stretching line)
  { first: 0x064b, last: 0x065f }, // Arabic vowels, shadda, sukun, hamza signs
  { first: 0x0670, last: 0x0670 }, // superscript alef
  { first: 0x06d6, last: 0x06ed }, // Quranic annotation signs
];

/**
 * Letters written one way and searched the other. The hamza seats (أ إ آ ؤ ئ) need no entry:
 * once the text is decomposed they are a plain letter plus a hamza mark, which is ignored.
 */
const LETTER_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  ٱ: 'ا', // alef wasla
  ى: 'ي', // alef maqsura
  ی: 'ي', // Persian ya
  ة: 'ه', // ta marbuta
  ک: 'ك', // Persian kaf
});

function isIn(character: string, ranges: readonly CodePointRange[]): boolean {
  // Never undefined: iterating a string yields whole characters.
  const codePoint = character.codePointAt(0) ?? 0;
  return ranges.some((range) => codePoint >= range.first && codePoint <= range.last);
}

/**
 * A text as the search compares it: accents and Arabic marks removed, lower case, a few Arabic
 * letters unified, the words separated by one space. "Éloïse Al-Sayed" gives "eloise al sayed";
 * "أَحْمَد" gives "احمد".
 */
export function normalizeSearchText(text: string): string {
  const letters = Array.from(text.normalize('NFD'))
    .filter((character) => !isIn(character, IGNORED_CODE_POINTS))
    .map((character) => LETTER_ALIASES[character.toLowerCase()] ?? character.toLowerCase());

  const words: string[] = [];
  let word = '';
  for (const character of letters) {
    if (isIn(character, SEARCH_WORD_SEPARATOR_CODE_POINTS)) {
      if (word !== '') words.push(word);
      word = '';
    } else {
      word += character;
    }
  }
  if (word !== '') words.push(word);
  return words.join(' ');
}

function lengthOf(text: string): number {
  return Array.from(text).length;
}

/**
 * The query as it is sent, or an explicit refusal: trimmed, 2 to 30 characters, no control
 * character; and still 2 characters once normalised, so that a query of accents or hyphens
 * alone cannot match everybody. Nothing else is corrected.
 */
export function parseSearchQuery(raw: string): string {
  if (typeof raw !== 'string') {
    throw new TypeError(`Invalid search: expected text, got ${raw === null ? 'null' : typeof raw}`);
  }
  if (Array.from(raw).some((character) => isIn(character, FORBIDDEN_NAME_CODE_POINTS))) {
    throw new SocialRuleError(
      'search-query-forbidden-character',
      'a search holds no line break, no control character and no direction mark',
    );
  }
  const query = raw.trim();
  if (lengthOf(query) > SOCIAL_CONFIG.nameMaxLength) {
    throw new SocialRuleError(
      'search-query-too-long',
      `a search has at most ${SOCIAL_CONFIG.nameMaxLength} characters`,
    );
  }
  if (
    lengthOf(query) < SOCIAL_CONFIG.searchMinLength ||
    lengthOf(normalizeSearchText(query)) < SOCIAL_CONFIG.searchMinLength
  ) {
    throw new SocialRuleError(
      'search-query-too-short',
      `a search has at least ${SOCIAL_CONFIG.searchMinLength} characters`,
    );
  }
  return query;
}

/**
 * Whether the query is the start of any word of the name, or of several words in a row:
 * "al s" finds "Omar Al-Sayed". The middle of a word never matches.
 */
export function matchesSearchQuery(displayName: string, query: string): boolean {
  const wanted = normalizeSearchText(query);
  if (wanted === '') return false;
  const name = normalizeSearchText(displayName);
  return name.startsWith(wanted) || name.includes(` ${wanted}`);
}

/** What the other person is to the searcher. A declined request is `none`: no one is told. */
export function searchRelation(bond: Bond, searcherId: UserId): SearchRelation {
  const { friendship } = bond;
  if (friendship === null || friendship.status === 'declined') return 'none';
  if (friendship.status === 'accepted') return 'friend';
  return friendship.requesterId === searcherId ? 'request-sent' : 'request-received';
}

/** A person who could be found, with what exists between them and the searcher. */
export interface SearchCandidate {
  readonly profile: Profile;
  readonly bond: Bond;
}

function compareText(first: string, second: string): number {
  if (first === second) return 0;
  return first < second ? -1 : 1;
}

/**
 * Rule 11. The people whose name starts like the query, at most `searchMaxResults`, by name
 * then identifier. Never the searcher, never anyone blocked in either direction. Nothing tells
 * a blocked pair apart from a person who does not exist. (A "do not find me" setting is a
 * possible later option, not part of this rule: docs/specs/social.md.)
 */
export function searchPeople(
  searcherId: UserId,
  rawQuery: string,
  candidates: readonly SearchCandidate[],
): PersonSearchResult[] {
  const query = parseSearchQuery(rawQuery);
  assertId(searcherId, 'searcher');
  assertList(candidates, 'search candidates');

  const found: { result: PersonSearchResult; sortKey: string }[] = [];
  for (const candidate of candidates) {
    assertObject(candidate, 'search candidate');
    const { profile, bond } = candidate;
    assertObject(profile, 'search candidate profile');
    if (profile.id === searcherId) continue;
    assertBondBetween(bond, searcherId, profile.id);
    if (isBlockedEitherWay(bond)) continue;
    const relation = searchRelation(bond, searcherId);
    if (!matchesSearchQuery(profile.displayName, query)) continue;
    found.push({
      result: { userId: profile.id, displayName: profile.displayName, relation },
      sortKey: normalizeSearchText(profile.displayName),
    });
  }

  return found
    .sort(
      (a, b) => compareText(a.sortKey, b.sortKey) || compareText(a.result.userId, b.result.userId),
    )
    .slice(0, SOCIAL_CONFIG.searchMaxResults)
    .map((entry) => entry.result);
}
