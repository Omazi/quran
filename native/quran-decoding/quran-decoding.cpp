// Quran-constrained decoding for whisper.cpp: see quran-decoding.h.
#include "quran-decoding.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <limits>
#include <mutex>
#include <unordered_map>
#include <sstream>

// whisper.rn's JSI code, which includes this file, has already included its own copy
// (<rnwhisper/whisper.h> with the prebuilt framework); the bench driver has not.
#ifndef WHISPER_H
#include "whisper.h"
#endif

namespace quran_decoding {

namespace {

constexpr uint8_t DROP = 0;
/** Alef and hamza, whatever their shape or seat: one letter. */
constexpr uint8_t ALEF = 1;

/** The compared letter for a code point, or DROP. */
uint8_t letter_code(uint32_t cp) {
    switch (cp) {
        case 0x0621: case 0x0622: case 0x0623: case 0x0624: case 0x0625: case 0x0626:
        case 0x0627: case 0x0671: case 0x0672: case 0x0673: case 0x0675:
            return ALEF;
        case 0x0649: return 0x064A - 0x0620;  // ى -> ي
        case 0x06CC: return 0x064A - 0x0620;  // Persian ya -> ي
        case 0x06D2: return 0x064A - 0x0620;
        case 0x0629: return 0x0647 - 0x0620;  // ة -> ه
        case 0x06C1: case 0x06BE: case 0x06D5: return 0x0647 - 0x0620;
        case 0x06A9: return 0x0643 - 0x0620;  // Persian kaf -> ك
        case 0x0640: return DROP;              // tatweel
        default: break;
    }
    if (cp >= 0x0628 && cp <= 0x064A) return static_cast<uint8_t>(cp - 0x0620);
    return DROP;
}

enum class Utf8 { ok, incomplete, invalid };

/** Decodes one UTF-8 code point at `i` and moves past it (not when incomplete or invalid). */
Utf8 decode_at(const std::string &s, size_t &i, uint32_t &cp) {
    const auto b = [&](size_t k) { return static_cast<unsigned char>(s[k]); };
    const unsigned char c = b(i);
    size_t len = 0;
    if (c == 0xC0 || c == 0xC1 || c >= 0xF5) return Utf8::invalid;  // never in UTF-8
    if (c < 0x80) len = 1;
    else if ((c >> 5) == 0x6) len = 2;
    else if ((c >> 4) == 0xE) len = 3;
    else if ((c >> 3) == 0x1E) len = 4;
    else return Utf8::invalid;  // a continuation byte where a character should start
    for (size_t k = 1; k < len; ++k) {
        if (i + k >= s.size()) return Utf8::incomplete;
        if ((b(i + k) & 0xC0) != 0x80) return Utf8::invalid;
    }
    if (len == 1) cp = c;
    else if (len == 2) cp = ((c & 0x1F) << 6) | (b(i + 1) & 0x3F);
    else if (len == 3) cp = ((c & 0x0F) << 12) | ((b(i + 1) & 0x3F) << 6) | (b(i + 2) & 0x3F);
    else cp = ((c & 0x07) << 18) | ((b(i + 1) & 0x3F) << 12) | ((b(i + 2) & 0x3F) << 6) | (b(i + 3) & 0x3F);
    i += len;
    return Utf8::ok;
}

/** Decodes one code point; false when the text ends inside it. Invalid bytes are skipped. */
bool next_code_point(const std::string &s, size_t &i, uint32_t &cp) {
    while (i < s.size()) {
        const Utf8 r = decode_at(s, i, cp);
        if (r == Utf8::ok) return true;
        if (r == Utf8::incomplete) return false;
        cp = 0xFFFD;
        i += 1;
        return true;
    }
    return false;
}

bool is_space(uint32_t cp) { return cp == ' ' || cp == '\t' || cp == '\n' || cp == '\r'; }

/** A vowel mark, shadda, sukun or other sign carried by a letter. */
bool is_mark(uint32_t cp) {
    return (cp >= 0x064B && cp <= 0x065F) || cp == 0x0670 || (cp >= 0x0610 && cp <= 0x061A) ||
           (cp >= 0x06D6 && cp <= 0x06ED) || cp == 0x0640;
}

/**
 * Whether a token's text may be written at all: Arabic letters, signs and spaces only (no
 * punctuation, digit or Latin letter), never two spaces in a row, and no more than three signs on
 * one letter (the model would otherwise pile signs up instead of writing the text). `before` is
 * what is already written.
 */
bool writable(const std::string &before, const std::string &piece) {
    if (piece.empty()) return false;
    // What ends `before`: a space, and how many signs since its last letter.
    bool after_space = before.empty();
    int marks = 0;
    size_t tail = before.size();  // where the incomplete character at the end starts, if any
    {
        size_t i = 0;
        uint32_t cp = 0;
        while (i < before.size()) {
            const size_t at = i;
            if (!next_code_point(before, i, cp)) {
                tail = at;
                break;
            }
            if (is_space(cp)) {
                after_space = true;
                marks = 0;
            } else if (is_mark(cp)) {
                marks += 1;
            } else {
                after_space = false;
                marks = 0;
            }
        }
    }
    const std::string text = before.substr(tail) + piece;
    size_t i = 0;
    uint32_t cp = 0;
    while (i < text.size()) {
        const Utf8 r = decode_at(text, i, cp);
        if (r == Utf8::incomplete) {
            // A character cut in two, judged with the next token: only the Arabic block.
            const unsigned char lead = static_cast<unsigned char>(text[i]);
            return lead >= 0xD8 && lead <= 0xDB;
        }
        if (r == Utf8::invalid) return false;
        if (is_space(cp)) {
            if (after_space) return false;
            after_space = true;
            marks = 0;
        } else if (is_mark(cp)) {
            if (after_space || ++marks > 3) return false;
        } else if (letter_code(cp) != DROP) {
            after_space = false;
            marks = 0;
        } else {
            return false;
        }
    }
    return true;
}

/** -1, 0 or 1: the text at `start` before, beginning with, or after `prefix` (from `from`). */
int compare_at(const Letters &text, int32_t start, const Letters &prefix, size_t from) {
    for (size_t i = from; i < prefix.size(); ++i) {
        const uint8_t t = text[static_cast<size_t>(start) + i];
        if (t != prefix[i]) return t < prefix[i] ? -1 : 1;  // 0 (end of a stretch) is smallest
    }
    return 0;
}

/** Like compare_at, for `more` placed at offset `offset` of the text at `start`. */
int compare_more(const Letters &text, int32_t start, size_t offset, const Letters &more) {
    for (size_t i = 0; i < more.size(); ++i) {
        const size_t at = static_cast<size_t>(start) + offset + i;
        // A stretch shorter than `offset` cannot be in the range; guard anyway.
        if (at >= text.size()) return -1;
        const uint8_t t = text[at];
        if (t != more[i]) return t < more[i] ? -1 : 1;
        if (t == 0) return -1;
    }
    return 0;
}

}  // namespace

Letters letters_of(const std::string &utf8, std::string *rest) {
    Letters out;
    out.reserve(utf8.size() / 2);
    size_t i = 0;
    while (i < utf8.size()) {
        uint32_t cp = 0;
        const size_t before = i;
        if (!next_code_point(utf8, i, cp)) {
            if (rest != nullptr) *rest = utf8.substr(before);
            return out;
        }
        const uint8_t code = letter_code(cp);
        if (code != DROP) out.push_back(code);
    }
    if (rest != nullptr) rest->clear();
    return out;
}

std::shared_ptr<const Index> build_index(const std::string &content) {
    auto index = std::make_shared<Index>();
    std::istringstream lines(content);
    std::string line;
    int current_surah = -1;
    size_t verses = 0;
    // Adds the words of `text` to the index text, noting where each word starts.
    const auto add_words = [&](const std::string &text) {
        std::string word;
        const auto flush = [&]() {
            if (word.empty()) return;
            Letters letters = letters_of(word);
            if (!letters.empty()) {
                index->starts.push_back(static_cast<int32_t>(index->text.size()));
                index->text.insert(index->text.end(), letters.begin(), letters.end());
            }
            word.clear();
        };
        size_t i = 0;
        while (i < text.size()) {
            size_t start = i;
            uint32_t cp = 0;
            if (!next_code_point(text, i, cp)) break;
            if (is_space(cp)) {
                flush();
            } else {
                word.append(text, start, i - start);
            }
        }
        flush();
    };
    while (std::getline(lines, line)) {
        if (line.empty() || line[0] == '#') continue;
        if (line.rfind("formula ", 0) == 0) {
            if (current_surah != -1) index->text.push_back(0);
            current_surah = -1;
            const std::string text = line.substr(8);
            // The formula, then each of its endings at a word.
            std::vector<Letters> words;
            {
                std::istringstream split(text);
                std::string word;
                while (split >> word) {
                    Letters letters = letters_of(word);
                    if (!letters.empty()) words.push_back(letters);
                }
            }
            Letters whole;
            for (const Letters &word : words) whole.insert(whole.end(), word.begin(), word.end());
            index->whole_formulas.push_back(whole);
            for (size_t first = 0; first < words.size(); ++first) {
                Letters ending;
                for (size_t w = first; w < words.size(); ++w) {
                    ending.insert(ending.end(), words[w].begin(), words[w].end());
                }
                index->formulas.push_back(ending);
            }
            add_words(text);
            index->text.push_back(0);
            continue;
        }
        std::istringstream fields(line);
        int surah = 0, verse = 0;
        if (!(fields >> surah >> verse)) continue;
        std::string text;
        std::getline(fields, text);
        if (surah != current_surah) {
            if (current_surah != -1) index->text.push_back(0);
            current_surah = surah;
        }
        add_words(text);
        ++verses;
    }
    if (current_surah != -1) index->text.push_back(0);
    if (verses == 0) return nullptr;
    // A margin of zeros: comparisons may look past the last stretch.
    index->text.insert(index->text.end(), 64, 0);

    const Letters &text = index->text;
    std::sort(index->starts.begin(), index->starts.end(), [&text](int32_t a, int32_t b) {
        size_t i = 0;
        while (true) {
            const uint8_t x = text[static_cast<size_t>(a) + i];
            const uint8_t y = text[static_cast<size_t>(b) + i];
            if (x != y) return x < y;
            if (x == 0) return a < b;
            ++i;
        }
    });
    // Longest formula first, so that stripping prefers the whole isti'adha over a part of it.
    std::sort(index->formulas.begin(), index->formulas.end(),
              [](const Letters &a, const Letters &b) { return a.size() > b.size(); });
    return index;
}

std::shared_ptr<const Index> load_index(const std::string &path) {
    std::ifstream file(path, std::ios::binary);
    if (!file) return nullptr;
    std::ostringstream content;
    content << file.rdbuf();
    return build_index(content.str());
}

std::shared_ptr<const Index> shared_index(const std::string &path) {
    static std::mutex mutex;
    static std::unordered_map<std::string, std::shared_ptr<const Index>> built;
    std::lock_guard<std::mutex> lock(mutex);
    auto found = built.find(path);
    if (found != built.end()) return found->second;
    auto index = load_index(path);
    if (index != nullptr) built.emplace(path, index);
    return index;
}

Range find(const Index &index, const Letters &prefix) {
    const auto &starts = index.starts;
    const auto lower = std::partition_point(starts.begin(), starts.end(), [&](int32_t s) {
        return compare_at(index.text, s, prefix, 0) < 0;
    });
    const auto upper = std::partition_point(lower, starts.end(), [&](int32_t s) {
        return compare_at(index.text, s, prefix, 0) == 0;
    });
    return {static_cast<int32_t>(lower - starts.begin()), static_cast<int32_t>(upper - starts.begin())};
}

Range narrow(const Index &index, Range range, size_t prefix_length, const Letters &more) {
    if (more.empty() || range.empty()) return range;
    const auto begin = index.starts.begin() + range.first;
    const auto end = index.starts.begin() + range.last;
    const auto lower = std::partition_point(begin, end, [&](int32_t s) {
        return compare_more(index.text, s, prefix_length, more) < 0;
    });
    const auto upper = std::partition_point(lower, end, [&](int32_t s) {
        return compare_more(index.text, s, prefix_length, more) == 0;
    });
    return {static_cast<int32_t>(lower - index.starts.begin()),
            static_cast<int32_t>(upper - index.starts.begin())};
}

namespace {
bool is_whole_formula(const Index &index, const Letters &formula) {
    return std::find(index.whole_formulas.begin(), index.whole_formulas.end(), formula) !=
           index.whole_formulas.end();
}
}  // namespace

Letters passage_part(const Index &index, const Letters &all) {
    // At most two formulas (isti'adha, then basmala); only the first may have lost its start
    // (the formulas are listed with each of their endings at a word, longest first).
    size_t from = 0;
    for (int stripped = 0; stripped < 2; ++stripped) {
        bool found = false;
        for (const Letters &formula : index.formulas) {
            if (formula.empty() || all.size() - from <= formula.size()) continue;
            if (stripped > 0 && !is_whole_formula(index, formula)) continue;
            if (std::equal(formula.begin(), formula.end(), all.begin() + static_cast<long>(from))) {
                from += formula.size();
                found = true;
                break;
            }
        }
        if (!found) break;
    }
    return Letters(all.begin() + static_cast<long>(from), all.end());
}

namespace {

/** Letter offsets where the text's words start, from the second on (at most `count`). */
std::vector<size_t> later_word_starts(const std::string &bytes, size_t count) {
    std::vector<size_t> starts;
    size_t letters = 0;
    bool in_word = false;
    size_t i = 0;
    uint32_t cp = 0;
    while (i < bytes.size() && next_code_point(bytes, i, cp)) {
        if (letter_code(cp) != DROP) {
            if (!in_word && letters > 0) {
                starts.push_back(letters);
                if (starts.size() == count) return starts;
            }
            in_word = true;
            letters += 1;
        } else if (is_space(cp)) {
            in_word = false;
        }
    }
    return starts;
}

/** Whether `letters` from `from` on are a stretch of `index` (after opening formulas). */
bool stretch_from(const Index &index, const Letters &letters, size_t from) {
    return !find(index, passage_part(index, Letters(letters.begin() + static_cast<long>(from), letters.end())))
                .empty();
}

}  // namespace

namespace {

/**
 * The letters of the free words at the start of `bytes` when the rest is a stretch, or -1 when it
 * cannot be read that way (any letters do while the free words are being written).
 */
long free_letters_or_none(const Index &index, const std::string &bytes) {
    const Letters all = letters_of(bytes);
    if (stretch_from(index, all, 0)) return 0;
    const std::vector<size_t> later = later_word_starts(bytes, MAX_FREE_WORDS);
    for (size_t start : later) {
        if (stretch_from(index, all, start)) return static_cast<long>(start);
    }
    // Still writing the free words (words, not a text written without spaces: 14 letters at most).
    if (later.size() < MAX_FREE_WORDS && all.size() < 14) return static_cast<long>(all.size());
    return -1;
}

}  // namespace

size_t free_letters(const Index &index, const std::string &bytes) {
    const long free = free_letters_or_none(index, bytes);
    return free < 0 ? letters_of(bytes).size() : static_cast<size_t>(free);
}

size_t passage_letters(const Index &index, const std::string &bytes) {
    const Letters all = letters_of(bytes);
    const size_t free = free_letters(index, bytes);
    if (free >= all.size()) return 0;
    return passage_part(index, Letters(all.begin() + static_cast<long>(free), all.end())).size();
}

bool allowed_tokens(const Index &index, const std::vector<std::string> &pieces,
                    const std::string &bytes, const float *logits, int candidates,
                    std::vector<char> &allowed, std::vector<int> *free_added) {
    const int n_text = static_cast<int>(pieces.size());
    allowed.assign(static_cast<size_t>(n_text), 0);
    if (free_added != nullptr) free_added->assign(static_cast<size_t>(n_text), 0);
    const long free_before = free_letters_or_none(index, bytes);
    if (free_before < 0) return false;

    const auto check = [&](int id) -> bool {
        const std::string &piece = pieces[static_cast<size_t>(id)];
        if (!writable(bytes, piece)) return false;
        std::string rest;
        const std::string text = bytes + piece;
        letters_of(text, &rest);
        // A letter cut in two is judged once finished.
        const long free = free_letters_or_none(index, text.substr(0, text.size() - rest.size()));
        if (free < 0) return false;
        if (free_added != nullptr) (*free_added)[static_cast<size_t>(id)] = static_cast<int>(free - free_before);
        return true;
    };

    std::vector<int> order(static_cast<size_t>(n_text));
    for (int i = 0; i < n_text; ++i) order[static_cast<size_t>(i)] = i;
    const int k = std::min(candidates, n_text);
    std::partial_sort(order.begin(), order.begin() + k, order.end(),
                      [logits](int a, int b) { return logits[a] > logits[b]; });
    bool any = false;
    // Past the likeliest `k`, only when none of them goes on with the text, and not beyond the
    // likeliest 1024 (further down, the model does not hear that token at all).
    const int limit = std::min(n_text, std::max(k, 1024));
    if (limit > k) {
        std::partial_sort(order.begin() + k, order.begin() + limit, order.end(),
                          [logits](int a, int b) { return logits[a] > logits[b]; });
    }
    for (int j = 0; j < limit && (j < k || !any); ++j) {
        const int id = order[static_cast<size_t>(j)];
        if (std::isfinite(logits[id]) && check(id)) {
            allowed[static_cast<size_t>(id)] = 1;
            any = true;
        }
    }
    return any;
}

namespace {

/** Greedy readings of the encoded audio, held to one index at a time. */
class HeldReader {
public:
    HeldReader(whisper_context *ctx, const ReadOptions &options) : ctx_(ctx), options_(options) {
        eot_ = whisper_token_eot(ctx);
        n_vocab_ = whisper_n_vocab(ctx);
        pieces_.resize(static_cast<size_t>(eot_));
        for (int id = 0; id < eot_; ++id) {
            const char *piece = whisper_token_to_str(ctx, id);
            pieces_[static_cast<size_t>(id)] = piece == nullptr ? std::string() : std::string(piece);
        }
        logits_.resize(static_cast<size_t>(n_vocab_));
    }

    /**
     * Decodes the prompt once: as whisper.rn's own readings start (timestamps on), the first
     * timestamp <|0.00|>, then the text; later timestamps are never chosen here.
     */
    bool start() {
        const whisper_token prompt[PROMPT] = {whisper_token_sot(ctx_),
                                              whisper_token_lang(ctx_, whisper_lang_id("ar")),
                                              whisper_token_transcribe(ctx_), whisper_token_beg(ctx_)};
        if (whisper_decode(ctx_, prompt, PROMPT, 0, options_.threads) != 0) return false;
        // whisper.cpp keeps one row of logits per token decoded: the prompt's last one is wanted.
        const float *row = whisper_get_logits(ctx_) + static_cast<size_t>(PROMPT - 1) * n_vocab_;
        first_logits_.assign(row, row + n_vocab_);
        return true;
    }

    /**
     * One greedy reading held to `index`, its first token forced to `first` when not -1. Stops
     * (`abandoned`) as soon as its cost passes `bound`. `firsts`, when given, receives the
     * allowed first tokens, best first. False when Whisper fails.
     */
    bool read(const Index &index, int first, double bound, Reading &reading, std::vector<int> *firsts) {
        reading = Reading();
        std::string bytes;
        int n_past = PROMPT;
        const float minus_infinity = -std::numeric_limits<float>::infinity();
        for (int step = 0; step < options_.max_tokens; ++step) {
            const float *source = step == 0 ? first_logits_.data() : whisper_get_logits(ctx_);
            std::copy(source, source + n_vocab_, logits_.begin());
            // Only text tokens and the end: timestamps and the other special tokens never.
            for (int i = eot_ + 1; i < n_vocab_; ++i) logits_[static_cast<size_t>(i)] = minus_infinity;
            float max_logit = minus_infinity;
            for (int i = 0; i <= eot_; ++i) max_logit = std::max(max_logit, logits_[static_cast<size_t>(i)]);

            const bool open = allowed_tokens(index, pieces_, bytes, logits_.data(), options_.candidates,
                                             allowed_, &free_added_);
            std::string rest;
            const int letters = static_cast<int>(letters_of(bytes, &rest).size());
            // Whisper never ends before a first token; a letter cut in two is finished first.
            const bool may_end = !open || (step > 0 && rest.empty() && letters >= options_.min_letters);
            // A letter of a free word costs `free_letter_cost`, as if the model had been that much
            // less sure of it: the reading takes a free word only when the passage fits worse.
            const auto value_of = [&](int i) {
                return logits_[static_cast<size_t>(i)] -
                       options_.free_letter_cost * static_cast<float>(free_added_[static_cast<size_t>(i)]);
            };
            int chosen = -1;
            float chosen_value = minus_infinity;
            for (int i = 0; i < eot_; ++i) {
                if (allowed_[static_cast<size_t>(i)] && value_of(i) > chosen_value) {
                    chosen = i;
                    chosen_value = value_of(i);
                }
            }
            if (step == 0 && firsts != nullptr) {
                firsts->clear();
                for (int i = 0; i < eot_; ++i) {
                    if (allowed_[static_cast<size_t>(i)]) firsts->push_back(i);
                }
                std::sort(firsts->begin(), firsts->end(), [&](int x, int y) { return value_of(x) > value_of(y); });
            }
            if (step == 0 && first >= 0 && first < eot_ && allowed_[static_cast<size_t>(first)]) {
                chosen = first;
                chosen_value = value_of(first);
            } else if (may_end && (chosen < 0 || logits_[static_cast<size_t>(eot_)] > chosen_value)) {
                chosen = eot_;
                chosen_value = logits_[static_cast<size_t>(eot_)];
            }
            if (chosen < 0) break;
            // Difference of two log-probabilities: the softmax's normaliser cancels out.
            reading.cost += static_cast<double>(max_logit - chosen_value);
            if (reading.cost > bound) {
                reading.abandoned = true;
                break;
            }
            if (chosen == eot_) {
                reading.dead_end = !open;
                break;
            }
            bytes += pieces_[static_cast<size_t>(chosen)];
            reading.tokens += 1;
            const whisper_token next = chosen;
            if (whisper_decode(ctx_, &next, 1, n_past, options_.threads) != 0) return false;
            n_past += 1;
        }
        std::string rest;
        reading.letters = static_cast<int>(letters_of(bytes, &rest).size());
        reading.text = bytes.substr(0, bytes.size() - rest.size());
        reading.free_letters = static_cast<int>(free_letters(index, reading.text));
        reading.passage_letters = static_cast<int>(passage_letters(index, reading.text));
        // Letters the passage could not explain before the reading had to end cost as much as
        // letters of free words.
        if (!reading.abandoned && reading.letters < options_.min_letters) {
            reading.cost += static_cast<double>(options_.free_letter_cost) * (options_.min_letters - reading.letters);
        }
        return true;
    }

private:
    static constexpr int PROMPT = 4;
    whisper_context *ctx_;
    const ReadOptions &options_;
    int eot_ = 0;
    int n_vocab_ = 0;
    std::vector<std::string> pieces_;
    std::vector<float> logits_;
    std::vector<float> first_logits_;
    std::vector<char> allowed_;
    std::vector<int> free_added_;
};

}  // namespace

std::vector<Reading> read_held_to(whisper_context *ctx, const float *samples, int n_samples,
                                  const std::vector<std::shared_ptr<const Index>> &texts,
                                  const ReadOptions &options) {
    std::vector<Reading> readings;
    if (whisper_pcm_to_mel(ctx, samples, n_samples, options.threads) != 0) return readings;
    if (whisper_encode(ctx, 0, options.threads) != 0) return readings;
    HeldReader reader(ctx, options);
    if (!reader.start()) return readings;

    const double infinity = std::numeric_limits<double>::infinity();
    double best_overall = infinity;
    for (const auto &index : texts) {
        if (index == nullptr) return {};
        // A text more than `margin` worse than the best so far is not read to the end.
        const double bound = options.margin > 0 ? best_overall + options.margin : infinity;
        Reading best;
        std::vector<int> firsts;
        if (!reader.read(*index, -1, bound, best, &firsts)) return {};
        // The first word decides much of a greedy reading: the next likeliest first tokens are
        // tried too, each stopped as soon as it costs more than the best reading so far.
        for (size_t k = 1; k < firsts.size() && static_cast<int>(k) < options.first_choices; ++k) {
            if (firsts[k] == firsts[0]) continue;
            Reading other;
            const double limit = std::min(bound, best.abandoned ? infinity : best.cost);
            if (!reader.read(*index, firsts[k], limit, other, nullptr)) return {};
            if (!other.abandoned && (best.abandoned || other.cost < best.cost)) best = std::move(other);
        }
        if (!best.abandoned) best_overall = std::min(best_overall, best.cost);
        readings.push_back(std::move(best));
    }
    return readings;
}

std::string readings_json(const std::vector<Reading> &readings) {
    std::string out = "[";
    for (size_t i = 0; i < readings.size(); ++i) {
        const Reading &r = readings[i];
        std::string text;
        for (unsigned char c : r.text) {
            if (c == '"' || c == '\\') {
                text += '\\';
                text += static_cast<char>(c);
            } else if (c < 0x20) {
                char buf[8];
                snprintf(buf, sizeof buf, "\\u%04x", c);
                text += buf;
            } else {
                text += static_cast<char>(c);
            }
        }
        char numbers[256];
        snprintf(numbers, sizeof numbers,
                 "\"cost\":%.3f,\"letters\":%d,\"freeLetters\":%d,\"passageLetters\":%d,\"tokens\":%d,"
                 "\"deadEnd\":%s,\"abandoned\":%s",
                 r.cost, r.letters, r.free_letters, r.passage_letters, r.tokens,
                 r.dead_end ? "true" : "false", r.abandoned ? "true" : "false");
        out += i > 0 ? "," : "";
        out += "{\"text\":\"" + text + "\"," + numbers + "}";
    }
    return out + "]";
}


}  // namespace quran_decoding
