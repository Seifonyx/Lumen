#!/usr/bin/env python3
"""Inspect a connected unsigned IPA *before encryption*, without printing its contents.

This is a fail-closed automated release safety gate, not permission to change
Firebase restrictions, account access, signing identity, or provider billing.
Public release still requires review of the exact candidate and source.
"""
import hashlib
import io
import json
import os
import pathlib
import plistlib
import re
import sys
import zipfile

BUNDLE = "io.github.seifonyx.lumen.demo"
MAX_ARCHIVE_BYTES = 150_000_000
MAX_UNCOMPRESSED_BYTES = 600_000_000
# Exact credential-like values. Do not reject plain Firebase client API keys:
# iOS client config is distributable; server-side restrictions still apply.
SECRET_PATTERNS = [
    re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    re.compile(rb"sk-or-v1-[A-Za-z0-9_-]{32,}"),
    re.compile(rb"sk-proj-[A-Za-z0-9_-]{32,}"),
    re.compile(rb"sk_live_[A-Za-z0-9]{20,}"),
    re.compile(rb"(?<![A-Za-z0-9_])ghp_[A-Za-z0-9]{36}(?![A-Za-z0-9])"),
    re.compile(rb"github_pat_[A-Za-z0-9_]{40,}"),
    re.compile(rb"(?<![A-Z0-9])AKIA[A-Z0-9]{16}(?![A-Z0-9])"),
    re.compile(rb"xox[baprs]-[0-9A-Za-z-]{20,}"),
]

def reject(message):
    raise ValueError(message)

def verify(ipa_bytes: bytes, expected_version: str = "1.1.0", approved_signed_bundle: str = BUNDLE) -> str:
    if not ipa_bytes or len(ipa_bytes) > MAX_ARCHIVE_BYTES:
        reject("IPA missing or unexpectedly large")
    with zipfile.ZipFile(io.BytesIO(ipa_bytes)) as ipa:
        names = ipa.namelist()
        if len(names) != len(set(names)):
            reject("duplicate archive member")
        total = sum(f.file_size for f in ipa.infolist())
        if total > MAX_UNCOMPRESSED_BYTES:
            reject("uncompressed archive over limit")
        if ipa.testzip() is not None:
            reject("corrupted IPA ZIP")
        plist_name = "Payload/Lumen.app/Info.plist"
        graph_name = "Payload/Lumen.app/public/demo-build.json"
        if plist_name not in names or graph_name not in names:
            reject("missing app metadata or connected build provenance")
        for name in names:
            if name.startswith("/") or ".." in pathlib.PurePosixPath(name).parts:
                reject("unsafe archive member")
            p = pathlib.PurePosixPath(name)
            parts = [x.lower() for x in p.parts]
            if any(x == ".env" or x.startswith(".env.") for x in parts):
                reject("environment file packaged")
            if p.suffix.lower() in {".p8", ".p12", ".pem", ".mobileprovision", ".key"}:
                reject("private signing or credential file packaged")
            if "_codesignature" in parts or "embedded.mobileprovision" in parts:
                reject("pre-signed app packaged instead of unsigned IPA")
            if "documents" in parts and name.startswith("Payload/Lumen.app/Documents/"):
                reject("user Documents mistakenly bundled")
            if "private-delivery" in parts or ".qa-build" in parts:
                reject("private QA or delivery data packaged")
            if name not in ("Payload/", "Payload/Lumen.app/") and not name.startswith(("Payload/Lumen.app/", "__MACOSX/")):
                reject("unexpected root in IPA")
            if name.endswith("/"):
                continue
            # Scan the real bytes, not just filenames and source code.
            content = ipa.read(name)
            if any(pattern.search(content) for pattern in SECRET_PATTERNS):
                reject("possible private credential embedded in IPA")
        info = plistlib.loads(ipa.read(plist_name))
        graph = json.loads(ipa.read(graph_name))
        if info.get("CFBundleIdentifier") != BUNDLE:
            reject("installed bundle identity mismatch")
        if info.get("CFBundleShortVersionString") != expected_version:
            reject("incorrect IPA version")
        if not re.fullmatch(r"[1-9][0-9]*", str(info.get("CFBundleVersion", ""))):
            reject("invalid IPA build number")
        if info.get("CFBundleDisplayName") != "Lumen":
            reject("unexpected app name")
        if info.get("CFBundleSupportedPlatforms") != ["iPhoneOS"]:
            reject("simulator-only app cannot ship as IPA")
        if graph.get("mode") != "account-connected" or graph.get("presentation") != "canvas":
            reject("synthetic/offline app is not an account-connected release")
        services = info.get("LumenTestServices", {})
        if services.get("mode") != "account-connected" or services.get("projectId") != "the-model-router":
            reject("wrong packaged Firebase account project")
        if services.get("bundleId") != BUNDLE or services.get("signedBundleId") != approved_signed_bundle:
            reject("Google sign-in identity mismatch with the approved SideStore signing configuration")
        if services.get("callbackScheme") not in [
            scheme for item in info.get("CFBundleURLTypes", [])
            for scheme in item.get("CFBundleURLSchemes", [])
        ]:
            reject("Google OAuth callback scheme missing")
        # Do not expose IDs, API keys or private package paths in logs.
    return hashlib.sha256(ipa_bytes).hexdigest()

def self_test():
    def sample(mode="account-connected", bundle=BUNDLE, extra_name=None, extra=b"ok"):
        mem = io.BytesIO()
        with zipfile.ZipFile(mem, "w") as z:
            z.writestr("Payload/Lumen.app/Info.plist", plistlib.dumps({
                "CFBundleIdentifier": bundle,
                "CFBundleShortVersionString": "1.1.0",
                "CFBundleVersion": "2",
                "CFBundleDisplayName": "Lumen",
                "CFBundleSupportedPlatforms": ["iPhoneOS"],
                "CFBundleURLTypes": [{"CFBundleURLSchemes": ["com.googleusercontent.apps.test"]}],
                "LumenTestServices": {"mode": "account-connected", "projectId": "the-model-router",
                                      "bundleId": BUNDLE, "signedBundleId": BUNDLE,
                                      "callbackScheme": "com.googleusercontent.apps.test"},
            }))
            z.writestr("Payload/Lumen.app/public/demo-build.json", json.dumps({"mode": mode, "presentation": "canvas"}))
            z.writestr(extra_name or "Payload/Lumen.app/public/assets/app.js", extra)
        return mem.getvalue()
    verify(sample())
    for case in (sample(mode="offline-demo"), sample(bundle="unexpected.app"),
                 sample(extra=b"sk-or-v1-" + b"Z" * 40),
                 sample(extra_name="Payload/Lumen.app/production.pem")):
        try:
            verify(case)
        except ValueError:
            continue
        reject("security negative control accepted")
    print("PASS IPA auditor self-test and four fail-closed negative controls")

if __name__ == "__main__":
    try:
        if sys.argv[1:] == ["--self-test"]:
            self_test()
        elif len(sys.argv) == 2:
            path = pathlib.Path(sys.argv[1])
            data = path.read_bytes()
            config_path = os.environ.get("LUMEN_NATIVE_SERVICE_CONFIG")
            if not config_path:
                reject("approved private native config is required")
            config = json.loads(pathlib.Path(config_path).read_text())
            if config.get("mode") != "account-connected" or config.get("bundleId") != BUNDLE:
                reject("incorrect approved build configuration")
            approved_signed = config.get("signedBundleId") or BUNDLE
            if not isinstance(approved_signed, str) or not re.fullmatch(r"(?:[A-Za-z0-9-]+\.)+[A-Za-z0-9-]+", approved_signed):
                reject("invalid approved signing identity")
            digest = verify(data, os.environ.get("LUMEN_IOS_VERSION", "1.1.0"), approved_signed)
            print(f"PASS connected IPA package audit: SHA256={digest}; no blocked secrets/paths; version and auth identity match")
        else:
            reject("expected IPA path or --self-test")
    except (ValueError, OSError, zipfile.BadZipFile, KeyError, json.JSONDecodeError) as e:
        # Error messages are constant-safe, no secret bytes or credential values.
        print("FAIL connected IPA package audit:", str(e))
        sys.exit(1)
