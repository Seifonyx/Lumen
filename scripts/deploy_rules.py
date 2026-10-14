#!/usr/bin/env python3
"""Publishes firestore.rules through the Firebase Rules REST API (no Firebase CLI needed).

Equivalent CLI command: firebase deploy --only firestore:rules
Auth works like deploy_firebase.py: FIREBASE_ACCESS_TOKEN, `gcloud auth print-access-token`,
or a proxy that adds credentials for googleapis.com.
"""
import json, os, subprocess, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT = json.load(open(os.path.join(ROOT, '.firebaserc')))['projects']['default']
API = f'https://firebaserules.googleapis.com/v1/projects/{PROJECT}'


def token():
    if os.environ.get('FIREBASE_ACCESS_TOKEN'):
        return os.environ['FIREBASE_ACCESS_TOKEN']
    try:
        return subprocess.check_output(['gcloud', 'auth', 'print-access-token'], stderr=subprocess.DEVNULL, text=True).strip()
    except Exception:
        return None


TOKEN = token()


def call(method, url, body):
    headers = {'content-type': 'application/json'}
    if TOKEN:
        headers['authorization'] = f'Bearer {TOKEN}'
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method=method, headers=headers)
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        raise SystemExit(f'{method} {url} failed: {e.code} {e.read().decode()[:600]}')


source = open(os.path.join(ROOT, 'firestore.rules')).read()
ruleset = call('POST', f'{API}/rulesets', {'source': {'files': [{'name': 'firestore.rules', 'content': source}]}})
release = f'projects/{PROJECT}/releases/cloud.firestore'
call('PATCH', f'{API}/releases/cloud.firestore', {'release': {'name': release, 'rulesetName': ruleset['name']}})
print(f"released {ruleset['name']} -> {release}")
