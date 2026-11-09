#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build/logs build/release
defaults write com.apple.iphonesimulator ConnectHardwareKeyboard -bool false

xcodebuild -version
# A fresh iOS runtime finishes data migration while the device and simulator targets build.
simulator_prep_pid=""
archive_pid=""
if [[ -n "${LUMEN_QA_PROFILE:-}" ]]; then
  # Do not let an archived build directory supply a deleted simulator's UUID.
  rm -f "build/prepared-$LUMEN_QA_PROFILE.json"
  python3 scripts/prepare_simulator.py --profile "$LUMEN_QA_PROFILE" --output "build/prepared-$LUMEN_QA_PROFILE.json" > build/logs/simulator-preparation.log 2>&1 &
  simulator_prep_pid=$!
fi
cleanup() {
  if [[ -n "${simulator_prep_pid:-}" ]]; then kill "$simulator_prep_pid" 2>/dev/null || true; fi
  if [[ -n "${archive_pid:-}" ]]; then kill "$archive_pid" 2>/dev/null || true; fi
}
trap cleanup EXIT
# Swift core tests run concurrently on Linux in the dedicated, required CI job.
# Avoid compiling them twice on the two expensive macOS simulator runners.
xcodegen generate --spec project.yml

xcodebuild build-for-testing \
  -project Lumen.xcodeproj -scheme Lumen -configuration Debug \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  ARCHS="$(uname -m)" ONLY_ACTIVE_ARCH=YES \
  -derivedDataPath build/DerivedData \
  CODE_SIGNING_ALLOWED=YES CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY=- \
  CURRENT_PROJECT_VERSION="${IOS_BUILD_NUMBER:-1}" \
  2>&1 | tee build/logs/simulator-build.log

# Only the regular profile produces the identical-source device IPA. Both profiles
# still run the full iPhone UI suite and real Firebase emulator checks. Archive uses
# Xcode's default DerivedData, separate from the simulator build's DerivedData.
# Overlap this independent device archive with the long XCTest journey.
build_release() {
  xcodebuild archive \
    -project Lumen.xcodeproj -scheme Lumen -configuration Release \
    -sdk iphoneos -destination 'generic/platform=iOS' \
    -archivePath build/Lumen.xcarchive \
    CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY='' ARCHS=arm64 \
    CURRENT_PROJECT_VERSION="${IOS_BUILD_NUMBER:-1}" \
    2>&1 | tee build/logs/device-build.log
  python3 scripts/package_ipa.py \
    --app build/Lumen.xcarchive/Products/Applications/Lumen.app \
    --output build/release/Lumen.ipa \
    --source-commit "${GITHUB_SHA:-$(git rev-parse HEAD)}"
}
if [[ "${LUMEN_QA_PROFILE:-}" == "regular" ]]; then
  build_release > build/logs/release-build.log 2>&1 &
  archive_pid=$!
fi

if [[ -n "$simulator_prep_pid" ]]; then
  wait "$simulator_prep_pid"
  simulator_prep_pid=""
fi
mkdir -p build/emulators
cp ../firestore.rules build/emulators/firestore.rules
cp tests/firebase.json build/emulators/firebase.json
ui_status=0
npx --yes firebase-tools@15.33.0 emulators:exec --config build/emulators/firebase.json --project demo-lumen-native --only auth,firestore "python3 scripts/test_simulators.py" || ui_status=$?
archive_status=0
if [[ -n "$archive_pid" ]]; then
  wait "$archive_pid" || archive_status=$?
  archive_pid=""
  if (( archive_status != 0 )); then
    echo "Device archive or IPA packaging failed; see build/logs/release-build.log"
    cat build/logs/release-build.log | tail -80
  fi
fi
if (( ui_status != 0 )); then exit "$ui_status"; fi
if (( archive_status != 0 )); then exit "$archive_status"; fi
