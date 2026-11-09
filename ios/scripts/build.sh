#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build/logs build/release
defaults write com.apple.iphonesimulator ConnectHardwareKeyboard -bool false

xcodebuild -version
# A fresh iOS runtime finishes data migration while the device and simulator targets build.
simulator_prep_pid=""
if [[ -n "${LUMEN_QA_PROFILE:-}" ]]; then
  python3 scripts/prepare_simulator.py --profile "$LUMEN_QA_PROFILE" --output "build/prepared-$LUMEN_QA_PROFILE.json" > build/logs/simulator-preparation.log 2>&1 &
  simulator_prep_pid=$!
fi
trap 'if [[ -n "${simulator_prep_pid:-}" ]]; then kill "$simulator_prep_pid" 2>/dev/null || true; fi' EXIT
swift test --package-path LumenCore 2>&1 | tee build/logs/core-tests.log
xcodegen generate --spec project.yml

xcodebuild build-for-testing \
  -project Lumen.xcodeproj -scheme Lumen -configuration Debug \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  ARCHS="$(uname -m)" ONLY_ACTIVE_ARCH=YES \
  -derivedDataPath build/DerivedData \
  CODE_SIGNING_ALLOWED=YES CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY=- \
  CURRENT_PROJECT_VERSION="${IOS_BUILD_NUMBER:-1}" \
  2>&1 | tee build/logs/simulator-build.log

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

if [[ -n "$simulator_prep_pid" ]]; then
  wait "$simulator_prep_pid"
  simulator_prep_pid=""
fi
mkdir -p build/emulators
cp ../firestore.rules build/emulators/firestore.rules
cp tests/firebase.json build/emulators/firebase.json
npx --yes firebase-tools@15.33.0 emulators:exec --config build/emulators/firebase.json --project demo-lumen-native --only auth,firestore "python3 scripts/test_simulators.py"
