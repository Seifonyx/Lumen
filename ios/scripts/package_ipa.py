#!/usr/bin/env python3
"""Validate a native device archive and package an unsigned SideStore IPA."""
import argparse
import hashlib
import json
import plistlib
import re
import shutil
import struct
import tempfile
import zipfile
from pathlib import Path

BUNDLE_ID = 'io.github.seifonyx.lumen'


def version_tuple(value):
    return tuple(int(part) for part in value.split('.'))


def validate_app(app):
    info = plistlib.loads((app / 'Info.plist').read_bytes())
    if info.get('CFBundleIdentifier') != BUNDLE_ID:
        raise ValueError('Unexpected native bundle identifier')
    if info.get('CFBundleSupportedPlatforms') != ['iPhoneOS']:
        raise ValueError('Expected an iPhone device build')
    minimum = info.get('MinimumOSVersion', '')
    if not re.fullmatch(r'\d+(?:\.\d+){0,2}', minimum) or version_tuple(minimum) < (26, 0):
        raise ValueError('Minimum iOS version must be 26.0 or newer')
    version = info.get('CFBundleShortVersionString', '')
    build = info.get('CFBundleVersion', '')
    if not re.fullmatch(r'\d+\.\d+\.\d+', version) or not re.fullmatch(r'[1-9]\d*', build):
        raise ValueError(f'Expected semantic marketing version and positive numeric build; got {version!r}, {build!r}')
    name = info.get('CFBundleExecutable', '')
    if not name or Path(name).name != name or name in {'.', '..'}:
        raise ValueError('Invalid app executable name')
    binary = (app / name).read_bytes()
    if len(binary) < 32:
        raise ValueError('Truncated app executable')
    magic, cpu, _, _, commands, command_bytes, _, _ = struct.unpack_from('<IiiIIIII', binary)
    if magic != 0xFEEDFACF or cpu != 0x0100000C:
        raise ValueError('Expected an arm64 Mach-O executable')
    if 32 + command_bytes > len(binary):
        raise ValueError('Truncated executable load commands')
    cursor, platform, binary_minimum = 32, None, None
    for _ in range(commands):
        if cursor + 8 > 32 + command_bytes:
            raise ValueError('Invalid executable load command')
        command, size = struct.unpack_from('<II', binary, cursor)
        if size < 8 or cursor + size > 32 + command_bytes:
            raise ValueError('Invalid executable load command size')
        if command == 0x32:
            if size < 24:
                raise ValueError('Truncated platform load command')
            platform, binary_minimum = struct.unpack_from('<II', binary, cursor + 8)
        cursor += size
    if platform != 2:
        raise ValueError('Executable must target an iOS device, not a simulator')
    if binary_minimum is None or binary_minimum < 26 << 16:
        raise ValueError('Executable deployment target must be iOS 26 or newer')
    if any(marker in binary for marker in [b'--lumen-integration', b'fixture-native-user', b'fixture-provider-key', b'demo-lumen-native']):
        raise ValueError('Release executable contains a simulator test fixture')
    for resource in app.rglob('*'):
        if resource.is_symlink():
            raise ValueError('Unexpected symlink inside the native app')
        if resource.suffix.lower() in {'.p8', '.p12', '.key'} or resource.name.startswith('.env'):
            raise ValueError('App contains a private credential resource')
    return info


def package(app, output, source_commit):
    if not re.fullmatch(r'[0-9a-f]{40}', source_commit):
        raise ValueError('Expected the exact source commit')
    info = validate_app(app)
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='lumen-ipa-') as temporary:
        payload = Path(temporary) / 'Payload'
        staged = payload / 'Lumen.app'
        shutil.copytree(app, staged)
        for resource in list(staged.rglob('*')):
            if resource.name == '_CodeSignature' and resource.is_dir():
                shutil.rmtree(resource)
            elif resource.name == 'embedded.mobileprovision' and resource.is_file():
                resource.unlink()
        with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
            for resource in sorted(staged.rglob('*')):
                if resource.is_file():
                    archive.write(resource, resource.relative_to(temporary))
    with zipfile.ZipFile(output) as archive:
        if archive.testzip() is not None:
            raise ValueError('IPA ZIP integrity check failed')
    manifest = {
        'bundleIdentifier': info['CFBundleIdentifier'],
        'version': info['CFBundleShortVersionString'],
        'build': info['CFBundleVersion'],
        'minimumOSVersion': info['MinimumOSVersion'],
        'sourceCommit': source_commit,
        'architecture': 'arm64',
        'platform': 'iPhoneOS',
        'size': output.stat().st_size,
        'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
    }
    (output.parent / 'build-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--app', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--source-commit', required=True)
    args = parser.parse_args()
    try:
        manifest = package(args.app, args.output, args.source_commit)
    except (ValueError, OSError, plistlib.InvalidFileException, struct.error) as error:
        parser.exit(1, f'IPA validation failed: {error}\n')
    print(json.dumps(manifest, indent=2))


if __name__ == '__main__':
    main()
