#!/usr/bin/env bash
# Chooses the Xcode of a GitHub Mac job and records what was chosen.
#
# The newest released Xcode installed on the machine is taken, betas and release candidates left
# aside. The choice is written to GITHUB_ENV as DEVELOPER_DIR, so every later step uses it.
set -euo pipefail

echo "Installed:"
ls -d /Applications/Xcode*.app

XCODE=$(ls -d /Applications/Xcode_[0-9]*.app 2>/dev/null | grep -viE 'beta|candidate|_rc' | sort -V | tail -1 || true)
if [ -z "$XCODE" ]; then
  echo "::error::No released Xcode found in /Applications"
  exit 1
fi

export DEVELOPER_DIR="$XCODE/Contents/Developer"
if [ -n "${GITHUB_ENV:-}" ]; then
  echo "DEVELOPER_DIR=$DEVELOPER_DIR" >> "$GITHUB_ENV"
fi

echo "Chosen: $XCODE"
xcodebuild -version
xcodebuild -showsdks | grep -i iphoneos
echo "node $(node --version), npm $(npm --version), CocoaPods $(pod --version)"
