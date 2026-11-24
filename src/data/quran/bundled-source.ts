import type { QuranScript } from '@/domain/quran';

import type { QuranDataSource } from './data-files';

/**
 * The generated files, bundled with the app.
 *
 * Each file is named by a literal `require`, which is what Metro, the web bundler and Jest
 * all understand. A `require` inside a function runs on the first call only: a file is
 * parsed when it is first needed, not when the app starts.
 */
const VERSES_FILES: Readonly<Record<QuranScript, () => unknown>> = {
  uthmani: () => require('../../../assets/data/verses/uthmani.json'),
  'uthmani-minimal': () => require('../../../assets/data/verses/uthmani-minimal.json'),
};

/** In page order: file 0 holds pages 1..20, file 1 pages 21..40, and so on up to page 604. */
const PAGE_FILES: readonly (() => unknown)[] = [
  () => require('../../../assets/data/pages/pages-001-020.json'),
  () => require('../../../assets/data/pages/pages-021-040.json'),
  () => require('../../../assets/data/pages/pages-041-060.json'),
  () => require('../../../assets/data/pages/pages-061-080.json'),
  () => require('../../../assets/data/pages/pages-081-100.json'),
  () => require('../../../assets/data/pages/pages-101-120.json'),
  () => require('../../../assets/data/pages/pages-121-140.json'),
  () => require('../../../assets/data/pages/pages-141-160.json'),
  () => require('../../../assets/data/pages/pages-161-180.json'),
  () => require('../../../assets/data/pages/pages-181-200.json'),
  () => require('../../../assets/data/pages/pages-201-220.json'),
  () => require('../../../assets/data/pages/pages-221-240.json'),
  () => require('../../../assets/data/pages/pages-241-260.json'),
  () => require('../../../assets/data/pages/pages-261-280.json'),
  () => require('../../../assets/data/pages/pages-281-300.json'),
  () => require('../../../assets/data/pages/pages-301-320.json'),
  () => require('../../../assets/data/pages/pages-321-340.json'),
  () => require('../../../assets/data/pages/pages-341-360.json'),
  () => require('../../../assets/data/pages/pages-361-380.json'),
  () => require('../../../assets/data/pages/pages-381-400.json'),
  () => require('../../../assets/data/pages/pages-401-420.json'),
  () => require('../../../assets/data/pages/pages-421-440.json'),
  () => require('../../../assets/data/pages/pages-441-460.json'),
  () => require('../../../assets/data/pages/pages-461-480.json'),
  () => require('../../../assets/data/pages/pages-481-500.json'),
  () => require('../../../assets/data/pages/pages-501-520.json'),
  () => require('../../../assets/data/pages/pages-521-540.json'),
  () => require('../../../assets/data/pages/pages-541-560.json'),
  () => require('../../../assets/data/pages/pages-561-580.json'),
  () => require('../../../assets/data/pages/pages-581-600.json'),
  () => require('../../../assets/data/pages/pages-601-604.json'),
];

export const BUNDLED_PAGE_FILE_COUNT = PAGE_FILES.length;

export const bundledQuranDataSource: QuranDataSource = {
  async loadVerses(script: QuranScript): Promise<unknown> {
    return VERSES_FILES[script]();
  },

  async loadPageFile(fileIndex: number): Promise<unknown> {
    const load = PAGE_FILES[fileIndex];
    if (load === undefined) throw new RangeError(`No page file number ${fileIndex}`);
    return load();
  },
};
