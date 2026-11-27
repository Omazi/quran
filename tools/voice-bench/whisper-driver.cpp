// A stand-in for whisper.rn's `transcribeData` on a computer, for the voice benchmark
// (tools/voice-bench/README.md). It is compiled from the very whisper.cpp sources that
// whisper.rn 0.7.4 bundles (node_modules/whisper.rn/cpp, whisper.cpp 1.9.3), and builds its
// parameters the way RNWhisperJSI.cpp's createTranscribeConfig does: the greedy defaults of
// whisper_full_default_params, then the options the app passes, then no_context = true and
// single_segment = false. Only the backend differs: CPU here, Metal on the iPhone.
//
// Protocol, one request after another on stdin, one answer line on stdout:
//   request: a text line "samples=<n> threads=<t> beam=<b> bestof=<k> temp=<f> tinc=<f>
//            maxctx=<m> prompt=<p>" (beam 0: greedy; prompt: byte length of a UTF-8 prompt
//            that follows the line), the prompt bytes, then n little-endian int16 samples.
//   answer:  {"text":"...","ms":<compute milliseconds>}
//
//   or, to read the audio again held to passages (native/quran-decoding, D49):
//   request: "held samples=<n> threads=<t> minletters=<m> freecost=<f> firsts=<k> margin=<g>
//            texts=<b>", then b bytes:
//            the texts,
//            separated by form feeds, each in the index format of quran-decoding.h; then the
//            samples.
//   answer:  {"readings":[{"text":"...","cost":<c>,"letters":<l>,"freeLetters":<f>,
//            "passageLetters":<p>,"tokens":<t>,
//            "deadEnd":<b>,"abandoned":<b>}],
//            "ms":<compute milliseconds>}
#include "whisper.h"
#include "quran-decoding.h"

#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

static std::string json_escape(const std::string &s) {
    std::string out;
    for (unsigned char c : s) {
        switch (c) {
            case '"': out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default:
                if (c < 0x20) {
                    char buf[8];
                    snprintf(buf, sizeof buf, "\\u%04x", c);
                    out += buf;
                } else {
                    out += static_cast<char>(c);
                }
        }
    }
    return out;
}

static void quiet_log(enum wsp_ggml_log_level, const char *, void *) {}

int main(int argc, char **argv) {
    if (argc < 2) {
        fprintf(stderr, "usage: %s <ggml model>\n", argv[0]);
        return 2;
    }
    if (getenv("WHISPER_DRIVER_VERBOSE") == nullptr) whisper_log_set(quiet_log, nullptr);
    whisper_context_params cparams = whisper_context_default_params();
    cparams.use_gpu = false;
    whisper_context *ctx = whisper_init_from_file_with_params(argv[1], cparams);
    if (ctx == nullptr) {
        fprintf(stderr, "failed to load %s\n", argv[1]);
        return 1;
    }
    printf("{\"ready\":true,\"version\":\"%s\"}\n", whisper_version());
    fflush(stdout);

    std::string line;
    while (std::getline(std::cin, line)) {
        if (line.empty()) continue;
        long samples = 0, prompt_len = 0;
        int threads = 2, beam = 0, bestof = 5, maxctx = 0, minletters = 0;
        float freecost = 2.0f;
        int held_beam = 3;
        double margin = 0.0;
        long texts_len = 0;
        const bool held = line.rfind("held ", 0) == 0;
        float temp = 0.0f, tinc = 0.2f;
        std::istringstream in(line);
        std::string kv;
        while (in >> kv) {
            auto eq = kv.find('=');
            if (eq == std::string::npos) continue;
            std::string k = kv.substr(0, eq), v = kv.substr(eq + 1);
            if (k == "samples") samples = atol(v.c_str());
            else if (k == "threads") threads = atoi(v.c_str());
            else if (k == "beam") beam = atoi(v.c_str());
            else if (k == "bestof") bestof = atoi(v.c_str());
            else if (k == "temp") temp = static_cast<float>(atof(v.c_str()));
            else if (k == "tinc") tinc = static_cast<float>(atof(v.c_str()));
            else if (k == "maxctx") maxctx = atoi(v.c_str());
            else if (k == "prompt") prompt_len = atol(v.c_str());
            else if (k == "minletters") minletters = atoi(v.c_str());
            else if (k == "freecost") freecost = static_cast<float>(atof(v.c_str()));
            else if (k == "firsts" && held) held_beam = atoi(v.c_str());
            else if (k == "margin") margin = atof(v.c_str());
            else if (k == "texts") texts_len = atol(v.c_str());
        }
        std::string prompt(static_cast<size_t>(prompt_len), '\0');
        if (prompt_len > 0) std::cin.read(&prompt[0], prompt_len);
        std::string texts(static_cast<size_t>(texts_len), '\0');
        if (texts_len > 0) std::cin.read(&texts[0], texts_len);
        std::vector<int16_t> pcm(static_cast<size_t>(samples));
        if (samples > 0) std::cin.read(reinterpret_cast<char *>(pcm.data()), samples * 2);
        if (!std::cin) break;

        // RNWhisperJSI.cpp, decodePcm16: divided by 32767 and clamped.
        std::vector<float> audio(pcm.size());
        for (size_t i = 0; i < pcm.size(); ++i) {
            float x = static_cast<float>(pcm[i]) / 32767.0f;
            audio[i] = x < -1.0f ? -1.0f : (x > 1.0f ? 1.0f : x);
        }

        if (held) {
            std::vector<std::shared_ptr<const quran_decoding::Index>> indexes;
            size_t from = 0;
            while (from <= texts.size()) {
                size_t to = texts.find('\f', from);
                if (to == std::string::npos) to = texts.size();
                indexes.push_back(quran_decoding::index_for(texts.substr(from, to - from)));
                from = to + 1;
            }
            quran_decoding::ReadOptions options;
            options.threads = threads;
            options.min_letters = minletters;
            options.free_letter_cost = freecost;
            options.first_choices = held_beam;
            options.margin = margin;
            auto t0 = std::chrono::steady_clock::now();
            auto readings = quran_decoding::read_held_to(ctx, audio.data(), static_cast<int>(audio.size()),
                                                         indexes, options);
            double ms = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0).count();
            const std::string out = "{\"readings\":" + quran_decoding::readings_json(readings);
            if (getenv("WHISPER_DRIVER_VERBOSE") != nullptr) {
                whisper_print_timings(ctx);
                whisper_reset_timings(ctx);
            }
            printf("%s,\"ms\":%.1f}\n", out.c_str(), ms);
            fflush(stdout);
            continue;
        }

        // RNWhisperJSI.cpp, createTranscribeConfig.
        whisper_full_params p = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
        p.print_realtime = false;
        p.print_progress = false;
        p.print_timestamps = false;
        p.print_special = false;
        p.n_threads = threads;
        p.translate = false;
        p.token_timestamps = false;
        p.n_max_text_ctx = maxctx;
        p.temperature = temp;
        p.temperature_inc = tinc;
        p.greedy.best_of = bestof;
        if (beam > 0) {
            p.strategy = WHISPER_SAMPLING_BEAM_SEARCH;
            p.beam_search.beam_size = beam;
        }
        p.initial_prompt = prompt.empty() ? nullptr : prompt.c_str();
        p.language = "ar";
        p.no_context = true;
        p.single_segment = false;

        auto t0 = std::chrono::steady_clock::now();
        int rc = audio.empty() ? 0 : whisper_full(ctx, p, audio.data(), static_cast<int>(audio.size()));
        auto t1 = std::chrono::steady_clock::now();
        std::string text;
        if (rc == 0 && !audio.empty()) {
            int n = whisper_full_n_segments(ctx);
            for (int i = 0; i < n; ++i) text += whisper_full_get_segment_text(ctx, i);
        }
        if (getenv("WHISPER_DRIVER_VERBOSE") != nullptr) {
            whisper_print_timings(ctx);
            whisper_reset_timings(ctx);
        }
        double ms = std::chrono::duration<double, std::milli>(t1 - t0).count();
        printf("{\"text\":\"%s\",\"ms\":%.1f,\"rc\":%d}\n", json_escape(text).c_str(), ms, rc);
        fflush(stdout);
    }
    whisper_free(ctx);
    return 0;
}
