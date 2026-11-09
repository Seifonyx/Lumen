import json
import plistlib
import struct
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / 'scripts' / 'package_ipa.py'


class PackagingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.app = self.root / 'Lumen.app'
        self.app.mkdir()
        self.info = {
            'CFBundleIdentifier': 'io.github.seifonyx.lumen',
            'CFBundleExecutable': 'Lumen',
            'CFBundleDisplayName': 'Lumen',
            'CFBundleShortVersionString': '0.1.0',
            'CFBundleVersion': '17',
            'CFBundleSupportedPlatforms': ['iPhoneOS'],
            'MinimumOSVersion': '26.0',
        }
        self.write_info()
        self.write_binary()

    def write_info(self):
        (self.app / 'Info.plist').write_bytes(plistlib.dumps(self.info))

    def write_binary(self, platform=2, cpu=0x0100000C, minimum=26 << 16):
        header = struct.pack('<IiiIIIII', 0xFEEDFACF, cpu, 0, 2, 1, 24, 0, 0)
        command = struct.pack('<IIIIII', 0x32, 24, platform, minimum, 26 << 16, 0)
        executable = self.app / 'Lumen'
        executable.write_bytes(header + command)
        executable.chmod(0o755)

    def package(self):
        return subprocess.run([
            sys.executable, str(SCRIPT), '--app', str(self.app),
            '--output', str(self.root / 'output' / 'Lumen.ipa'),
            '--source-commit', 'a' * 40,
        ], capture_output=True, text=True)

    def test_rejects_simulator_auth_fixtures_in_release_binary(self):
        executable = self.app / 'Lumen'
        executable.write_bytes(executable.read_bytes() + b'--lumen-integration')
        result = self.package()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('test fixture', result.stderr)

    def test_packages_device_app_and_records_actual_metadata(self):
        result = self.package()
        self.assertEqual(result.returncode, 0, result.stderr)
        output = self.root / 'output'
        manifest = json.loads((output / 'build-manifest.json').read_text())
        self.assertEqual(manifest['bundleIdentifier'], 'io.github.seifonyx.lumen')
        self.assertEqual(manifest['version'], '0.1.0')
        self.assertEqual(manifest['build'], '17')
        self.assertEqual(manifest['minimumOSVersion'], '26.0')
        self.assertEqual(manifest['sourceCommit'], 'a' * 40)
        self.assertEqual(manifest['size'], (output / 'Lumen.ipa').stat().st_size)
        with zipfile.ZipFile(output / 'Lumen.ipa') as archive:
            self.assertEqual(archive.testzip(), None)
            self.assertIn('Payload/Lumen.app/Lumen', archive.namelist())
            self.assertTrue(archive.getinfo('Payload/Lumen.app/Lumen').external_attr >> 16 & 0o111)

    def test_rejects_simulator_binary_even_if_plist_says_iphone(self):
        self.write_binary(platform=7)
        result = self.package()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('device', result.stderr.lower())

    def test_rejects_intel_binary(self):
        self.write_binary(cpu=0x01000007)
        result = self.package()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('arm64', result.stderr.lower())

    def test_rejects_wrong_installed_identity(self):
        self.info['CFBundleIdentifier'] = 'io.github.seifonyx.lumen.demo'
        self.write_info()
        result = self.package()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('bundle', result.stderr.lower())

    def test_rejects_lower_deployment_target_in_binary(self):
        self.write_binary(minimum=25 << 16)
        result = self.package()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('26', result.stderr)

    def test_strips_signing_material_without_changing_the_archive(self):
        signatures = self.app / '_CodeSignature'
        signatures.mkdir()
        (signatures / 'CodeResources').write_text('fixture')
        (self.app / 'embedded.mobileprovision').write_text('fixture')
        result = self.package()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((self.app / 'embedded.mobileprovision').exists())
        with zipfile.ZipFile(self.root / 'output' / 'Lumen.ipa') as archive:
            self.assertFalse(any('_CodeSignature' in name or 'mobileprovision' in name
                                 for name in archive.namelist()))

    def test_rejects_private_key_resources(self):
        (self.app / 'signing.p12').write_bytes(b'fixture')
        result = self.package()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('private', result.stderr.lower())

    def test_rejects_executable_traversal(self):
        self.info['CFBundleExecutable'] = '../outside'
        self.write_info()
        result = self.package()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('executable', result.stderr.lower())


if __name__ == '__main__':
    unittest.main()
