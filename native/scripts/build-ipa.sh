#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p artifacts
xcodebuild -version
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -sdk iphoneos -destination 'generic/platform=iOS' -derivedDataPath build/device \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY='' \
  IPHONEOS_DEPLOYMENT_TARGET=16.0 build > build-device.log 2>&1 || { tail -100 build-device.log; exit 1; }
mkdir -p artifacts/Payload
ditto build/device/Build/Products/Release-iphoneos/App.app artifacts/Payload/Lumen.app
(cd artifacts && ditto -c -k --sequesterRsrc --keepParent Payload Lumen.ipa)
python3 scripts/validate-ipa.py artifacts/Payload/Lumen.app artifacts/Lumen.ipa
echo "Unsigned iPhoneOS IPA ready. Sideloadly must sign it locally before installation."
