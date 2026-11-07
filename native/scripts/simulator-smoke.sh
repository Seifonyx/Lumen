#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
device=$(xcrun simctl list devices available -j | python3 -c '
import json,sys
devices=json.load(sys.stdin)["devices"]
print(next(d["udid"] for runtime,items in devices.items() if "iOS" in runtime for d in items if d["name"].startswith("iPhone")))
')
xcrun simctl boot "$device" || true
xcrun simctl bootstatus "$device" -b
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -sdk iphonesimulator -destination "id=$device" -derivedDataPath build/simulator \
  CODE_SIGNING_ALLOWED=NO IPHONEOS_DEPLOYMENT_TARGET=16.0 build > build-simulator.log 2>&1 || { tail -100 build-simulator.log; exit 1; }
xcrun simctl install "$device" build/simulator/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch "$device" io.github.seifonyx.lumen.demo --demo-smoke
container=$(xcrun simctl get_app_container "$device" io.github.seifonyx.lumen.demo data)
for attempt in $(seq 1 90); do
  if test -f "$container/Documents/native-smoke.json"; then break; fi
  sleep 2
done
mkdir -p artifacts/simulator
cp "$container/Documents/"*.png artifacts/simulator/ || true
cp "$container/Documents/native-smoke.json" artifacts/simulator/
python3 -c 'import json; r=json.load(open("artifacts/simulator/native-smoke.json")); print(r); assert r["passed"],r'
xcrun simctl io "$device" screenshot artifacts/simulator/simulator.png
xcrun simctl terminate "$device" io.github.seifonyx.lumen.demo
xcrun simctl shutdown "$device"
