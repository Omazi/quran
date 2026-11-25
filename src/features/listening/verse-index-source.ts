import { quranRepository, quranStructure } from '@/data/quran';
import { formatVerseKey, type MushafPage, type VerseRef } from '@/domain/quran';
import { createVerseIndex, type VerseIndex } from '@/domain/recognition';

let pending: Promise<VerseIndex> | null = null;

/**
 * The passage search over the whole Quran, built once per session on first use (about 0.2 s on
 * a development computer, docs/specs/recognition.md; more on a phone, not measured). Never on a
 * part of the text: a passage found in a part could be repeated elsewhere. A failed build is
 * forgotten, so that the next listening tries again.
 */
export function loadQuranVerseIndex(): Promise<VerseIndex> {
  pending ??= Promise.all(
    quranStructure.surahs.map(({ surah }) => quranRepository.getSurahVerses(surah)),
  ).then((surahs) => createVerseIndex(surahs.flat()));
  const loading = pending;
  loading.catch(() => {
    if (pending === loading) pending = null;
  });
  return loading;
}

/**
 * The text of one verse, exactly as the data layer stores it (Uthmani script), for a result of
 * the listening. The verse file is already loaded by the passage search.
 */
export async function loadQuranVerseText(verse: VerseRef): Promise<string> {
  return (await quranRepository.getVerse(formatVerseKey(verse))).text;
}

/** A page of the mushaf as printed, with its words exactly as the data layer stores them. */
export function loadQuranPage(page: number): Promise<MushafPage> {
  return quranRepository.getPage(page);
}
