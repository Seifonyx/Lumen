"""Inspect native public client configuration using existing CI credentials; never print tokens."""
import base64
import json
import os
import plistlib
import urllib.error
import urllib.request
from pathlib import Path

OUTPUT = Path(os.environ.get('RUNNER_TEMP', '/tmp')) / 'lumen-firebase-public'
OUTPUT.mkdir(exist_ok=True)
legacy = json.loads(os.environ.get('LUMEN_ACCOUNT_CONFIG') or '{}')
allowed = ['projectId', 'projectNumber', 'iosClientId', 'webClientId', 'bundleId', 'signedBundleId', 'nativeApiKeyBundleId']
public = {'legacy': {key: legacy[key] for key in allowed if key in legacy}}
print('Existing public OAuth configuration:', json.dumps(public['legacy']))

service = os.environ.get('LUMEN_FIREBASE_SERVICE')
if service:
    from google.auth.transport.requests import Request
    from google.oauth2 import service_account
    credentials = service_account.Credentials.from_service_account_info(
        json.loads(service), scopes=['https://www.googleapis.com/auth/cloud-platform'])
    credentials.refresh(Request())

    def get(url, body=None):
        request = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None,
                                         headers={'Authorization': 'Bearer ' + credentials.token, 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            return {'httpStatus': error.code, 'error': json.load(error).get('error', {}).get('message', 'Request failed')}

    apps_url = 'https://firebase.googleapis.com/v1beta1/projects/the-model-router/iosApps'
    apps = get(apps_url)
    if os.environ.get('LUMEN_REGISTER_NATIVE') == '1' and 'apps' in apps:
        import time
        targets = ['io.github.seifonyx.lumen']
        old_signed = legacy.get('signedBundleId', '')
        old_base = legacy.get('bundleId', '')
        if old_base and old_signed.startswith(old_base + '.'):
            targets.append('io.github.seifonyx.lumen' + old_signed[len(old_base):])
        for target in targets:
            if any(app.get('bundleId') == target for app in apps['apps']):
                continue
            operation = get(apps_url, {'bundleId': target, 'displayName': 'Lumen native iOS'})
            if 'error' in operation:
                print('Native registration result:', target, json.dumps(operation))
                continue
            for _ in range(20):
                operation = get('https://firebase.googleapis.com/v1beta1/' + operation['name'])
                if operation.get('done'):
                    break
                time.sleep(1)
            print('Native registration completed:', target, bool(operation.get('done')), 'error' in operation)
        apps = get(apps_url)
    public['iosApps'] = [{key: app.get(key) for key in ['name', 'appId', 'bundleId']} for app in apps.get('apps', [])]
    if 'error' in apps:
        public['appsError'] = apps
    database = get('https://firestore.googleapis.com/v1/projects/the-model-router/databases/(default)')
    public['database'] = {key: database.get(key) for key in ['name', 'type', 'databaseEdition', 'locationId', 'httpStatus', 'error'] if key in database}
    for app in apps.get('apps', []):
        config = get('https://firebase.googleapis.com/v1beta1/' + app['name'] + '/config')
        if 'configFileContents' in config:
            info = plistlib.loads(base64.b64decode(config['configFileContents']))
            public.setdefault('clientConfigurations', []).append({key: info.get(key) for key in
                ['GOOGLE_APP_ID', 'BUNDLE_ID', 'PROJECT_ID', 'CLIENT_ID', 'REVERSED_CLIENT_ID', 'API_KEY'] if key in info})
    print('Firebase app metadata:', json.dumps(public.get('iosApps', [])))
    print('Firestore metadata:', json.dumps(public.get('database', {})))
    print('Public native configuration count:', len(public.get('clientConfigurations', [])))
    if 'appsError' in public:
        print('Native configuration lookup:', json.dumps(public['appsError']))
else:
    public['serviceAccountAvailable'] = False
    print('Firebase management credential is not configured.')
(OUTPUT / 'public-configuration.json').write_text(json.dumps(public, indent=2) + '\n')
