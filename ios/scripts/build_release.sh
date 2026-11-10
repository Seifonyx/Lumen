#!/bin/bash
# Build exactly one unsigned device IPA, while four independent simulator shards
# execute the complete UI/integration suite on separate macOS machines.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build/logs build/release
xcodebuild -version
xcodegen generate --spec project.yml

xcodebuild archive \
  -project Lumen.xcodeproj -scheme Lumen -configuration Release \
  -sdk iphoneos -destination 'generic/platform=iOS' \
  -derivedDataPath build/DerivedData \
  -archivePath build/Lumen.xcarchive \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY='' ARCHS=arm64 \
  CURRENT_PROJECT_VERSION="${IOS_BUILD_NUMBER:-1}" \
  2>&1 | tee build/logs/device-build.log

python3 scripts/package_ipa.py \
  --app build/Lumen.xcarchive/Products/Applications/Lumen.app \
  --output build/release/Lumen.ipa \
  --source-commit "${GITHUB_SHA:-$(git rev-parse HEAD)}"
