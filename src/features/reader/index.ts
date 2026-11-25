/**
 * The Quran reader (docs/specs/reader.md): the table of contents of the Quran tab, the reader of
 * the mushaf page by page, and the rule that turns a page read into water for the garden.
 * Everything else in this folder is private.
 */

export { READER_CONFIG } from './config';
export { ContentsScreen, type ContentsScreenProps } from './contents-screen';
export { parsePageParam } from './page-order';
export {
  ReaderNotFound,
  ReaderScreen,
  useReaderHeaderOptions,
  type ReaderScreenProps,
} from './reader-screen';
export { getLastOpenedPage, useLastOpenedPage } from './reader-session';
export { resolveResumePage } from './resume-page';
export { useContentsModel, type ContentsActions, type ContentsModel } from './use-contents-model';
export { useQuranFont, type QuranFontStatus } from './use-quran-font';
export { useReader, type ReaderActions, type ReaderModel } from './use-reader';
export { useResumePage } from './use-resume-page';
