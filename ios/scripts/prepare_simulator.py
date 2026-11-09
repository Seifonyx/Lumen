#!/usr/bin/env python3
"""Boot the selected QA iPhone while the native targets compile."""
import argparse
import json
import os
import subprocess
from pathlib import Path

PROFILES = {
    'compact': ['iPhone SE (3rd generation)', 'iPhone 16e', 'iPhone 16'],
    'regular': ['iPhone 17 Pro', 'iPhone 17', 'iPhone 16 Pro'],
}


def select_device(inventory, profile):
    if profile not in PROFILES:
        raise ValueError('Unknown iPhone QA profile')
    runtimes = [r for r in inventory['runtimes'] if r.get('isAvailable') and '.iOS-' in r['identifier']
                and int(r['version'].split('.')[0]) >= 26]
    if not runtimes:
        raise ValueError('No available iOS26 runtime')
    runtime = max(runtimes, key=lambda r: tuple(int(x) for x in r['version'].split('.')))
    device = next((t for name in PROFILES[profile] for t in inventory['devicetypes'] if t['name'] == name), None)
    if not device:
        raise ValueError('No supported iPhone device type')
    return runtime, device


def existing_hosted_device(inventory, runtime, device_type):
    """Reuse a matching, available preinstalled device on ephemeral GitHub runners.

    Never touch local developers' own simulators. An already booted runner image
    skips the expensive fresh-device migration; shutdown images still boot normally.
    """
    if os.environ.get('GITHUB_ACTIONS') != 'true':
        return None
    devices = inventory.get('devices', {}).get(runtime['identifier'], [])
    matches = [d for d in devices if d.get('isAvailable') is True
               and d.get('deviceTypeIdentifier') == device_type['identifier']
               and d.get('state') in {'Booted', 'Shutdown'}]
    return sorted(matches, key=lambda d: d['state'] != 'Booted')[0] if matches else None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--profile', required=True, choices=PROFILES)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    # A failed preparation must not leave yesterday's simulator UUID as valid input.
    args.output.unlink(missing_ok=True)
    inventory = json.loads(subprocess.check_output(['xcrun', 'simctl', 'list', '--json'], text=True))
    runtime, device = select_device(inventory, args.profile)
    existing = existing_hosted_device(inventory, runtime, device)
    identifier = (existing['udid'] if existing else
                  subprocess.check_output(['xcrun', 'simctl', 'create', f'Lumen {args.profile}',
                                           device['identifier'], runtime['identifier']], text=True).strip())
    if not existing or existing['state'] != 'Booted':
        subprocess.run(['xcrun', 'simctl', 'boot', identifier], check=True, timeout=300)
    subprocess.run(['xcrun', 'simctl', 'bootstatus', identifier, '-b'], check=True, timeout=600)
    args.output.write_text(json.dumps({'profile': args.profile, 'device': device['name'], 'runtime': runtime['version'],
                                     'runtimeIdentifier': runtime['identifier'], 'id': identifier,
                                     'reusedHostedDevice': bool(existing)}) + '\n')


if __name__ == '__main__':
    main()
