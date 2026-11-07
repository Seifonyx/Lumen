#!/usr/bin/env python3
"""Validate a genuine unsigned device app before packaging. macOS/Xcode only."""
import hashlib
import json
import pathlib
import plistlib
import subprocess
import sys
import zipfile

app = pathlib.Path(sys.argv[1]).resolve()
ipa = pathlib.Path(sys.argv[2]).resolve()
with (app / "Info.plist").open("rb") as handle:
    info = plistlib.load(handle)
assert info["CFBundleIdentifier"] == "io.github.seifonyx.lumen.demo"
assert info["CFBundleSupportedPlatforms"] == ["iPhoneOS"], "Simulator build refused"
assert info["DTPlatformName"] == "iphoneos"
binary = app / info["CFBundleExecutable"]
arch = subprocess.check_output(["lipo", "-archs", str(binary)], text=True).strip()
assert arch == "arm64", arch
platform = subprocess.check_output(["xcrun", "vtool", "-show-build", str(binary)], text=True)
assert "platform IOS" in platform and "IOSSIMULATOR" not in platform
assert not list(app.rglob("embedded.mobileprovision"))
assert not list(app.rglob("*.p12"))
assert not (app / "_CodeSignature").exists(), "App must be unsigned"
assert (app / "public/index.html").is_file()
assert not (app / "public/sw.js").exists()
assert list((app / "public/assets").glob("*.woff2")), "Bundled fonts missing"
assert list((app / "public/assets").glob("RoutingCenter-*.js")), "Lazy Canvas screens missing"
with zipfile.ZipFile(ipa) as archive:
    assert "Payload/Lumen.app/Info.plist" in archive.namelist()
    assert all(n.startswith("Payload/") or n.startswith("__MACOSX/") for n in archive.namelist())
metadata = dict(bundle=info["CFBundleIdentifier"], displayName=info["CFBundleDisplayName"],
                platform=info["DTPlatformName"], architecture=arch, minimumIOS=info["MinimumOSVersion"],
                signed=False, bytes=ipa.stat().st_size, sha256=hashlib.sha256(ipa.read_bytes()).hexdigest())
ipa.with_suffix(".json").write_text(json.dumps(metadata, indent=2))
print(json.dumps(metadata, indent=2))
