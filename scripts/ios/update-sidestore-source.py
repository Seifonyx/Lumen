#!/usr/bin/env python3
"""Synchronize Lumen's SideStore AltSource from an approved public GitHub release."""
import io
import json
import os
import plistlib
import re
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

SOURCE_PATH = Path('sidestore-source.json')
REPO = 'Seifonyx/Lumen'
BUNDLE_ID = 'io.github.seifonyx.lumen.demo'
SOURCE_URL = f'https://raw.githubusercontent.com/{REPO}/main/sidestore-source.json'
ICON_URL = f'https://raw.githubusercontent.com/{REPO}/main/public-canvas/icon-512.png'
APPROVAL_LINE = 'SideStore-public-IPA-reviewed: YES'
MAX_ZIP_BYTES = 150_000_000
MAX_UNPACKED_BYTES = 600_000_000

def fail(reason):
    raise SystemExit(f'SideStore source NOT changed: {reason}')

def get_release():
    token = os.environ.get('GH_TOKEN')
    tag = os.environ.get('LUMEN_RELEASE_TAG')
    if not token or not tag or not re.fullmatch(r'ios-v\d+\.\d+(?:\.\d+){0,2}', tag):
        fail('expected GH_TOKEN and ios-v<version> release tag')
    url = f'https://api.github.com/repos/{REPO}/releases/tags/{tag}'
    req = urllib.request.Request(url, headers={
        'Accept': 'application/vnd.github+json',
        'Authorization': 'Bearer ' + token,
        'User-Agent': 'Lumen-SideStore-release-verifier',
    })
    with urllib.request.urlopen(req, timeout=25) as response:
        release = json.load(response)
    if release.get('draft') or release.get('tag_name') != tag:
        fail('release is draft or does not match the requested tag')
    if APPROVAL_LINE not in (release.get('body') or '').splitlines():
        fail(f'release notes require a separate line: {APPROVAL_LINE}')
    if not (release.get('published_at') or '').startswith('20'):
        fail('release has no publish date')
    assets = [a for a in release.get('assets', []) if a.get('name') == 'Lumen.ipa']
    if len(assets) != 1:
        fail('release must have exactly one asset named Lumen.ipa')
    asset = assets[0]
    if asset.get('state') != 'uploaded' or not 0 < asset.get('size', 0) <= MAX_ZIP_BYTES:
        fail('IPA asset was not completely uploaded or exceeds the size limit')
    expected_url = f'https://github.com/{REPO}/releases/download/{tag}/Lumen.ipa'
    if asset.get('browser_download_url') != expected_url:
        fail('asset URL does not match the public GitHub Release URL')
    return release, asset

def read_public_ipa(asset):
    # Anonymous download is required for SideStore users without GitHub credentials.
    req = urllib.request.Request(asset['browser_download_url'], headers={
        'User-Agent': 'Lumen-SideStore-public-download-check'})
    with urllib.request.urlopen(req, timeout=90) as response:
        data = response.read(MAX_ZIP_BYTES + 1)
    if not data or len(data) > MAX_ZIP_BYTES or len(data) != asset['size']:
        fail('anonymous IPA download failed size verification')
    with zipfile.ZipFile(io.BytesIO(data), 'r') as zf:
        names = zf.namelist()
        if sum(i.file_size for i in zf.infolist()) > MAX_UNPACKED_BYTES:
            fail('archive has unexpectedly large uncompressed content')
        plists = [n for n in names if re.fullmatch(r'Payload/[^/]+\.app/Info\.plist', n)]
        if len(plists) != 1 or zf.testzip() is not None:
            fail('IPA has no single valid app bundle or failed ZIP integrity')
        if any(n.endswith('embedded.mobileprovision') or '/_CodeSignature/' in n for n in names):
            fail('IPA contains signing material; publish unsigned SideStore-ready IPA')
        if any(n.endswith(('.p8', '.p12', '.key')) or '/.env' in n for n in names):
            fail('IPA contains private key or environment file paths')
        # Defense in depth, not a replacement for human artifact-content review.
        suspect = (b'-----BEGIN PRIVATE KEY-----', b'sk-or-v1-', b'sk-proj-',
                   b'ghp_', b'gho_', b'github_pat_', b'AKIA')
        if any(any(marker in zf.read(item) for marker in suspect)
               for item in names if item.endswith(('.js', '.json', '.plist', '.html', '.txt', '.env'))):
            fail('IPA text resources contain a potential private credential')
        info = plistlib.loads(zf.read(plists[0]))
        if info.get('CFBundleIdentifier') != BUNDLE_ID:
            fail('bundle ID changed; existing SideStore installs must remain compatible')
        version, build = info.get('CFBundleShortVersionString'), info.get('CFBundleVersion')
        if not isinstance(version, str) or not re.fullmatch(r'\d+\.\d+(?:\.\d+){0,2}', version):
            fail('IPA marketing version is missing or invalid')
        if not isinstance(build, str) or not build:
            fail('IPA build version is missing')
        return version

def version_key(version):
    parts = [int(p) for p in version.split('.')]
    return tuple(parts + [0] * (4 - len(parts)))

def main():
    release, asset = get_release()
    version = read_public_ipa(asset)
    if release['tag_name'] != f'ios-v{version}':
        fail('release tag does not match actual IPA marketing version')
    if not SOURCE_PATH.exists():
        fail('source JSON missing from main checkout')
    source = json.loads(SOURCE_PATH.read_text())
    if source.get('identifier') != 'io.github.seifonyx.lumen.source' or source.get('sourceURL') != SOURCE_URL:
        fail('source identity changed unexpectedly')
    if len(source.get('apps', [])) > 1:
        fail('source unexpectedly lists more than one app')
    versions = source.get('apps', [{}])[0].get('versions', []) if source['apps'] else []
    if any(v['version'] != version and version_key(v['version']) >= version_key(version) for v in versions):
        fail('release version is not newer than the published version')
    v = {
        'version': version,
        'date': release['published_at'][:10],
        'downloadURL': asset['browser_download_url'],
        'size': asset['size'],
        'localizedDescription': (release.get('name') or f'Lumen {version}')[:180],
    }
    versions = [v] + [entry for entry in versions if entry.get('version') != version]
    versions.sort(key=lambda x: version_key(x['version']), reverse=True)
    source['apps'] = [{
        'name': 'Lumen',
        'bundleIdentifier': BUNDLE_ID,
        'developerName': 'Lumen',
        'subtitle': 'An independent AI workspace for iPhone',
        'localizedDescription': 'A native iPhone experience for Lumen. Chat, projects, models, and your connected workspace.',
        'iconURL': ICON_URL,
        'tintColor': '0b0b0c',
        'versions': versions,
    }]
    SOURCE_PATH.write_text(json.dumps(source, indent=2, ensure_ascii=False) + '\n')
    print(f'Verified public Lumen {version} ({asset["size"]} bytes); source updated.')

if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, OSError, zipfile.BadZipFile, urllib.error.URLError) as exc:
        fail(type(exc).__name__ + ': ' + str(exc)[:180])
