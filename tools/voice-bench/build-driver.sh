#!/usr/bin/env bash
# Builds whisper-driver from the whisper.cpp sources bundled in whisper.rn (the app's version).
# Usage: tools/voice-bench/build-driver.sh <output binary>
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
cpp="$here/../../node_modules/whisper.rn/cpp"
out="${1:-/tmp/whisper-driver}"
obj="${OBJ_DIR:-$(mktemp -d)}"; mkdir -p "$obj"
arch=x86
case "$(uname -m)" in aarch64|arm64) arch=arm ;; esac

flags=(-O3 -DNDEBUG -D_GNU_SOURCE -DWSP_GGML_USE_CPU -DWSP_GGML_USE_CPU_REPACK -pthread
  -march=native -I"$cpp" -I"$cpp/ggml-cpu" -I"$here/../../native/quran-decoding")
c_sources=(ggml.c ggml-alloc.c ggml-cpu/ggml-cpu.c ggml-cpu/quants.c ggml-quants.c
  "ggml-cpu/arch/$arch/quants.c")
cxx_sources=(ggml.cpp ggml-backend.cpp ggml-backend-meta.cpp ggml-backend-reg.cpp
  ggml-backend-dl.cpp ggml-cpu/amx/amx.cpp ggml-cpu/amx/mmq.cpp ggml-cpu/ggml-cpu.cpp
  ggml-cpu/traits.cpp ggml-cpu/repack.cpp ggml-cpu/unary-ops.cpp ggml-cpu/binary-ops.cpp
  ggml-cpu/vec.cpp ggml-cpu/ops.cpp ggml-opt.cpp ggml-threading.cpp gguf.cpp whisper.cpp
  "ggml-cpu/arch/$arch/repack.cpp" "ggml-cpu/arch/$arch/cpu-feats.cpp")

objects=()
for src in "${c_sources[@]}"; do
  o="$obj/$(echo "$src" | tr '/' '_').o"
  [ -f "$o" ] || gcc -std=c11 "${flags[@]}" -c "$cpp/$src" -o "$o" &
  objects+=("$o")
done
for src in "${cxx_sources[@]}"; do
  o="$obj/$(echo "$src" | tr '/' '_').o"
  [ -f "$o" ] || g++ -std=c++17 "${flags[@]}" -c "$cpp/$src" -o "$o" &
  objects+=("$o")
  # two compilers at a time
  while [ "$(jobs -r | wc -l)" -ge 2 ]; do sleep 0.5; done
done
wait
g++ -std=c++17 "${flags[@]}" "$here/whisper-driver.cpp" \
  "$here/../../native/quran-decoding/quran-decoding.cpp" "${objects[@]}" -o "$out"
[ -n "${OBJ_DIR:-}" ] || rm -rf "$obj"
echo "built $out"
