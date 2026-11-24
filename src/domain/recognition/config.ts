/**
 * Tunable numbers of the recognition module, each with the reason for its value.
 *
 * They were chosen on text only (Uthmani corpus against an imla'i text and simulated
 * transcription errors). None of them has been tuned on real recordings yet: expect to
 * revisit them once the speech engine exists (see README.md, "Limites").
 */
export const RECOGNITION_CONFIG = Object.freeze({
  // ---- Comparing two words --------------------------------------------------------------

  /**
   * Similarity of two words that only differ by letters a non-Arabic speaker confuses
   * (same accent-tolerant key). Just under 1 so that, between two otherwise equal passages,
   * the one spelled exactly as heard still ranks first.
   */
  accentMatchSimilarity: 0.9,

  /**
   * From this similarity up, two different spellings count as the same word heard with
   * transcription noise. 0.7 accepts one wrong letter from 4 letters up and two from 7
   * letters up, and refuses any difference in words of 2 or 3 letters, where one letter
   * changes the word (من / عن / لن). Normalised words are 4 letters long on average.
   */
  closeWordSimilarity: 0.7,

  /**
   * A "word" longer than this is not a word of the Quran, whose longest word has 10
   * comparable letters (4 on average): it never matches anything, not even itself. 30
   * leaves room for two or three words glued together by the engine, which must still be
   * compared.
   */
  maxWordLetters: 30,

  // ---- Aligning what was heard with the text ----------------------------------------------

  /**
   * Cost of a heard word placed against a clearly different word of the text (a word that
   * is half alike costs proportionally less). With a cost of 0.5, two words read correctly
   * pay for up to three wrong ones in a row; an isolated chance match further away is not
   * worth joining.
   */
  substitutionPenalty: 0.5,

  /**
   * Cost of a word present on one side only (word of the text not heard, or extra heard
   * word). Same price as a substitution: a wrong word (one substitution) is then cheaper
   * than "one word skipped and one word added" (two gaps), which is the natural reading.
   */
  gapPenalty: 0.5,

  // ---- Searching a passage ----------------------------------------------------------------

  /**
   * Fewer words than this cannot identify a passage: one or two words almost always occur
   * in many places. Three words is the shortest verse length that is commonly unique.
   */
  minWords: 3,

  /**
   * Minimal share of the input that a passage must explain. Measured on the full text
   * with 6 to 12 words drawn at random from the Quran's own vocabulary: the best passage
   * scores under 0.47 for 99 % of them and never reached 0.6 (highest: 0.56; see README.md,
   * "Mesures").
   */
  minScore: 0.6,

  /**
   * Short inputs must be explained almost entirely. Three common words in the right order
   * can be found by chance in a text of 77,000 words: with the score above, 3 % of random
   * inputs of 3 to 5 words found a passage; at 0.8, 0.3 % do, all of them a phrase of the
   * Quran or within a letter of one. One wrong word in such an input means "not found
   * yet": the next words will decide.
   */
  shortInputMaxWords: 5,
  shortInputMinScore: 0.8,

  /**
   * Two passages "explain the input equally well" when less than half a word of evidence
   * separates them: a noisy letter costs a word between a tenth and a third of its
   * weight, so half a word cannot be trusted to separate two passages. For an input of
   * one to three words, half a word is most of the evidence: the margin is then capped at
   * 15 % of the input (with one word, only a letter confused by an accent still ties).
   */
  tieMarginWords: 0.5,
  tieMarginShare: 0.15,

  /**
   * At most this many tied places are returned as candidates. The most repeated passage
   * of three words has 89 places; beyond 300 (one or two very common words, when the
   * caller lowers `minWords`) the result gives the total and says it is truncated.
   */
  maxListedPlaces: 300,

  /**
   * A search uses at most this many words, the most recent ones (spec). Two minutes of
   * recitation; more adds work without telling more about where the reader is.
   */
  maxHeardWords: 300,

  /**
   * How much more likely a passage becomes for each extra word it explains: assumes about
   * one transcribed word in eight is wrong for an ordinary reader with a small on-device
   * model. An assumption, not a measurement. Only used to spread `confidence` between
   * competing passages; ranking and the ambiguity flag do not depend on it.
   */
  oddsPerExplainedWord: 8,

  /**
   * A reader who skips or repeats a word shifts every following word by one position.
   * The search tolerates a shift of a quarter of the input length (three slips in twelve
   * words), never less than `minDriftWords`, which is also how far apart the hits of one
   * passage may be and still be counted together, and never more than `maxDriftWords`,
   * so that the work grows with the length of the input and not with its square.
   */
  minDriftWords: 3,
  driftRatio: 0.25,
  maxDriftWords: 30,

  /**
   * A place of the text is examined in detail when exact word hits give it at least this
   * share of the best place's weight. One half keeps the right passage in the race even
   * when a decoy shares twice as many exactly-spelled words with a noisy input.
   */
  seedKeepRatio: 0.5,

  /**
   * Upper bound on the work spent aligning likely places, in word comparisons (heard
   * words x reference words looked at for each), to bound the time on a slow phone when
   * the input is made of very common words: about 350 places for 12 heard words, 1,400
   * for 3. When places are left out, the result is marked `truncated` (measured: 4 of
   * 22,000 ordinary inputs, all of 3 to 5 common words). The exact places and the twin
   * places are not concerned: they are found without alignment, all of them. At least
   * `minVerifiedPlaces` are always aligned.
   */
  maxVerifiedComparisons: 30_000,
  minVerifiedPlaces: 5,

  /** How many lower-ranked passages are returned after the best (or the tied) ones. */
  maxAlternatives: 5,

  // ---- Following a reader word by word ----------------------------------------------------

  /**
   * How many of the latest heard words are re-examined at each step. They give context:
   * a repeated phrase is recognised as a repetition instead of a jump forward. Twelve words
   * cover a short verse; more would only add work.
   */
  recentHeardWords: 12,

  /**
   * How far behind the reading position a repetition is still recognised ("going back a
   * few words"): the size of the context kept, plus a margin.
   */
  lookBehindWords: 16,

  /**
   * How far ahead a jump is still followed: about two lines of the mushaf, enough for a
   * skipped line or a short skipped verse. Further away the session cannot tell a jump
   * from noise; the caller should then locate the reader again with the verse search.
   */
  lookAheadWords: 24,

  /**
   * A word is only declared passed (skipped or mistake) once this many following words
   * were recognised: "the following words match", in the plural, as the spec demands.
   */
  confirmationWords: 2,

  /**
   * Jumping over more than `shortGapWords` words is unusual (a whole line or verse
   * skipped) and two chance matches could fake it: such a jump needs four matching words.
   */
  shortGapWords: 2,
  longJumpConfirmationWords: 4,

  /**
   * A heard word standing in for an expected word is a mistake only when fewer than half
   * of its letters agree, even on the accent-tolerant key: clearly another word. From one
   * half up to `closeWordSimilarity` the reader gets the benefit of the doubt, because a
   * wrongly red word is worse than a missed mistake. One half exactly is not enough: it
   * is what a single noisy letter does to a two-letter word (من heard as مب).
   */
  mistakeBelowSimilarity: 0.5,
});
