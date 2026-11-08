#!/usr/bin/env python3
"""Run real iPhone UI journeys and export their screenshot attachments."""
import json
import subprocess
from pathlib import Path


def output(*args):
    return subprocess.check_output(args, text=True)


def run(*args):
    subprocess.run(args, check=True)


def main():
    root = Path(__file__).resolve().parents[1]
    inventory = json.loads(output('xcrun', 'simctl', 'list', '--json'))
    runtimes = [r for r in inventory['runtimes']
                if r.get('isAvailable') and '.iOS-' in r['identifier']
                and int(r['version'].split('.')[0]) >= 26]
    if not runtimes:
        raise SystemExit('No available iOS 26 simulator runtime')
    runtime = max(runtimes, key=lambda r: tuple(int(x) for x in r['version'].split('.')))
    types = inventory['devicetypes']
    profiles = {
        'compact': ['iPhone SE (3rd generation)', 'iPhone 16e', 'iPhone 16'],
        'regular': ['iPhone 17 Pro', 'iPhone 17', 'iPhone 16 Pro'],
    }
    provenance = []
    failed = []
    for profile, candidates in profiles.items():
        device_type = next((t for name in candidates for t in types if t['name'] == name), None)
        if not device_type:
            raise SystemExit(f'No supported simulator device type for {profile}')
        device = output('xcrun', 'simctl', 'create', f'Lumen {profile}', device_type['identifier'], runtime['identifier']).strip()
        provenance.append({'profile': profile, 'device': device_type['name'], 'runtime': runtime['version'], 'id': device})
        (root / 'build' / 'qa-devices.json').write_text(json.dumps(provenance, indent=2) + '\n')
        result = root / 'build' / f'{profile}.xcresult'
        screenshots = root / 'build' / 'screenshots' / profile
        screenshots.mkdir(parents=True, exist_ok=True)
        try:
            run('xcrun', 'simctl', 'boot', device)
            run('xcrun', 'simctl', 'bootstatus', device, '-b')
            run('xcrun', 'simctl', 'status_bar', device, 'override', '--time', '9:41',
                '--dataNetwork', 'wifi', '--wifiMode', 'active', '--wifiBars', '3',
                '--batteryState', 'charged', '--batteryLevel', '100')
            log = root / 'build' / 'logs' / f'{profile}-tests.log'
            with log.open('w') as stream:
                test = subprocess.run([
                    'xcodebuild', 'test-without-building', '-project', str(root / 'Lumen.xcodeproj'),
                    '-scheme', 'Lumen', '-destination', f'id={device}',
                    '-derivedDataPath', str(root / 'build' / 'DerivedData'),
                    '-resultBundlePath', str(result), '-parallel-testing-enabled', 'NO',
                    'CODE_SIGNING_ALLOWED=YES', 'CODE_SIGNING_REQUIRED=NO', 'CODE_SIGN_IDENTITY=-',
                ], stdout=stream, stderr=subprocess.STDOUT)
            print(log.read_text()[-16000:], flush=True)
            if test.returncode:
                failed.append(profile)
        finally:
            if result.exists():
                run('xcrun', 'xcresulttool', 'export', 'attachments', '--path', str(result),
                    '--output-path', str(screenshots))
            subprocess.run(['xcrun', 'simctl', 'shutdown', device], check=False)
            subprocess.run(['xcrun', 'simctl', 'delete', device], check=False)
    if failed:
        raise SystemExit('UI journeys failed on: ' + ', '.join(failed))


if __name__ == '__main__':
    main()
