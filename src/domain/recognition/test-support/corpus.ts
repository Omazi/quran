/**
 * The only place where the recognition tests read Quran data files. Not part of the module.
 *
 * The full Uthmani text is generated data (`npm run data:build`), absent from a fresh
 * checkout: tests that need it are skipped when the file is not there.
 * Run Jest from the repository root, as `npm test` does: paths are relative to it.
 *
 * Two environment variables point the tests at other files of the same shape
 * (`{ "<surah>": ["verse 1", "verse 2", ...] }`):
 * - RECOGNITION_UTHMANI_CORPUS replaces the generated Uthmani text;
 * - RECOGNITION_IMLAEI_CORPUS adds a full imla'i text (for instance Tanzil Simple), used
 *   as a stand-in for speech-engine output in the measures. It is never in the repository.
 */
import type { VerseText } from '../types';

/** The two functions of Node's `fs` used here (Node types are not part of the app's tsconfig). */
interface FileSystem {
  existsSync(path: string): boolean;
  readFileSync(path: string, encoding: 'utf8'): string;
}

const fileSystem = jest.requireActual<FileSystem>('fs');

const GENERATED_UTHMANI_PATH = 'assets/data/verses/uthmani.json';
const GENERATED_SECOND_TEXT_PATH = 'assets/data/verses/uthmani-minimal.json';

/** True when Jest runs from the repository root, where relative data paths make sense. */
export function runsFromRepositoryRoot(): boolean {
  return (
    fileSystem.existsSync('package.json') && fileSystem.existsSync('docs/specs/recognition.md')
  );
}

/** The generated Uthmani text of the whole Quran, or null when it has not been generated. */
export function loadUthmaniCorpus(): VerseText[] | null {
  return loadVerses(process.env.RECOGNITION_UTHMANI_CORPUS ?? GENERATED_UTHMANI_PATH);
}

/**
 * The second text shipped with the app (the same verses with fewer signs, see
 * docs/DATA_SOURCES.md), or null when it has not been generated.
 */
export function loadSecondTextCorpus(): VerseText[] | null {
  return loadVerses(GENERATED_SECOND_TEXT_PATH);
}

/** A full imla'i text, when RECOGNITION_IMLAEI_CORPUS points to one; null otherwise. */
export function loadImlaeiCorpus(): VerseText[] | null {
  const path = process.env.RECOGNITION_IMLAEI_CORPUS;
  return path === undefined ? null : loadVerses(path);
}

function loadVerses(path: string): VerseText[] | null {
  if (!fileSystem.existsSync(path)) return null;
  // A file that exists but is malformed is an error, never a silent skip.
  const parsed: unknown = JSON.parse(fileSystem.readFileSync(path, 'utf8'));
  return toVerseTexts(parsed, path);
}

/** Checks the `{ "<surah>": [verses] }` shape and flattens it in mushaf order. */
export function toVerseTexts(data: unknown, origin: string): VerseText[] {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new TypeError(`${origin}: expected an object keyed by surah number`);
  }
  const verses: VerseText[] = [];
  const surahs = Object.entries(data).sort(([first], [second]) => Number(first) - Number(second));
  for (const [surahKey, surahVerses] of surahs) {
    const surah = Number(surahKey);
    if (!Number.isInteger(surah) || !Array.isArray(surahVerses)) {
      throw new TypeError(`${origin}: surah "${surahKey}" must be a number with a list of verses`);
    }
    surahVerses.forEach((text: unknown, index) => {
      if (typeof text !== 'string') {
        throw new TypeError(`${origin}: verse ${surah}:${index + 1} must be a string`);
      }
      verses.push({ surah, verse: index + 1, text });
    });
  }
  return verses;
}
