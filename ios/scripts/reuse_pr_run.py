#!/usr/bin/env python3
"""On a push to main: find the pull request run that already verified exactly this iPhone code.

A merge commit whose ios/ folder and native workflow are identical to the pull request's head was built and tested,
on both iPhone sizes, by that pull request's run. Publishing that verified build instead of rebuilding saves the
whole simulator suite on every release. Prints `run=<id>` for GitHub's step outputs when a run can be reused, and
nothing otherwise (main then runs everything, as before).
"""
import argparse
import json
import os
import subprocess

WATCHED = ('ios', '.github/workflows/ios-native.yml')
# Changed on main by the publish job itself, and not part of the app.
IGNORED = ('ios/sidestore-source.json', 'ios/README.md')


def git(*args):
    return subprocess.check_output(['git', *args], text=True).strip()


def gh(path):
    return json.loads(subprocess.check_output(['gh', 'api', path], text=True))


def code_changes(changed_paths):
    """The paths, between the pull request's head and the merge, that could change what was built and tested."""
    return [p for p in changed_paths
            if p not in IGNORED and any(p == w or p.startswith(w + '/') for w in WATCHED)]


def choose_run(runs, artifacts_of):
    """The newest successful pull_request run of the native workflow that still has its verified artifact."""
    for run in sorted(runs, key=lambda r: r['run_number'], reverse=True):
        if run.get('event') != 'pull_request' or run.get('conclusion') != 'success':
            continue
        names = [a['name'] for a in artifacts_of(run['id']) if not a.get('expired')]
        verified = [n for n in names if n.startswith('verified-native-ios-')]
        if len(verified) == 1:
            return run['id'], verified[0]
    return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sha', required=True)
    args = parser.parse_args()
    repository = os.environ['GITHUB_REPOSITORY']
    pulls = [p for p in gh(f'repos/{repository}/commits/{args.sha}/pulls') if p.get('merge_commit_sha') == args.sha]
    if len(pulls) != 1:
        return
    head = pulls[0]['head']['sha']

    changed = git('diff', '--name-only', head, args.sha).splitlines()
    if code_changes(changed):
        return
    runs = gh(f'repos/{repository}/actions/workflows/ios-native.yml/runs?head_sha={head}&per_page=20')['workflow_runs']
    found = choose_run(runs, lambda run_id: gh(f'repos/{repository}/actions/runs/{run_id}/artifacts')['artifacts'])
    if found:
        print(f'run={found[0]}')
        print(f'artifact={found[1]}')


if __name__ == '__main__':
    main()
