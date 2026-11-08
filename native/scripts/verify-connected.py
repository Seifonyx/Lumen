"""Check the actual packaged app against approved private SDK input; print no config."""
import json, os, pathlib, plistlib, subprocess

app = pathlib.Path('native/artifacts/Payload/Lumen.app')
config = json.loads(pathlib.Path(os.environ['LUMEN_NATIVE_SERVICE_CONFIG']).read_text())
account = config['mode'] == 'account-connected'
assert config['projectId'] == ('the-model-router' if account else 'lumen-ios-test')
with (app / 'Info.plist').open('rb') as f:
    info = plistlib.load(f)
graph = json.loads((app / 'public/demo-build.json').read_text())
assert graph['mode'] == config['mode'] and graph['presentation'] == 'canvas'
assert graph.get('freeAi') is True and 'aiApproval' not in graph
for field in config:
    assert graph['serviceConfig'][field] == config[field], 'Packaged configuration mismatch'
native = info['LumenTestServices']
assert native['mode'] == config['mode'] and native['projectId'] == config['projectId']
assert info['CFBundleIdentifier'] == config['bundleId'] == config.get('signedBundleId', config['bundleId'])
for field in ['iosClientId', 'webClientId']:
    assert native[field] == config[field]
scheme = '.'.join(reversed(config['iosClientId'].split('.')))
assert info['CFBundleURLTypes'][0]['CFBundleURLSchemes'] == [scheme]
assert native['callbackScheme'] == scheme
assert native.get('aiProvider') == 'openrouter'
if account: assert info['CFBundleDisplayName'] == 'Lumen'
for module in ['native/services/main.ts', 'native/services/account.ts', 'native/services/sync.ts', 'native/services/KeysPanel.tsx', 'native/services/ai-consent.ts']:
    assert module in graph['modules'], 'Missing real-service entry'
assert any('node_modules/@firebase/auth/' in m for m in graph['modules'])
assert any('node_modules/@firebase/firestore/' in m for m in graph['modules'])
assert not any(m.startswith('.qa-build/') for m in graph['modules'])
assert not any(m.startswith('native/authorization/') for m in graph['modules'])
symbols = subprocess.check_output(['nm', '-gj', str(app / info['CFBundleExecutable'])], text=True)
assert 'GIDSignIn' in symbols, 'Native GoogleSignIn not linked'
assert not (app / 'public/sw.js').exists()
print('PASS connected iphoneos app: approved service config, GoogleSignIn linked, callback, Firebase auth/cloud modules, stable bundle; physical sign-in not verified')
