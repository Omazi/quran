import { PAGE_COUNT, parseVerseKey, type VerseRef } from '@/domain/quran';

/** The page and the verse the trial follows when the address names none: 18:10 (voix.png). */
const DEFAULT_PAGE = 294;
const DEFAULT_FROM: VerseRef = { surah: 18, verse: 10 };

export interface FollowParams {
  readonly page: number;
  readonly from: VerseRef | undefined;
}

/**
 * The page and the starting verse named in the address of the voice-following trial
 * (`/voice-follow?page=294&from=18:10`), or null when they do not name a page of the mushaf.
 * With no page, the mockup's page and verse.
 */
export function parseFollowParams(
  page: string | undefined,
  from: string | undefined,
): FollowParams | null {
  if (page === undefined)
    return { page: DEFAULT_PAGE, from: from === undefined ? DEFAULT_FROM : verseOf(from) };
  const number = Number(page);
  if (!Number.isInteger(number) || number < 1 || number > PAGE_COUNT) return null;
  return { page: number, from: from === undefined ? undefined : verseOf(from) };
}

function verseOf(key: string): VerseRef | undefined {
  try {
    return parseVerseKey(key);
  } catch {
    return undefined;
  }
}
