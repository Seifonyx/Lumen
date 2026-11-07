#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

# Compile-only verification of the native Google SDK bridge. This config is
# intentionally fictitious: no Firebase project, OAuth identity or user exists.
# Never run the app, make a sign-in attempt, enable inference or upload its IPA.
config="$(mktemp "${RUNNER_TEMP:-/tmp}/lumen-sdk-XXXXXX.json")"
trap 'rm -f "$config"' EXIT
cat > "$config" <<'JSON'
{
  "mode": "isolated-test",
  "projectId": "lumen-ios-test-synthetic",
  "projectNumber": "123456789012",
  "apiKey": "synthetic-not-a-google-key",
  "appId": "1:123456789012:web:abc123",
  "iosClientId": "123456789012-synthetic-ios.apps.googleusercontent.com",
  "webClientId": "123456789012-synthetic-web.apps.googleusercontent.com",
  "bundleId": "io.github.seifonyx.lumen.demo",
  "signedBundleId": "io.github.seifonyx.lumen.demo",
  "approvedTestEnvironment": true
}
JSON
export LUMEN_NATIVE_MODE=isolated-test LUMEN_NATIVE_SERVICE_CONFIG="$config"
node native/scripts/build.mjs
node native/scripts/prepare-ios.mjs
if ! xcodebuild -jobs 2 -project native/ios/App/App.xcodeproj -scheme App \
  -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath native/build/isolated-sdk \
  CODE_SIGNING_ALLOWED=NO IPHONEOS_DEPLOYMENT_TARGET=16.0 \
  build > native/build-isolated-sdk.log 2>&1; then
  tail -100 native/build-isolated-sdk.log
  exit 1
fi
echo "Native Google SDK bridge compiled with synthetic config; no real authentication, cloud project, provider traffic or device execution."
