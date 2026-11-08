#!/usr/bin/env python3
"""Publish the verified native IPA and update its separate SideStore feed."""
import argparse
import hashlib
import json
import os
import subprocess
import tempfile
from pathlib import Path


def gh(*args):
    return subprocess.check_output(['gh', *args], text=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--artifacts', type=Path, required=True)
    args = parser.parse_args()
    repository = os.environ['GITHUB_REPOSITORY']
    release_notes = json.loads(Path('ios/release-notes.json').read_text())
    ipa = args.artifacts / 'release' / 'Lumen.ipa'
    manifest_file = args.artifacts / 'release' / 'build-manifest.json'
    manifest = json.loads(manifest_file.read_text())
    if hashlib.sha256(ipa.read_bytes()).hexdigest() != manifest['sha256'] or ipa.stat().st_size != manifest['size']:
        raise SystemExit('Downloaded IPA does not match the verified build manifest')
    if manifest['bundleIdentifier'] != 'io.github.seifonyx.lumen' or manifest['platform'] != 'iPhoneOS':
        raise SystemExit('Not a native Lumen iPhone artifact')
    tag = 'native-ios-v' + manifest['version']
    existing = subprocess.run(['gh', 'release', 'view', tag, '--repo', repository],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if existing.returncode == 0:
        reference = json.loads(gh('api', f'repos/{repository}/git/ref/tags/{tag}'))
        if reference['object']['sha'] != manifest['sourceCommit']:
            raise SystemExit('This version was already published from another commit; bump MARKETING_VERSION')
    else:
        with tempfile.TemporaryDirectory() as temp:
            notes = Path(temp) / 'notes.md'
            notes.write_text(
                '\n\n'.join(release_notes['notes']) + '\n\n' +
                f'Source: `{manifest["sourceCommit"]}`\n'
                f'IPA SHA-256: `{manifest["sha256"]}`\n\n'
                'Install Lumen.ipa with SideStore. Simulator captures are in native-screenshots.zip.\n')
            screenshots_zip = args.artifacts / 'native-screenshots.zip'
            import shutil
            shutil.make_archive(str(screenshots_zip.with_suffix('')), 'zip', args.artifacts / 'screenshots')
            gh('release', 'create', tag, str(ipa), str(manifest_file), str(screenshots_zip),
               '--repo', repository, '--target', manifest['sourceCommit'],
               '--title', f'Lumen iOS {manifest["version"]} · {release_notes["title"]}',
               '--notes-file', str(notes), '--prerelease', '--latest=false')
    release = json.loads(gh('api', f'repos/{repository}/releases/tags/{tag}'))
    asset = next(a for a in release['assets'] if a['name'] == 'Lumen.ipa')
    if asset['size'] != manifest['size']:
        raise SystemExit('Published IPA size does not match the build')
    source_path = Path('ios/sidestore-source.json')
    source = json.loads(source_path.read_text())
    versions = source.get('apps', [{}])[0].get('versions', []) if source.get('apps') else []
    versions = [v for v in versions if v['version'] != manifest['version']]
    versions.append({
        'version': manifest['version'], 'date': release['published_at'][:10],
        'downloadURL': asset['browser_download_url'], 'size': asset['size'],
        'minOSVersion': manifest['minimumOSVersion'],
        'localizedDescription': release_notes['description'],
    })
    versions.sort(key=lambda v: tuple(int(p) for p in v['version'].split('.')), reverse=True)
    source['apps'] = [{
        'name': 'Lumen', 'bundleIdentifier': manifest['bundleIdentifier'], 'developerName': 'Lumen',
        'subtitle': 'Your native AI workspace',
        'localizedDescription': 'Native AI conversations with your Lumen account and your choice of provider.',
        'iconURL': f'https://raw.githubusercontent.com/{repository}/main/public-canvas/icon-512.png',
        'tintColor': '0b0b0c', 'versions': versions,
        'appPermissions': {'entitlements': [], 'privacy': {}},
    }]
    source_path.write_text(json.dumps(source, indent=2) + '\n')
    print(asset['browser_download_url'])


if __name__ == '__main__':
    main()
