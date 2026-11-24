/**
 * Every place where two sources disagree, and the explicit decision taken.
 *
 * Nothing here is a fallback: each entry is checked against the sources during the build,
 * which fails if an entry is wrong, missing or no longer needed. The reasons are explained
 * in docs/DATA_SOURCES.md ("Incohérences entre sources").
 */

export const QUARTER_MARK = '\u06DE'; // ۞ start of a quarter of hizb, glued to the first word
export const SAJDA_MARK = '\u06E9'; // ۩ place of prostration, glued to the last word
export const THIN_SPACE = '\u2009';
export const WORD_SEPARATOR = ' ';

/**
 * The page layout draws the sajda sign as one more "word" of the verse, with this text.
 * The Uthmani text glues the sign to the last word instead. The sign is therefore not a
 * word: it is dropped from the layout and stays where the text source puts it.
 */
export const LAYOUT_SAJDA_PLACEHOLDER = '#1969';

/**
 * Uthmani words that the text source writes without a space although they are two words
 * for the page layout and for the Tanzil text: verse key -> positions (1-based) of these
 * words in the Uthmani verse. The text is kept exactly as published; the word simply
 * takes the two neighbouring places of the layout, which must be on the same line.
 */
export const JOINED_WORDS = Object.freeze({
  '15:7': [1], // لَّوۡمَا
  '27:20': [4], // مَالِيَ
  '36:22': [1], // وَمَالِيَ
  '37:164': [1], // وَمَامِنَّآ
  '41:47': [25], // مَامِنَّا
});

/**
 * Verses whose Uthmani text holds a thin space (U+2009) inside a word. Words are separated
 * by U+0020 only, so the thin space stays inside its word, as published.
 */
export const VERSES_WITH_THIN_SPACE_INSIDE_A_WORD = Object.freeze(['2:72']);

/**
 * Quarter-of-hizb starts on which quran-meta and the mushaf disagree. The ۞ sign printed
 * in the layout and in the Uthmani text wins. No hizb or juz start is concerned.
 */
export const QUARTER_START_DISAGREEMENTS = Object.freeze([{ quranMeta: '15:50', mushaf: '15:49' }]);

/**
 * Pages whose first verse differs between the page layout and quran-meta's page list
 * (two printings of the Medina mushaf). Pages and their first verses come from the layout
 * only; quran-meta's page list is not used. The list is pinned so that a change is noticed.
 */
export const PAGES_STARTING_ELSEWHERE_IN_QURAN_META = Object.freeze([
  121, 122, 123, 145, 532, 533, 534, 565, 568, 570, 576, 584, 586, 588, 589, 590, 592, 593, 594,
  595, 596, 597, 598, 599, 600,
]);
