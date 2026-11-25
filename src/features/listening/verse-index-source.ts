import { quranRepository, quranStructure } from '@/data/quran';
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
