#!/usr/bin/env python3
"""Verify both isolated iPhone jobs before selecting a matched release IPA/manifest pair."""
import argparse
import hashlib
import json
import shutil
from pathlib import Path

PROFILES = ('compact', 'regular')
CHECKS = ('firebaseSDKRoundtrip', 'deletedContentCleaned', 'unknownMetadataPreserved',
          'existingMessageFieldsPreserved', 'webOrderingPreserved', 'revisionVersionsPreserved', 'metadataRoundtrip')


def collect(source, destination, expected_commit):
    selected = {}
    manifests = {}
    devices = []
    for profile in PROFILES:
        folders = list(source.glob(f'native-ios-*-{profile}'))
        if len(folders) != 1:
            raise ValueError(f'Expected one verified {profile} artifact')
        folder = folders[0]
        manifest = json.loads((folder / 'release/build-manifest.json').read_text())
        ipa = folder / 'release/Lumen.ipa'
        if manifest['sourceCommit'] != expected_commit:
            raise ValueError('Artifact source does not match the publishing commit')
        if manifest['bundleIdentifier'] != 'io.github.seifonyx.lumen' or manifest['platform'] != 'iPhoneOS' or manifest['architecture'] != 'arm64':
            raise ValueError('Not a native Lumen iPhone artifact')
        if tuple(map(int, manifest['minimumOSVersion'].split('.'))) < (26, 0):
            raise ValueError('Invalid native deployment target')
        if ipa.stat().st_size != manifest['size'] or hashlib.sha256(ipa.read_bytes()).hexdigest() != manifest['sha256']:
            raise ValueError('IPA does not match its own build manifest')
        checks = json.loads((folder / 'logs/connected-roundtrip.json').read_text())
        if not all(checks.get(key) is True for key in CHECKS):
            raise ValueError(f'Connected checks did not pass for {profile}')
        if not list((folder / f'screenshots/{profile}').glob('*.png')):
            raise ValueError(f'Missing {profile} screenshots')
        inventory = json.loads((folder / 'qa-devices.json').read_text())
        if len(inventory) != 1 or inventory[0]['profile'] != profile:
            raise ValueError('Simulator provenance does not match the artifact')
        devices.extend(inventory)
        selected[profile] = folder
        manifests[profile] = manifest
    common = ('sourceCommit', 'version', 'build', 'bundleIdentifier', 'minimumOSVersion', 'architecture', 'platform')
    if any(manifests['compact'][key] != manifests['regular'][key] for key in common):
        raise ValueError('The iPhone jobs did not build the same release')
    destination.mkdir(parents=True, exist_ok=False)
    shutil.copytree(selected['compact'] / 'release', destination / 'release')
    for profile, folder in selected.items():
        shutil.copytree(folder / f'screenshots/{profile}', destination / f'screenshots/{profile}')
        shutil.copytree(folder / 'logs', destination / f'logs/{profile}')
    (destination / 'qa-devices.json').write_text(json.dumps(devices, indent=2) + '\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--artifacts', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--source-commit', required=True)
    args = parser.parse_args()
    collect(args.artifacts, args.output, args.source_commit)
    print('Verified both isolated iPhone artifacts and their connected checks')


if __name__ == '__main__':
    main()
