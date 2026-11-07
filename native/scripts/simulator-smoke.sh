#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p artifacts/simulator
xcrun simctl list devices available -j > artifacts/simulator/devices.json
device=$(python3 -c '
import json,re
items=json.load(open("artifacts/simulator/devices.json"))["devices"]
runtimes=sorted((r for r in items if "iOS" in r),key=lambda r:tuple(map(int,re.findall(r"[0-9]+",r))),reverse=True)
print(next(d["udid"] for r in runtimes for d in items[r] if d["name"].startswith("iPhone")))
')
capture_debug() {
  xcrun simctl io "$device" screenshot artifacts/simulator/simulator.png || true
  xcrun simctl spawn "$device" log show --last 3m --style compact --predicate 'process == "App"' > artifacts/simulator/device.log 2>&1 || true
  xcrun simctl shutdown "$device" || true
}
trap capture_debug EXIT
xcodebuild -jobs 2 -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -sdk iphonesimulator -destination "id=$device" -derivedDataPath build/simulator \
  CODE_SIGNING_ALLOWED=NO IPHONEOS_DEPLOYMENT_TARGET=16.0 build > build-simulator.log 2>&1 || { tail -100 build-simulator.log; exit 1; }
open -a Simulator --args -CurrentDeviceUDID "$device"
xcrun simctl boot "$device" || true
python3 - "$device" <<'PY'
import subprocess,sys
subprocess.run(["xcrun","simctl","bootstatus",sys.argv[1],"-b"],timeout=240,check=True)
PY
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
xcrun simctl terminate "$device" io.github.seifonyx.lumen.demo
