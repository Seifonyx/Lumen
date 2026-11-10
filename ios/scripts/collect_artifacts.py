#!/usr/bin/env python3
"""Verify all 4 isolated iPhone UI shards and one exact-commit IPA before publication."""
import argparse
import hashlib
import json
import shutil
from pathlib import Path

PROFILES = ('compact', 'regular')
SHARDS = ('sync', 'features')
CHECKS_BY_SHARD = {
    'sync': ('firebaseSDKRoundtrip', 'unknownMetadataPreserved', 'existingMessageFieldsPreserved',
             'webOrderingPreserved', 'attachmentRoundtrip', 'longHistoryPreserved', 'metadataRoundtrip'),
    'features': ('deletedContentCleaned', 'revisionVersionsPreserved', 'temporaryContentAbsent'),
}
TEST_COUNTS = {'sync': 6, 'features': 8}


def collect(source, destination, expected_commit):
    selected = {}
    devices = []
    seen_device_ids = set()
    for profile in PROFILES:
        for shard in SHARDS:
            folder = source / f'native-ios-{expected_commit}-{profile}-{shard}'
            if not folder.is_dir():
                raise ValueError(f'Missing verified {profile}/{shard} artifact')
            checks = json.loads((folder / 'logs/connected-roundtrip.json').read_text())
            if not all(checks.get(key) is True for key in CHECKS_BY_SHARD[shard]):
                raise ValueError(f'Connected integration checks failed on {profile}/{shard}')
            if checks.get('uiTestCount') != TEST_COUNTS[shard] or len(set(checks.get('uiTestNames', []))) != TEST_COUNTS[shard]:
                raise ValueError(f'Incomplete XCTest coverage on {profile}/{shard}')
            if not list((folder / f'screenshots/{profile}').glob('*.png')):
                raise ValueError(f'Missing {profile}/{shard} simulator screenshots')
            inventory = json.loads((folder / 'qa-devices.json').read_text())
            if len(inventory) != 1 or inventory[0]['profile'] != profile or inventory[0].get('shard') != shard:
                raise ValueError(f'Simulator provenance does not match {profile}/{shard}')
            device_id = inventory[0].get('id')
            if not device_id or device_id in seen_device_ids:
                raise ValueError('Each isolated simulator shard needs a distinct physical simulator UUID')
            seen_device_ids.add(device_id)
            devices.extend(inventory)
            selected[profile, shard] = folder

    # Archive only once, concurrently with the independently seeded simulator runs.
    # A missing shard or missing/incorrect checks cannot be concealed by a good IPA.
    release = source / f'native-ios-{expected_commit}-release' / 'release'
    manifest = json.loads((release / 'build-manifest.json').read_text())
    ipa = release / 'Lumen.ipa'
    if manifest['sourceCommit'] != expected_commit:
        raise ValueError('Artifact source does not match the publishing commit')
    if manifest['bundleIdentifier'] != 'io.github.seifonyx.lumen' or manifest['platform'] != 'iPhoneOS' or manifest['architecture'] != 'arm64':
        raise ValueError('Not a native Lumen iPhone artifact')
    if tuple(map(int, manifest['minimumOSVersion'].split('.'))) < (26, 0):
        raise ValueError('Invalid native deployment target')
    if ipa.stat().st_size != manifest['size'] or hashlib.sha256(ipa.read_bytes()).hexdigest() != manifest['sha256']:
        raise ValueError('IPA does not match its own build manifest')
    destination.mkdir(parents=True, exist_ok=False)
    shutil.copytree(release, destination / 'release')
    for (profile, shard), folder in selected.items():
        shutil.copytree(folder / f'screenshots/{profile}', destination / f'screenshots/{profile}', dirs_exist_ok=True)
        shutil.copytree(folder / 'logs', destination / f'logs/{profile}/{shard}')
    shutil.copytree(source / f'native-ios-{expected_commit}-release' / 'logs', destination / 'logs/release')
    (destination / 'qa-devices.json').write_text(json.dumps(devices, indent=2) + '\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--artifacts', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--source-commit', required=True)
    args = parser.parse_args()
    collect(args.artifacts, args.output, args.source_commit)
    print('Verified both iPhone sizes, all four isolated UI shards, Swift and exact-commit IPA')


if __name__ == '__main__':
    main()
