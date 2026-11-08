#!/usr/bin/env python3
"""Save only the native source listing, recovering from concurrent main pushes."""
import subprocess

SOURCE = 'ios/sidestore-source.json'


def git(*args, check=True):
    return subprocess.run(['git', *args], check=check, capture_output=True, text=True)


def main():
    if git('diff', '--quiet', '--', SOURCE, check=False).returncode == 0:
        print('Native SideStore listing is already current.')
        return
    git('add', '--', SOURCE)
    git('commit', '-m', 'Update native Lumen SideStore listing', '--only', '--', SOURCE)
    for attempt in range(3):
        pushed = git('push', 'origin', 'HEAD:main', check=False)
        if pushed.returncode == 0:
            print('Native SideStore listing saved to main.')
            return
        if attempt == 2:
            raise SystemExit('Source update could not be pushed after three attempts: ' + pushed.stderr)
        git('fetch', 'origin', 'main')
        rebased = git('rebase', 'origin/main', check=False)
        if rebased.returncode:
            git('rebase', '--abort', check=False)
            raise SystemExit('Source update conflicts with a concurrent main change; nothing was overwritten.\n'
                             + rebased.stderr)


if __name__ == '__main__':
    main()
