#!/usr/bin/env bash
# Checks that a built app holds the voice model, byte for byte (docs/BUILD.md, « Le modèle de la
# voix »). The config plugin already stops `expo prebuild` without it; this is the proof on the
# app that is actually built, the one that goes to TestFlight.
#
# Usage: tools/ci/check-voice-model.sh path/to/App.app
set -euo pipefail

APP="${1:?usage: check-voice-model.sh path/to/App.app}"
MANIFEST="modules/voice-capture/voice-model.json"
FILE=$(node -p "require('./$MANIFEST').file")
BYTES=$(node -p "require('./$MANIFEST').bytes")
SHA=$(node -p "require('./$MANIFEST').sha256")
MODEL="$APP/$FILE"

if [ ! -f "$MODEL" ]; then
  echo "::error::The voice model $FILE is not in $APP: recognition would fail on the phone."
  exit 1
fi
ACTUAL_BYTES=$(wc -c < "$MODEL" | tr -d ' ')
if [ "$ACTUAL_BYTES" != "$BYTES" ]; then
  echo "::error::The voice model in the app has $ACTUAL_BYTES bytes, not $BYTES."
  exit 1
fi
ACTUAL_SHA=$(shasum -a 256 "$MODEL" | cut -d' ' -f1)
if [ "$ACTUAL_SHA" != "$SHA" ]; then
  echo "::error::The voice model in the app has SHA-256 $ACTUAL_SHA, not $SHA."
  exit 1
fi
echo "voice model in the app: $FILE, $ACTUAL_BYTES bytes, SHA-256 $ACTUAL_SHA"
