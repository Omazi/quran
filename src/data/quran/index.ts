/**
 * Quran data layer: the structure of the mushaf and the `QuranRepository` on the generated
 * files of `assets/data`. See docs/specs/quran.md and docs/DATA_SOURCES.md.
 */
import { createQuranStructure, type QuranRepository, type QuranStructure } from '@/domain/quran';

import structureData from '../../../assets/data/structure.json';
import { bundledQuranDataSource } from './bundled-source';
import { createQuranRepository } from './quran-repository';

/** Structure of the mushaf, ready to use: synchronous and checked once when the app starts. */
export const quranStructure: QuranStructure = createQuranStructure(structureData);

/** Pages and verses, loaded on demand from the files bundled with the app. */
export const quranRepository: QuranRepository = createQuranRepository({
  structure: quranStructure,
  source: bundledQuranDataSource,
});

export { QURAN_DATA_CONFIG } from './config';
export { createQuranRepository } from './quran-repository';
export type { QuranRepositoryOptions } from './quran-repository';
export type { QuranDataSource } from './data-files';
