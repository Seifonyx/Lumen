import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / 'scripts' / 'save_source.py'


class SourceCommitTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.remote = self.root / 'origin.git'
        self.publisher = self.root / 'publisher'
        self.writer = self.root / 'writer'
        self.git(self.root, 'init', '--bare', '--initial-branch=main', str(self.remote))
        self.git(self.root, 'clone', str(self.remote), str(self.publisher))
        self.configure(self.publisher)
        (self.publisher / 'ios').mkdir()
        (self.publisher / 'ios/sidestore-source.json').write_text('{"version": "initial"}\n')
        self.git(self.publisher, 'add', '.')
        self.git(self.publisher, 'commit', '-m', 'Initial source')
        self.git(self.publisher, 'push', 'origin', 'main')
        self.git(self.root, 'clone', str(self.remote), str(self.writer))
        self.configure(self.writer)

    def git(self, directory, *args):
        return subprocess.check_output(['git', *args], cwd=directory, stderr=subprocess.DEVNULL, text=True).strip()

    def configure(self, directory):
        self.git(directory, 'config', 'user.name', 'Source test')
        self.git(directory, 'config', 'user.email', 'source-test@local.invalid')

    def save(self):
        return subprocess.run([sys.executable, str(SCRIPT)], cwd=self.publisher, capture_output=True, text=True)

    def test_preserves_concurrent_main_change_and_publishes_feed(self):
        (self.publisher / 'ios/sidestore-source.json').write_text('{"version": "0.1.0"}\n')
        (self.writer / 'web.txt').write_text('Concurrent web change\n')
        self.git(self.writer, 'add', '.')
        self.git(self.writer, 'commit', '-m', 'Concurrent main update')
        self.git(self.writer, 'push', 'origin', 'main')
        result = self.save()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.git(self.remote, 'show', 'main:ios/sidestore-source.json'), '{"version": "0.1.0"}')
        self.assertEqual(self.git(self.remote, 'show', 'main:web.txt'), 'Concurrent web change')

    def test_unchanged_feed_does_not_create_a_commit(self):
        before = self.git(self.publisher, 'rev-parse', 'HEAD')
        result = self.save()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.git(self.publisher, 'rev-parse', 'HEAD'), before)

    def test_conflicting_feed_change_is_not_overwritten(self):
        (self.publisher / 'ios/sidestore-source.json').write_text('{"version": "0.1.0"}\n')
        (self.writer / 'ios/sidestore-source.json').write_text('{"version": "0.2.0"}\n')
        self.git(self.writer, 'add', '.')
        self.git(self.writer, 'commit', '-m', 'Another source update')
        self.git(self.writer, 'push', 'origin', 'main')
        result = self.save()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('conflict', result.stderr.lower())
        self.assertEqual(self.git(self.remote, 'show', 'main:ios/sidestore-source.json'), '{"version": "0.2.0"}')


if __name__ == '__main__':
    unittest.main()
