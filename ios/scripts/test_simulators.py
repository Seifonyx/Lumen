#!/usr/bin/env python3
"""Run real iPhone UI journeys and export their screenshot attachments."""
import json
import os
import shutil
import subprocess
from pathlib import Path


def output(*args):
    return subprocess.check_output(args, text=True)


def run(*args, timeout=300):
    print("Running: " + " ".join(map(str, args)), flush=True)
    subprocess.run(args, check=True, timeout=timeout)


def main():
    from native_test_server import start, seed
    server = start()
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
    requested = os.environ.get('LUMEN_QA_PROFILE')
    if requested:
        if requested not in profiles: raise SystemExit('Unknown iPhone QA profile')
        profiles = {requested: profiles[requested]}
    provenance = []
    failed = []
    for profile, candidates in profiles.items():
        seed()
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
            run('xcrun', 'simctl', 'bootstatus', device, '-b', timeout=600)
            run('xcrun', 'simctl', 'status_bar', device, 'override', '--time', '9:41',
                '--dataNetwork', 'wifi', '--wifiMode', 'active', '--wifiBars', '3',
                '--batteryState', 'charged', '--batteryLevel', '100')
            log = root / 'build' / 'logs' / f'{profile}-tests.log'
            # Warm the app's dyld/SDK startup once before XCTest attaches to a fresh simulator.
            app = root / 'build/DerivedData/Build/Products/Debug-iphonesimulator/Lumen.app'
            run('xcrun', 'simctl', 'install', device, str(app))
            run('xcrun', 'simctl', 'launch', device, 'io.github.seifonyx.lumen', '--lumen-integration', '--lumen-reset-qa', timeout=300)
            subprocess.run(['xcrun', 'simctl', 'terminate', device, 'io.github.seifonyx.lumen'], check=False, timeout=30)
            with log.open('w') as stream:
                test = subprocess.run([
                    'xcodebuild', 'test-without-building', '-project', str(root / 'Lumen.xcodeproj'),
                    '-scheme', 'Lumen', '-destination', f'id={device}',
                    '-derivedDataPath', str(root / 'build' / 'DerivedData'),
                    '-resultBundlePath', str(result), '-parallel-testing-enabled', 'NO',
                    '-test-timeouts-enabled', 'YES', '-default-test-execution-time-allowance', '120',
                    '-maximum-test-execution-time-allowance', '600',
                    'CODE_SIGNING_ALLOWED=YES', 'CODE_SIGNING_REQUIRED=NO', 'CODE_SIGN_IDENTITY=-',
                ], stdout=stream, stderr=subprocess.STDOUT, timeout=2000)
            print(log.read_text()[-16000:], flush=True)
            if test.returncode:
                failed.append(profile)
        except subprocess.TimeoutExpired as error:
            failed.append(profile)
            print(f'{profile} timed out after {error.timeout}s: {error.cmd}', flush=True)
        finally:
            try:
                container = output('xcrun', 'simctl', 'get_app_container', device, 'io.github.seifonyx.lumen', 'data').strip()
                traces = list(Path(container).rglob('IntegrationDiagnostics.json'))
                if traces: shutil.copyfile(traces[0], root / 'build/logs' / f'{profile}-fixture-diagnostics.json')
            except (subprocess.CalledProcessError, OSError): pass
            with (root / 'build/logs' / f'{profile}-fixture-console.log').open('w') as console:
                subprocess.run(['xcrun', 'simctl', 'spawn', device, 'log', 'show', '--last', '30m', '--info',
                                '--style', 'compact', '--predicate', 'subsystem == "io.github.seifonyx.lumen.qa"'],
                               stdout=console, stderr=subprocess.STDOUT, check=False, timeout=60)
            if result.exists():
                subprocess.run(['xcrun', 'xcresulttool', 'export', 'attachments', '--path', str(result),
                                '--output-path', str(screenshots)], check=False, timeout=180)
            subprocess.run(['xcrun', 'simctl', 'shutdown', device], check=False)
            subprocess.run(['xcrun', 'simctl', 'delete', device], check=False)
    if not failed:
        from native_test_server import verify_roundtrip
        checks = verify_roundtrip()
        (root / 'build' / 'logs' / 'connected-roundtrip.json').write_text(json.dumps(checks, indent=2) + '\n')
        print(json.dumps(checks), flush=True)
    server.shutdown()
    if failed:
        raise SystemExit('UI journeys failed on: ' + ', '.join(failed))


if __name__ == '__main__':
    main()
