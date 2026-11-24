import structureData from '../../../../assets/data/structure.json';
import type { VersesBySurah } from '../integrity';
import { createQuranStructure, type QuranStructure, type QuranStructureData } from '../structure';

/** Test data only: the generated structure of the mushaf, as the app loads it. */
export const STRUCTURE_DATA: QuranStructureData = structureData;

export const STRUCTURE: QuranStructure = createQuranStructure(STRUCTURE_DATA);

/** A copy of the structure data with some fields replaced, to hand-make invalid data. */
export function withStructureData(changes: Partial<QuranStructureData>): QuranStructureData {
  return { ...STRUCTURE_DATA, ...changes };
}

/** The list with one item replaced (index is 0-based). */
export function replaceAt<Item>(list: readonly Item[], index: number, item: Item): Item[] {
  return list.map((current, position) => (position === index ? item : current));
}

/** Text of a verse of a verses file ("18:10"); fails loudly if the verse is not there. */
export function verseText(verses: VersesBySurah, key: string): string {
  const { surah, verse } = STRUCTURE.verseRef(key);
  const text = verses[String(surah)]?.[verse - 1];
  if (text === undefined) throw new Error(`Verse ${key} is missing from the verses file`);
  return text;
}

/** SHA-256 of a text (UTF-8), in hexadecimal, with the Web Crypto API that Jest provides. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
