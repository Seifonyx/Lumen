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
        for profile in ['compact', 'regular']:
            folder = self.source / f'native-ios-{self.sha}-{profile}'
            (folder / 'release').mkdir(parents=True)
            data = ('verified-' + profile).encode()
            (folder / 'release/Lumen.ipa').write_bytes(data)
            manifest = {'sourceCommit': self.sha, 'version': '0.2.0', 'build': '19',
                        'bundleIdentifier': 'io.github.seifonyx.lumen', 'minimumOSVersion': '26.0',
                        'architecture': 'arm64', 'platform': 'iPhoneOS',
                        'size': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
            (folder / 'release/build-manifest.json').write_text(json.dumps(manifest))
            (folder / f'screenshots/{profile}').mkdir(parents=True)
            (folder / f'screenshots/{profile}/capture.png').write_bytes(b'capture')
            (folder / 'qa-devices.json').write_text(json.dumps([{'profile': profile, 'runtime': '26.5'}]))
            (folder / 'logs').mkdir()
            (folder / 'logs/connected-roundtrip.json').write_text(json.dumps({
                'firebaseSDKRoundtrip': True, 'deletedContentCleaned': True, 'unknownMetadataPreserved': True,
                'existingMessageFieldsPreserved': True, 'webOrderingPreserved': True, 'revisionVersionsPreserved': True, 'attachmentRoundtrip': True, 'temporaryContentAbsent': True, 'metadataRoundtrip': True}))

    def collect(self):
        spec = importlib.util.spec_from_file_location('native_collect', SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        module.collect(self.source, self.destination, self.sha)

    def test_collects_matching_profiles_without_mixing_their_ipa_and_manifest(self):
        self.collect()
        manifest = json.loads((self.destination / 'release/build-manifest.json').read_text())
        self.assertEqual(hashlib.sha256((self.destination / 'release/Lumen.ipa').read_bytes()).hexdigest(), manifest['sha256'])
        self.assertTrue((self.destination / 'screenshots/compact/capture.png').exists())
        self.assertTrue((self.destination / 'screenshots/regular/capture.png').exists())
        self.assertEqual(len(json.loads((self.destination / 'qa-devices.json').read_text())), 2)

    def test_rejects_a_mismatched_source(self):
        path = self.source / f'native-ios-{self.sha}-regular/release/build-manifest.json'
        manifest = json.loads(path.read_text()); manifest['sourceCommit'] = 'b' * 40
        path.write_text(json.dumps(manifest))
        with self.assertRaises(ValueError): self.collect()

    def test_rejects_a_corrupted_ipa(self):
        (self.source / f'native-ios-{self.sha}-compact/release/Lumen.ipa').write_bytes(b'changed')
        with self.assertRaises(ValueError): self.collect()

    def test_rejects_missing_connected_checks(self):
        (self.source / f'native-ios-{self.sha}-regular/logs/connected-roundtrip.json').unlink()
        with self.assertRaises((ValueError, FileNotFoundError)): self.collect()
