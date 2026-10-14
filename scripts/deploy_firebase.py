#!/usr/bin/env python3
"""Deploys dist/ to Firebase Hosting through the Hosting REST API (no Firebase CLI needed).

Uses the hosting settings from firebase.json. Auth: an access token in FIREBASE_ACCESS_TOKEN, or
`gcloud auth print-access-token`, or a proxy that adds credentials for googleapis.com.
Equivalent CLI command: firebase deploy --only hosting
With --site NAME it deploys to another site of the project, and --public DIR deploys another folder.
With --channel NAME it deploys to a preview channel instead (a separate test address that lasts
30 days from the last deploy): firebase hosting:channel:deploy NAME
"""
import gzip, hashlib, json, os, subprocess, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cfg = json.load(open(os.path.join(ROOT, 'firebase.json')))['hosting']
arg = lambda name: sys.argv[sys.argv.index(name) + 1] if name in sys.argv else None
SITE = arg('--site') or cfg['site']  # --site model-router: the old address (forwarder, preview channel)
API = 'https://firebasehosting.googleapis.com/v1beta1'


def token():
    if os.environ.get('FIREBASE_ACCESS_TOKEN'):
        return os.environ['FIREBASE_ACCESS_TOKEN']
    try:
        return subprocess.check_output(['gcloud', 'auth', 'print-access-token'], stderr=subprocess.DEVNULL, text=True).strip()
    except Exception:
        return None


TOKEN = token()


def call(method, url, body=None, data=None, ctype='application/json', ok404=False):
    headers = {'content-type': ctype}
    if TOKEN:
        headers['authorization'] = f'Bearer {TOKEN}'
    payload = data if data is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(url, data=payload, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        if ok404 and e.code == 404:
            return None
        sys.exit(f'{method} {url} failed: {e.code} {e.read().decode()[:500]}')


public = os.path.join(ROOT, arg('--public') or cfg['public'])  # --public forward: the old address's forwarding page
files = {}
for base, _, names in os.walk(public):
    for n in names:
        path = os.path.join(base, n)
        rel = '/' + os.path.relpath(path, public).replace(os.sep, '/')
        files[rel] = gzip.compress(open(path, 'rb').read(), mtime=0)
hashes = {rel: hashlib.sha256(gz).hexdigest() for rel, gz in files.items()}

config = {
    'rewrites': [{'glob': r['source'], 'path': r['destination']} for r in cfg.get('rewrites', [])],
    'headers': [{'glob': h['source'], 'headers': {x['key']: x['value'] for x in h['headers']}} for h in cfg.get('headers', [])],
}
version = call('POST', f'{API}/sites/{SITE}/versions', {'config': config})['name']
print('version', version)
pop = call('POST', f'{API}/{version}:populateFiles', {'files': hashes})
need = set(pop.get('uploadRequiredHashes', []))
by_hash = {h: rel for rel, h in hashes.items()}
for i, h in enumerate(sorted(need), 1):
    call('POST', f"{pop['uploadUrl']}/{h}", data=files[by_hash[h]], ctype='application/octet-stream')
print(f'uploaded {len(need)} of {len(files)} files')
call('PATCH', f'{API}/{version}?update_mask=status', {'status': 'FINALIZED'})
channel = sys.argv[sys.argv.index('--channel') + 1] if '--channel' in sys.argv else None
if channel:
    ttl = {'ttl': f'{30 * 24 * 3600}s'}
    ch = call('GET', f'{API}/sites/{SITE}/channels/{channel}', ok404=True)
    ch = call('PATCH', f'{API}/sites/{SITE}/channels/{channel}?update_mask=ttl', ttl) if ch else call('POST', f'{API}/sites/{SITE}/channels?channelId={channel}', ttl)
    rel = call('POST', f'{API}/sites/{SITE}/channels/{channel}/releases?versionName={version}', {})
    print('released', rel.get('name'), '->', ch.get('url'))
else:
    rel = call('POST', f'{API}/sites/{SITE}/releases?versionName={version}', {})
    print('released', rel.get('name'), '->', f'https://{SITE}.web.app')
