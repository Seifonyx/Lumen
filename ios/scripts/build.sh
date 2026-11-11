#!/bin/bash
# Simulator build and UI journeys. CI splits this in two so the app compiles once per commit:
#   LUMEN_BUILD_ONLY=1  build for testing and stop (the build job; its products are shared with every shard)
#   LUMEN_SKIP_BUILD=1  use products already in build/DerivedData/Build/Products and only run the tests
# With neither set (a developer's Mac), it builds and runs everything, as before.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build/logs build/release
defaults write com.apple.iphonesimulator ConnectHardwareKeyboard -bool false

xcodebuild -version
# A fresh iOS runtime finishes data migration while the app builds (or while CI downloads the build).
simulator_prep_pid=""
if [[ -n "${LUMEN_QA_PROFILE:-}" && -z "${LUMEN_BUILD_ONLY:-}" ]]; then
  if [[ -f build/prep.pid ]]; then
    # Started by an earlier CI step, so the simulator boots while the build is downloaded.
    simulator_prep_pid="$(cat build/prep.pid)"
  else
    # Do not let an archived build directory supply a deleted simulator's UUID.
    rm -f "build/prepared-$LUMEN_QA_PROFILE.json"
    python3 scripts/prepare_simulator.py --profile "$LUMEN_QA_PROFILE" --output "build/prepared-$LUMEN_QA_PROFILE.json" > build/logs/simulator-preparation.log 2>&1 &
    simulator_prep_pid=$!
  fi
fi
cleanup() {
  if [[ -n "${simulator_prep_pid:-}" ]]; then kill "$simulator_prep_pid" 2>/dev/null || true; fi
}
trap cleanup EXIT
# Swift core tests run concurrently on Linux in the dedicated, required CI job.
# Avoid compiling them twice on the expensive macOS simulator runners.
xcodegen generate --spec project.yml

if [[ -z "${LUMEN_SKIP_BUILD:-}" ]]; then
  xcodebuild build-for-testing \
    -project Lumen.xcodeproj -scheme Lumen -configuration Debug \
    -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
    ARCHS="$(uname -m)" ONLY_ACTIVE_ARCH=YES \
    -derivedDataPath build/DerivedData \
    CODE_SIGNING_ALLOWED=YES CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY=- \
    CURRENT_PROJECT_VERSION="${IOS_BUILD_NUMBER:-1}" \
    2>&1 | tee build/logs/simulator-build.log
fi
if [[ -n "${LUMEN_BUILD_ONLY:-}" ]]; then exit 0; fi
test -d build/DerivedData/Build/Products/Debug-iphonesimulator/Lumen.app

if [[ -n "$simulator_prep_pid" ]]; then
  # (A process started by another step is not this shell's child, so poll it rather than wait.)
  while kill -0 "$simulator_prep_pid" 2>/dev/null; do sleep 1; done
  simulator_prep_pid=""
fi
mkdir -p build/emulators
cp ../firestore.rules build/emulators/firestore.rules
cp tests/firebase.json build/emulators/firebase.json
ui_status=0
npx --yes firebase-tools@15.33.0 emulators:exec --config build/emulators/firebase.json --project demo-lumen-native --only auth,firestore "python3 scripts/test_simulators.py" || ui_status=$?
if (( ui_status != 0 )); then exit "$ui_status"; fi
