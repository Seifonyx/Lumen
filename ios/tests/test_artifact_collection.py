import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts' / 'collect_artifacts.py'


class ArtifactCollectionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / 'artifacts'
        self.destination = self.root / 'verified'
        self.sha = 'a' * 40
        self.checks = {
            'sync': ('firebaseSDKRoundtrip', 'unknownMetadataPreserved',
                     'existingMessageFieldsPreserved', 'webOrderingPreserved',
                     'attachmentRoundtrip', 'longHistoryPreserved', 'metadataRoundtrip'),
            'features': ('deletedContentCleaned', 'revisionVersionsPreserved', 'temporaryContentAbsent'),
        }
        self.counts = {'sync': 8, 'features': 8}
        for profile in ('compact', 'regular'):
            for shard in ('sync', 'features'):
                folder = self.source / f'native-ios-{self.sha}-{profile}-{shard}'
                (folder / f'screenshots/{profile}').mkdir(parents=True)
                (folder / f'screenshots/{profile}/capture-{shard}.png').write_bytes(b'capture')
                (folder / 'qa-devices.json').write_text(json.dumps([{
                    'profile': profile, 'shard': shard, 'id': f'{profile}-{shard}',
                    'runtime': '26.5',
                }]))
                (folder / 'logs').mkdir()
                checks = {name: True for name in self.checks[shard]}
                checks['uiTestCount'] = self.counts[shard]
                checks['uiTestNames'] = [f'test-{shard}-{i}' for i in range(self.counts[shard])]
                (folder / 'logs/connected-roundtrip.json').write_text(json.dumps(checks))
        release = self.source / f'native-ios-{self.sha}-release'
        (release / 'release').mkdir(parents=True)
        (release / 'logs').mkdir()
        (release / 'logs/device-build.log').write_text('archive succeeded')
        data = b'verified single device release'
        (release / 'release/Lumen.ipa').write_bytes(data)
        manifest = {'sourceCommit': self.sha, 'version': '0.3.4', 'build': '19',
                    'bundleIdentifier': 'io.github.seifonyx.lumen', 'minimumOSVersion': '26.0',
                    'architecture': 'arm64', 'platform': 'iPhoneOS',
                    'size': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
        (release / 'release/build-manifest.json').write_text(json.dumps(manifest))

    def collect(self):
        spec = importlib.util.spec_from_file_location('native_collect', SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        module.collect(self.source, self.destination, self.sha)

    def test_collects_four_independent_shards_and_one_release(self):
        self.collect()
        manifest = json.loads((self.destination / 'release/build-manifest.json').read_text())
        ipa = (self.destination / 'release/Lumen.ipa').read_bytes()
        self.assertEqual(hashlib.sha256(ipa).hexdigest(), manifest['sha256'])
        for profile in ('compact', 'regular'):
            for shard in ('sync', 'features'):
                self.assertTrue((self.destination / f'screenshots/{profile}/capture-{shard}.png').exists())
                self.assertTrue((self.destination / f'logs/{profile}/{shard}/connected-roundtrip.json').exists())
        self.assertEqual(len(json.loads((self.destination / 'qa-devices.json').read_text())), 4)

    def test_rejects_a_mismatched_source(self):
        path = self.source / f'native-ios-{self.sha}-release/release/build-manifest.json'
        manifest = json.loads(path.read_text())
        manifest['sourceCommit'] = 'b' * 40
        path.write_text(json.dumps(manifest))
        with self.assertRaises(ValueError):
            self.collect()

    def test_rejects_a_corrupted_ipa(self):
        (self.source / f'native-ios-{self.sha}-release/release/Lumen.ipa').write_bytes(b'changed')
        with self.assertRaises(ValueError):
            self.collect()

    def test_rejects_a_missing_ui_shard(self):
        import shutil
        shutil.rmtree(self.source / f'native-ios-{self.sha}-compact-sync')
        with self.assertRaisesRegex(ValueError, 'Missing verified'):
            self.collect()

    def test_rejects_missing_shard_specific_firebase_checks(self):
        path = self.source / f'native-ios-{self.sha}-regular-features/logs/connected-roundtrip.json'
        data = json.loads(path.read_text())
        data['deletedContentCleaned'] = False
        path.write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, 'Connected integration'):
            self.collect()

    def test_rejects_missing_ui_method_coverage(self):
        path = self.source / f'native-ios-{self.sha}-compact-sync/logs/connected-roundtrip.json'
        data = json.loads(path.read_text())
        data['uiTestNames'].pop()
        path.write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, 'Incomplete XCTest'):
            self.collect()

    def test_rejects_duplicate_simulator_provenance(self):
        path = self.source / f'native-ios-{self.sha}-regular-features/qa-devices.json'
        data = json.loads(path.read_text())
        data[0]['id'] = 'compact-sync'
        path.write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, 'its own simulator on its own runner'):
            self.collect()

    def test_accepts_the_same_preinstalled_simulator_on_different_runners(self):
        # Hosted Macs share one disk image, so the reused simulator UUID repeats across machines.
        for index, folder in enumerate(sorted(self.source.glob(f'native-ios-{self.sha}-*-*'))):
            path = folder / 'qa-devices.json'
            if not path.exists(): continue
            data = json.loads(path.read_text())
            data[0]['id'] = 'image-simulator'
            data[0]['runner'] = f'GitHub Actions {index}'
            path.write_text(json.dumps(data))
        self.collect()
