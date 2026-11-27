// Reading the audio again, held to a passage of the Quran (docs/DECISIONS.md, D49).
//
// Whisper's free reading of an ordinary reciter is often misspelt ("الناح يختوا فون" for "الناس
// يستوفون"): the passage search then hesitates between a few passages. Each of them is read
// again from the same audio, the decoder being only allowed tokens that keep the text a stretch
// of that passage (letters only: vowel marks, hamza seats and spaces are not compared, see
// `letters_of`). How far each choice had to move from what the model preferred, summed over the
// reading, is the passage's cost: small for the passage really recited (the model only misspelt
// it), large for the others (the text had to be forced on it).
//
// Pure C++17 over whisper.h's public functions: compiled in the app with whisper.rn's JSI code,
// and on a computer with the voice benchmark's driver (tools/voice-bench).
#pragma once

#include <cstdint>
#include <memory>
#include <string>
#include <vector>

struct whisper_context;
struct whisper_state;
struct whisper_token_data;

namespace quran_decoding {

/** The letters that are compared, one byte each (0 ends a stretch; never a letter). */
using Letters = std::vector<uint8_t>;

/**
 * Letters of UTF-8 text: Arabic letters only, every alef and hamza (ا أ إ آ ٱ ء ؤ ئ) as one letter,
 * ى as ي, ة as ه. Everything else (vowel marks, Quranic signs, spaces, punctuation, Latin letters)
 * is dropped. Incomplete UTF-8 at the end is left in `rest` (a token may cut a letter).
 */
Letters letters_of(const std::string &utf8, std::string *rest = nullptr);

/** The Quran's letters, and where a reading may start. */
struct Index {
    /** Every surah's letters, one after the other, each stretch ended by 0. */
    Letters text;
    /** Positions where a reading may start (each word's first letter), sorted by what follows. */
    std::vector<int32_t> starts;
    /**
     * Opening formulas (isti'adha, basmala): said before a passage, then the passage follows.
     * Each is kept as the letters of each of its endings at a word (the whole formula first), so
     * that a formula whose first word was lost still counts.
     */
    std::vector<Letters> formulas;
    /** The whole formulas only. */
    std::vector<Letters> whole_formulas;
};

/**
 * Builds the index from a text file: one line per verse, "<surah> <verse> <text>", in mushaf
 * order, and lines "formula <text>" for the opening formulas. Returns null when the file cannot
 * be read or holds no verse.
 */
std::shared_ptr<const Index> load_index(const std::string &path);
/** The same from the file's content (tests). */
std::shared_ptr<const Index> build_index(const std::string &content);
/** The index of `content`; the last large one (the whole Quran) is kept and reused. */
std::shared_ptr<const Index> index_for(const std::string &content);
/** The index of `path`, built once per path and kept (the phone opens it once). */
std::shared_ptr<const Index> shared_index(const std::string &path);

/** The range of `starts` whose text begins with `prefix`: [first, last). */
struct Range {
    int32_t first = 0;
    int32_t last = 0;
    bool empty() const { return first >= last; }
};
Range find(const Index &index, const Letters &prefix);
/** Narrows `range` (the starts that begin with `prefix`) to those that go on with `more`. */
Range narrow(const Index &index, Range range, size_t prefix_length, const Letters &more);

/** The opening formulas at the start of `all` (only when letters follow them) are skipped. */
Letters passage_part(const Index &index, const Letters &all);

/**
 * How many words at the start of a reading may be anything: a word cut by the start of the audio,
 * or misheard, would otherwise hold the whole reading to the wrong place.
 */
constexpr size_t MAX_FREE_WORDS = 2;

/** Letters of the free words at the start of `bytes` (0 when the whole text is a stretch). */
size_t free_letters(const Index &index, const std::string &bytes);
/** Letters of `bytes` that are the passage itself: neither free words nor opening formulas. */
size_t passage_letters(const Index &index, const std::string &bytes);

/**
 * Marks in `allowed` (one entry per text token) the tokens that keep the text `bytes` a stretch
 * of `index` (after opening formulas; its first MAX_FREE_WORDS words may also be anything), among the `candidates` likeliest tokens by `logits` (all tokens when none of these
 * does). `free_added`, if given, holds for each allowed token how many letters it adds to the free
 * words (`free_letters`): a token may make earlier words free by starting the passage later.
 * Returns false when no token is allowed (a dead end: the reading can only stop).
 */
bool allowed_tokens(const Index &index, const std::vector<std::string> &pieces,
                    const std::string &bytes, const float *logits, int candidates,
                    std::vector<char> &allowed, std::vector<int> *free_added = nullptr);

/** One reading of the audio held to a text. */
struct Reading {
    std::string text;
    /**
     * Sum, over each token chosen, of the best log-probability the model gave any token (text or
     * end) at that point minus the one it gave the token chosen: 0 when the text is what the model
     * would have written anyway; grows with each token the text forced on it.
     */
    double cost = 0.0;
    /** Letters of `text` (as `letters_of` counts them) and tokens chosen. */
    int letters = 0;
    int tokens = 0;
    /** Letters of the free words at its start, which the passage does not explain. */
    int free_letters = 0;
    /** Letters of the passage itself (neither free words nor opening formulas). */
    int passage_letters = 0;
    /** The text ran out of continuations before the model chose to stop. */
    bool dead_end = false;
    /**
     * Stopped early: it already cost `ReadOptions::margin` more than the best text read before it
     * (`cost` is then only a lower bound).
     */
    bool abandoned = false;
};

struct ReadOptions {
    int threads = 2;
    /** The reading may not stop before it holds this many letters (unless the text runs out). */
    int min_letters = 0;
    int max_tokens = 160;
    int candidates = 64;
    /**
     * What a letter of a free word costs, in the units of Reading::cost; so does each letter
     * missing to `min_letters` when the text runs out.
     */
    float free_letter_cost = 2.0f;
    /**
     * Likeliest first tokens tried, each read greedily from there (the cheapest is kept): the
     * first word decides much of a greedy reading. (A real beam search re-decodes too much here:
     * whisper.h decodes one sequence at a time.)
     */
    int first_choices = 3;
    /** A text is not read to the end once it costs this much more than the best one (0: never). */
    double margin = 0.0;
};

/**
 * Encodes `samples` (16 kHz mono, -1..1) once with `ctx`, then reads them once per index of
 * `texts`, each time held to that text (greedy from each of the likeliest first tokens, Arabic,
 * starting at the first timestamp). Returns one Reading per text (in order), or an empty vector
 * when Whisper fails. Uses the context's own state: not while another
 * reading runs on it.
 */
std::vector<Reading> read_held_to(whisper_context *ctx, const float *samples, int n_samples,
                                  const std::vector<std::shared_ptr<const Index>> &texts,
                                  const ReadOptions &options);

/**
 * The readings as JSON: an array of {"text", "cost", "letters", "freeLetters", "passageLetters",
 * "tokens", "deadEnd", "abandoned"} (the shape the app reads, `data/speech/held-reading.ts`).
 */
std::string readings_json(const std::vector<Reading> &readings);

}  // namespace quran_decoding
