import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from reuse_pr_run import choose_run, code_changes  # noqa: E402


class ReusePullRequestRunTests(unittest.TestCase):
    def test_only_iphone_code_and_the_workflow_count_as_changes(self):
        self.assertEqual(code_changes(['src/App.tsx', 'HANDOFF.md', 'ios/sidestore-source.json', 'ios/README.md']), [])
        self.assertEqual(code_changes(['ios/Lumen/Views/ChatView.swift', 'iosx/file']), ['ios/Lumen/Views/ChatView.swift'])
        self.assertEqual(code_changes(['.github/workflows/ios-native.yml']), ['.github/workflows/ios-native.yml'])

    def test_reuses_the_newest_successful_pull_request_run_with_its_verified_build(self):
        runs = [
            {'id': 1, 'run_number': 10, 'event': 'pull_request', 'conclusion': 'success'},
            {'id': 2, 'run_number': 12, 'event': 'pull_request', 'conclusion': 'failure'},
            {'id': 3, 'run_number': 11, 'event': 'pull_request', 'conclusion': 'success'},
            {'id': 4, 'run_number': 13, 'event': 'push', 'conclusion': 'success'},
        ]
        artifacts = {
            1: [{'name': 'verified-native-ios-aaa'}],
            3: [{'name': 'verified-native-ios-bbb', 'expired': True}, {'name': 'native-build-bbb'}],
        }
        self.assertEqual(choose_run(runs, lambda i: artifacts.get(i, [])), (1, 'verified-native-ios-aaa'))
        self.assertIsNone(choose_run(runs[1:2], lambda i: []))


if __name__ == '__main__':
    unittest.main()
