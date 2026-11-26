/**
 * The Quran reader (docs/specs/reader.md): the table of contents of the Quran tab, the reader in
 * continuous vertical scroll in two scripts (D41), and the rule that turns a page read into water
 * for the garden.
 * Everything else in this folder is private.
 */

export { READER_CONFIG } from './config';
export { ContentsScreen, type ContentsScreenProps } from './contents-screen';
export { parsePageParam } from './page-order';
export { ReaderNotFound, ReaderScreen, type ReaderScreenProps } from './reader-screen';
export { useReaderNavigation, type ReaderNavigation } from './use-reader-navigation';
export { pageSurah } from './page-surah';
export { resolveResumePage } from './resume-page';
export { useContentsModel, type ContentsActions, type ContentsModel } from './use-contents-model';
export { useQuranFont, type QuranFontStatus } from './use-quran-font';
export { useReader, type ReaderActions, type ReaderModel } from './use-reader';
export { useScriptFont } from './script-fonts';
export {
  useRecitationFollow,
  type RecitationFollow,
  type RecitationFollowDependencies,
} from './use-recitation-follow';
export { useScriptTexts, type ScriptTexts } from './use-script-texts';
export { useResumePage } from './use-resume-page';
