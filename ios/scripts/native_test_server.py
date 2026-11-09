"""Local provider fixture and real Firebase emulator seed for native UI tests. No live accounts."""
import base64
import json
import threading
import time
import urllib.parse
import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PROJECT = 'demo-lumen-native'
REQUESTS = []


def json_request(url, body, method='POST', owner=False):
    headers = {'Content-Type': 'application/json'}
    if owner:
        headers['Authorization'] = 'Bearer owner'
    request = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers, method=method)
    with urllib.request.urlopen(request, timeout=15) as response:
        return json.load(response)


def field(value):
    if isinstance(value, bool): return {'booleanValue': value}
    if isinstance(value, int): return {'integerValue': str(value)}
    if isinstance(value, float): return {'doubleValue': value}
    if isinstance(value, str): return {'stringValue': value}
    if isinstance(value, list): return {'arrayValue': {'values': [field(v) for v in value]}}
    if isinstance(value, dict): return {'mapValue': {'fields': {k: field(v) for k, v in value.items()}}}
    raise ValueError(type(value))


def document(path, data):
    url = f'http://127.0.0.1:18080/v1/projects/{PROJECT}/databases/(default)/documents/{path}'
    return json_request(url, {'fields': {k: field(v) for k, v in data.items()}}, method='PATCH', owner=True)


def seed():
    # Each simulator profile gets a fresh, local-only database.
    assert PROJECT.startswith('demo-')
    reset = urllib.request.Request(f'http://127.0.0.1:18080/emulator/v1/projects/{PROJECT}/databases/(default)/documents', method='DELETE')
    with urllib.request.urlopen(reset, timeout=15): pass
    def b64(value): return base64.urlsafe_b64encode(json.dumps(value, separators=(',', ':')).encode()).decode().rstrip('=')
    token = b64({'alg': 'none', 'typ': 'JWT'}) + '.' + b64({
        'sub': 'fixture-native-user', 'email': 'seifeldingamal2021@gmail.com', 'email_verified': True,
        'name': 'Native QA', 'iss': 'https://accounts.google.com', 'aud': 'fixture-client'}) + '.'
    result = json_request('http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=fixture-api-key', {
        'requestUri': 'http://localhost', 'postBody': urllib.parse.urlencode({'id_token': token, 'providerId': 'google.com'}), 'returnSecureToken': True})
    uid = result['localId']
    document(f'modelRouter/{uid}', {'groqKey': 'fixture-provider-key', 'settings': {'theme': 'dark'}})
    document(f'modelRouter/{uid}/chats/web-fixture', {
        'title': 'Web history fixture', 'createdAt': 1700000000000, 'updatedAt': 1700000001000,
        'ids': ['web-user', 'web-assistant'], 'count': 2, 'model': 'fixture-model', 'rev': 1700000001000,
        'deleted': False, 'projectId': 'preserve-project', 'documents': [{'id': 'preserve-document'}], 'customFutureField': 'preserve-me'})
    for index, (mid, role, text) in enumerate([('web-user', 'user', 'Question from the web'), ('web-assistant', 'assistant', 'An existing web reply.')]):
        document(f'modelRouter/{uid}/chats/web-fixture/messages/{mid}', {
            'id': mid, 'role': role, 'text': text, 'index': index, 'createdAt': 1700000000000 + index * 1000,
            'status': 'done', 'sources': [{'title': 'preserve-citation', 'url': 'https://example.com'}]})
    document(f'modelRouter/{uid}/chats/revision-fixture', {
        'title': 'Original revision question', 'createdAt': 1700000000000, 'updatedAt': 1700000001000,
        'ids': ['revision-user', 'revision-assistant'], 'count': 2, 'model': 'fixture-model', 'rev': 1700000001000,
        'deleted': False, 'projectId': 'revision-project'})
    document(f'modelRouter/{uid}/chats/revision-fixture/messages/revision-user', {
        'id': 'revision-user', 'role': 'user', 'text': 'Original revision question', 'index': 0,
        'createdAt': 1700000000000, 'status': 'done', 'futureMessageField': 'preserve-through-revisions',
        'files': [{'id': 'revision-file', 'name': 'notes.txt', 'mime': 'text/plain', 'text': 'preserved attachment'}]})
    document(f'modelRouter/{uid}/chats/revision-fixture/messages/revision-assistant', {
        'id': 'revision-assistant', 'role': 'assistant', 'text': 'A native streamed reply.', 'index': 1,
        'createdAt': 1700000001000, 'status': 'done'})
    document(f'modelRouter/{uid}/chats/metadata-fixture', {
        'title': 'History management fixture', 'createdAt': 1700000000000, 'updatedAt': 1700000001000,
        'ids': ['metadata-user'], 'count': 1, 'model': 'fixture-model', 'rev': 1700000001000,
        'deleted': False, 'projectId': 'preserve-metadata-project', 'customFutureField': 'preserve-metadata-field'})
    document(f'modelRouter/{uid}/chats/metadata-fixture/messages/metadata-user', {
        'id': 'metadata-user', 'role': 'user', 'text': 'Recovery notes from last winter', 'index': 0,
        'createdAt': 1700000000000, 'status': 'done'})
    document(f'modelRouter/{uid}/chats/delete-fixture/nativeMetadataOps/old-operation', {'appliedAt': 1700000000000})
    document(f'modelRouter/{uid}/chats/delete-fixture', {
        'title': 'Delete fixture chat', 'createdAt': 1700000000000, 'updatedAt': 1700000001000,
        'ids': ['private-message'], 'count': 1, 'rev': 1700000001000, 'deleted': False})
    document(f'modelRouter/{uid}/chats/delete-fixture/messages/private-message', {
        'id': 'private-message', 'role': 'user', 'text': 'Private deletion fixture', 'index': 0,
        'createdAt': 1700000000000, 'files': [{'id': 'delete-original', 'name': 'private.txt'}]})
    document(f'modelRouter/{uid}/files/delete-original', {
        'chatId': 'delete-fixture', 'name': 'private.txt', 'mime': 'text/plain', 'data': 'cHJpdmF0ZQ=='})
    return uid


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_): pass
    def response(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)
    def authorized(self): return self.headers.get('Authorization') == 'Bearer fixture-provider-key'
    def do_GET(self):
        if not self.authorized(): return self.response(401, {'error': 'fixture rejected'})
        return self.response(200, {'data': [{'id': 'fixture-model', 'active': True}]})
    def do_POST(self):
        if not self.authorized(): return self.response(401, {'error': 'fixture rejected'})
        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        REQUESTS.append(body)
        prompt = body.get('messages', [{}])[-1].get('content', '')
        if 'Fail this request' in prompt: return self.response(503, {'error': 'provider fixture failure'})
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        tokens = ['A native ', 'streamed ', 'reply.'] if 'Stop' not in prompt else ['Partial reply. '] * 30
        try:
            for token in tokens:
                time.sleep(0.25)
                event = json.dumps({'choices': [{'delta': {'content': token}}]})
                self.wfile.write(('data: ' + event + '\r\n\r\n').encode())
                self.wfile.flush()
            self.wfile.write(b'data: [DONE]\n\n')
            self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError): pass


def start():
    seed()
    server = ThreadingHTTPServer(('127.0.0.1', 18081), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def verify_roundtrip():
    # Inspect emulator documents independently of Swift's decoder, after the UI journeys finish.
    account = seed_user_id()
    url = f'http://127.0.0.1:18080/v1/projects/{PROJECT}/databases/(default)/documents/modelRouter/{account}/chats/web-fixture'
    request = urllib.request.Request(url, headers={'Authorization': 'Bearer owner'})
    with urllib.request.urlopen(request, timeout=15) as response:
        fields = json.load(response)['fields']
    assert fields['projectId']['stringValue'] == 'preserve-project'
    assert fields['customFutureField']['stringValue'] == 'preserve-me'
    assert fields['documents']['arrayValue']['values'][0]['mapValue']['fields']['id']['stringValue'] == 'preserve-document'
    ids = [v['stringValue'] for v in fields['ids']['arrayValue']['values']]
    assert ids[:2] == ['web-user', 'web-assistant'], ids
    assert len(ids) >= 4, 'Native follow-up was not synced to the web chat'
    old_message = urllib.request.Request(url + '/messages/web-assistant', headers={'Authorization': 'Bearer owner'})
    with urllib.request.urlopen(old_message, timeout=15) as response:
        old_fields = json.load(response)['fields']
    assert old_fields['sources']['arrayValue']['values'][0]['mapValue']['fields']['title']['stringValue'] == 'preserve-citation'
    assert any(r.get('model') == 'fixture-model' and any(m.get('content') == 'An existing web reply.' for m in r.get('messages', [])) for r in REQUESTS), 'Provider did not receive reopened web context'
    deleted_url = url.removesuffix('web-fixture') + 'delete-fixture'
    with urllib.request.urlopen(urllib.request.Request(deleted_url, headers={'Authorization': 'Bearer owner'}), timeout=15) as response:
        deleted = json.load(response)['fields']
    assert deleted['deleted']['booleanValue'] is True
    assert 'title' not in deleted and 'ids' not in deleted, 'Deletion retained private chat metadata'
    with urllib.request.urlopen(urllib.request.Request(deleted_url + '/messages', headers={'Authorization': 'Bearer owner'}), timeout=15) as response:
        assert not json.load(response).get('documents'), 'Deleted message documents remain'
    original_url = url.split('/chats/')[0] + '/files/delete-original'
    try:
        urllib.request.urlopen(urllib.request.Request(original_url, headers={'Authorization': 'Bearer owner'}), timeout=15)
        raise AssertionError('Deleted attachment original remains')
    except urllib.error.HTTPError as error:
        assert error.code == 404
    chats_url = url.removesuffix('web-fixture')
    with urllib.request.urlopen(urllib.request.Request(chats_url, headers={'Authorization': 'Bearer owner'}), timeout=15) as response:
        all_chats = json.load(response).get('documents', [])
    original_chat = next(d for d in all_chats if d['fields'].get('title', {}).get('stringValue') == 'Original revision question')
    root_id = original_chat['name'].rsplit('/', 1)[-1]
    branches = [d for d in all_chats if d['fields'].get('nativeRoot', {}).get('stringValue') == root_id]
    for branch in branches:
        assert branch['fields']['projectId']['stringValue'] == 'revision-project'
        branch_ids = [v['stringValue'] for v in branch['fields']['ids']['arrayValue']['values']]
        message_url = chats_url + branch['name'].rsplit('/', 1)[-1] + '/messages/' + branch_ids[0]
        with urllib.request.urlopen(urllib.request.Request(message_url, headers={'Authorization': 'Bearer owner'}), timeout=15) as response:
            message_fields = json.load(response)['fields']
        assert message_fields['files']['arrayValue']['values'][0]['mapValue']['fields']['text']['stringValue'] == 'preserved attachment'
        assert message_fields['futureMessageField']['stringValue'] == 'preserve-through-revisions'
    assert len(branches) >= 2, 'Edited and regenerated versions were not synced'
    original_ids = [v['stringValue'] for v in original_chat['fields']['ids']['arrayValue']['values']]
    assert len(original_ids) == 2, 'Revision changed the original conversation'
    original_message_url = chats_url + root_id + '/messages/' + original_ids[0]
    with urllib.request.urlopen(urllib.request.Request(original_message_url, headers={'Authorization': 'Bearer owner'}), timeout=15) as response:
        assert json.load(response)['fields']['text']['stringValue'] == 'Original revision question'
    assert any(any(m.get('content') == 'Edited revision question' for m in r.get('messages', [])) for r in REQUESTS), 'Provider never received the edited prompt'
    metadata_url = chats_url + 'metadata-fixture'
    with urllib.request.urlopen(urllib.request.Request(metadata_url, headers={'Authorization': 'Bearer owner'}), timeout=15) as response:
        managed = json.load(response)['fields']
    assert managed['title']['stringValue'] == 'Renamed training chat'
    assert managed['pinned']['booleanValue'] is True and managed['archived']['booleanValue'] is False
    assert managed['projectId']['stringValue'] == 'preserve-metadata-project'
    assert managed['customFutureField']['stringValue'] == 'preserve-metadata-field'
    assert [v['stringValue'] for v in managed['ids']['arrayValue']['values']] == ['metadata-user']
    with urllib.request.urlopen(urllib.request.Request(deleted_url + '/nativeMetadataOps', headers={'Authorization': 'Bearer owner'}), timeout=15) as response:
        assert not json.load(response).get('documents'), 'Deleted metadata operation markers remain'
    return {'firebaseSDKRoundtrip': True, 'deletedContentCleaned': True, 'unknownMetadataPreserved': True, 'existingMessageFieldsPreserved': True, 'webOrderingPreserved': True, 'revisionVersionsPreserved': True, 'metadataRoundtrip': True, 'providerRequests': len(REQUESTS)}


def seed_user_id():
    request = urllib.request.Request(f'http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/projects/{PROJECT}/accounts:query',
                                     data=b'{}', headers={'Authorization': 'Bearer owner', 'Content-Type': 'application/json'}, method='POST')
    with urllib.request.urlopen(request, timeout=15) as response:
        users = json.load(response)['userInfo']
    return next(u['localId'] for u in users if u.get('email') == 'seifeldingamal2021@gmail.com')
