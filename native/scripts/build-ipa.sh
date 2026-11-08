#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p artifacts
# First native Phase 0 update must be newer than the working SideStore v1.0 build.
# Override both values on later releases; never mutate the installed bundle identity.
LUMEN_IOS_VERSION="${LUMEN_IOS_VERSION:-1.1.0}"
LUMEN_IOS_BUILD="${LUMEN_IOS_BUILD:-2}"
[[ "$LUMEN_IOS_VERSION" =~ ^[0-9]+\.[0-9]+(\.[0-9]+)?$ ]] || { echo "Invalid marketing version"; exit 1; }
[[ "$LUMEN_IOS_BUILD" =~ ^[0-9]+$ ]] || { echo "Invalid build version"; exit 1; }
xcodebuild -version
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -sdk iphoneos -destination 'generic/platform=iOS' -derivedDataPath build/device \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY='' \
  IPHONEOS_DEPLOYMENT_TARGET=16.0 MARKETING_VERSION="$LUMEN_IOS_VERSION" CURRENT_PROJECT_VERSION="$LUMEN_IOS_BUILD" build > build-device.log 2>&1 || { tail -100 build-device.log; exit 1; }
mkdir -p artifacts/Payload
ditto build/device/Build/Products/Release-iphoneos/App.app artifacts/Payload/Lumen.app
(cd artifacts && ditto -c -k --sequesterRsrc --keepParent Payload Lumen.ipa)
python3 scripts/validate-ipa.py artifacts/Payload/Lumen.app artifacts/Lumen.ipa
echo "Unsigned iPhoneOS IPA ready. Sideloadly must sign it locally before installation."
