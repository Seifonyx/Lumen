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
        'files': [
            {'id': 'revision-file', 'name': 'notes.txt', 'mime': 'text/plain', 'text': 'preserved attachment'},
            {'id': 'missing-revision-image', 'name': 'old.jpg', 'mime': 'image/jpeg', 'kind': 'image', 'size': 4, 'stored': True}
        ]})
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
    long_ids = [f'long-{i}' for i in range(180)]
    document(f'modelRouter/{uid}/chats/long-fixture', {
        'title': 'Long conversation fixture', 'createdAt': 1700000000000, 'updatedAt': 1700000001000,
        'ids': long_ids, 'count': len(long_ids), 'model': 'fixture-model', 'rev': 1700000001000,
        'deleted': False, 'customFutureField': 'preserve-long-history'})
    for index, mid in enumerate(long_ids):
        document(f'modelRouter/{uid}/chats/long-fixture/messages/{mid}', {
            'id': mid, 'role': 'user' if index % 2 == 0 else 'assistant', 'text': f'Long history message {index}',
            'index': index, 'createdAt': 1700000000000 + index, 'status': 'done'})
    document(f'modelRouter/{uid}/chats/delete-fixture/nativeMetadataOps/old-operation', {'appliedAt': 1700000000000})
    document(f'modelRouter/{uid}/chats/delete-fixture', {
        'title': 'Delete fixture chat', 'createdAt': 1700000000000, 'updatedAt': 1700000001000,
        'ids': ['private-message'], 'count': 1, 'rev': 1700000001000, 'deleted': False})
    shared_file = {'id': 'delete-original', 'name': 'private.txt', 'mime': 'text/plain', 'kind': 'text',
                   'size': 7, 'text': 'private', 'stored': True}
    document(f'modelRouter/{uid}/chats/delete-fixture/messages/private-message', {
        'id': 'private-message', 'role': 'user', 'text': 'Private deletion fixture', 'index': 0,
        'createdAt': 1700000000000, 'files': [shared_file]})
    document(f'modelRouter/{uid}/files/delete-original', {
        'chatId': 'delete-fixture', 'name': 'private.txt', 'mime': 'text/plain', 'data': 'cHJpdmF0ZQ=='})
    document(f'modelRouter/{uid}/chats/shared-original-fixture', {
        'title': 'Shared attachment fixture', 'createdAt': 1700000000000, 'updatedAt': 1700000001000,
        'ids': ['shared-message'], 'count': 1, 'rev': 1700000001000, 'deleted': False})
    document(f'modelRouter/{uid}/chats/shared-original-fixture/messages/shared-message', {
        'id': 'shared-message', 'role': 'user', 'text': 'Keep this attachment', 'index': 0,
        'createdAt': 1700000000000, 'files': [shared_file]})
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
        return self.response(200, {'data': [{'id': 'fixture-model', 'active': True}, {'id': 'meta-llama/llama-4-scout-17b-16e-instruct', 'active': True}]})
    def do_POST(self):
        if not self.authorized(): return self.response(401, {'error': 'fixture rejected'})
        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        REQUESTS.append(body)
        prompt = body.get('messages', [{}])[-1].get('content', '')
        if isinstance(prompt, list): prompt = ' '.join(str(p.get('text', '')) for p in prompt)
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
    shared_url = url.removesuffix('web-fixture') + 'shared-original-fixture/messages/shared-message'
    with urllib.request.urlopen(urllib.request.Request(shared_url, headers={'Authorization': 'Bearer owner'}), timeout=15) as response:
        shared_fields = json.load(response)['fields']
    original_id = shared_fields['files']['arrayValue']['values'][0]['mapValue']['fields']['id']['stringValue']
    assert original_id == 'delete-original', 'Surviving chat lost its attachment reference'
    original_url = url.split('/chats/')[0] + '/files/' + original_id
    with urllib.request.urlopen(urllib.request.Request(original_url, headers={'Authorization': 'Bearer owner'}), timeout=15) as response:
        original = json.load(response)['fields']
    assert original['data']['stringValue'] == 'cHJpdmF0ZQ==', 'Surviving chat lost the shared original'
    chats_url = url.removesuffix('web-fixture')
    with urllib.request.urlopen(urllib.request.Request(chats_url.rstrip('/'), headers={'Authorization': 'Bearer owner'}), timeout=15) as response:
        all_chats = json.load(response).get('documents', [])
    assert any(any(m.get('content') == 'LUMEN_TEMPORARY_SECRET' for m in r.get('messages', [])) for r in REQUESTS), 'Temporary journey never reached provider'
    assert 'LUMEN_TEMPORARY_SECRET' not in json.dumps(all_chats), 'Temporary metadata leaked to cloud'
    for chat in all_chats:
        chat_id = chat['name'].rsplit('/', 1)[-1]
        with urllib.request.urlopen(urllib.request.Request(chats_url + chat_id + '/messages', headers={'Authorization': 'Bearer owner'}), timeout=15) as response:
            assert 'LUMEN_TEMPORARY_SECRET' not in response.read().decode(), 'Temporary messages leaked to cloud'
    original_chat = next(d for d in all_chats if d['fields'].get('title', {}).get('stringValue') == 'Original revision question')
    root_id = original_chat['name'].rsplit('/', 1)[-1]
    branches = [d for d in all_chats if d['fields'].get('nativeRoot', {}).get('stringValue') == root_id]
    for branch in branches:
        assert branch['fields']['projectId']['stringValue'] == 'revision-project'
        branch_ids = [v['stringValue'] for v in branch['fields']['ids']['arrayValue']['values']]
        message_url = chats_url + branch['name'].rsplit('/', 1)[-1] + '/messages/' + branch_ids[0]
        with urllib.request.urlopen(urllib.request.Request(message_url, headers={'Authorization': 'Bearer owner'}), timeout=15) as response:
            message_fields = json.load(response)['fields']
        attachments = [value['mapValue']['fields'] for value in message_fields['files']['arrayValue']['values']]
        assert attachments[0]['text']['stringValue'] == 'preserved attachment'
        assert attachments[1]['id']['stringValue'] == 'missing-revision-image', 'Revision discarded the historical image reference'
        assert message_fields['futureMessageField']['stringValue'] == 'preserve-through-revisions'
    assert len(branches) >= 2, 'Edited and regenerated versions were not synced'
    original_ids = [v['stringValue'] for v in original_chat['fields']['ids']['arrayValue']['values']]
    assert len(original_ids) == 2, 'Revision changed the original conversation'
    original_message_url = chats_url + root_id + '/messages/' + original_ids[0]
    with urllib.request.urlopen(urllib.request.Request(original_message_url, headers={'Authorization': 'Bearer owner'}), timeout=15) as response:
        assert json.load(response)['fields']['text']['stringValue'] == 'Original revision question'
    assert any(any(isinstance(m.get('content'), str) and m['content'].startswith('Edited revision question') for m in r.get('messages', [])) for r in REQUESTS), 'Provider never received the edited prompt'
    attachment_requests = [r for r in REQUESTS if 'NATIVE_ATTACHMENT_FILE_CONTENT' in json.dumps(r)]
    assert attachment_requests, 'Attachment text never reached provider'
    assert any('data:image/jpeg;base64,' in json.dumps(r) for r in attachment_requests), 'Actual image bytes never reached vision provider'
    attachment_chat = next(d for d in all_chats if d['fields'].get('title', {}).get('stringValue') == 'Review these native attachments')
    attachment_url = chats_url + attachment_chat['name'].rsplit('/', 1)[-1] + '/messages'
    with urllib.request.urlopen(urllib.request.Request(attachment_url, headers={'Authorization': 'Bearer owner'}), timeout=15) as response:
        saved = json.load(response)['documents']
    user = next(d['fields'] for d in saved if d['fields']['role']['stringValue'] == 'user')
    files = user['files']['arrayValue']['values']
    assert len(files) == 2
    for entry in files:
        file = entry['mapValue']['fields']
        assert 'data' not in file, 'Original bytes duplicated in message document'
        original = url.split('/chats/')[0] + '/files/' + file['id']['stringValue']
        with urllib.request.urlopen(urllib.request.Request(original, headers={'Authorization': 'Bearer owner'}), timeout=15) as response:
            data = base64.b64decode(json.load(response)['fields']['data']['stringValue'])
        assert data, 'Attachment original missing'
    long_requests = [r for r in REQUESTS if any(m.get('content') == 'NATIVE_LONG_FOLLOWUP' for m in r.get('messages', []))]
    assert long_requests and all(len(r['messages']) <= 40 for r in long_requests), 'Long context is not bounded'
    assert any(m.get('content') == 'Long history message 179' for m in long_requests[-1]['messages']), 'Newest history missing from reply context'
    assert all(m.get('content') != 'Long history message 0' for m in long_requests[-1]['messages']), 'Oldest history was sent beyond context budget'
    with urllib.request.urlopen(urllib.request.Request(chats_url + 'long-fixture', headers={'Authorization': 'Bearer owner'}), timeout=15) as response:
        long_chat = json.load(response)['fields']
    assert long_chat['customFutureField']['stringValue'] == 'preserve-long-history'
    long_ids = [v['stringValue'] for v in long_chat['ids']['arrayValue']['values']]
    assert long_ids[:180] == [f'long-{i}' for i in range(180)] and len(long_ids) >= 182, 'Long history was truncated in storage'
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
    return {'firebaseSDKRoundtrip': True, 'deletedContentCleaned': True, 'unknownMetadataPreserved': True, 'existingMessageFieldsPreserved': True, 'webOrderingPreserved': True, 'revisionVersionsPreserved': True, 'metadataRoundtrip': True, 'temporaryContentAbsent': True, 'attachmentRoundtrip': True, 'longHistoryPreserved': True, 'providerRequests': len(REQUESTS)}


def seed_user_id():
    request = urllib.request.Request(f'http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/projects/{PROJECT}/accounts:query',
                                     data=b'{}', headers={'Authorization': 'Bearer owner', 'Content-Type': 'application/json'}, method='POST')
    with urllib.request.urlopen(request, timeout=15) as response:
        users = json.load(response)['userInfo']
    return next(u['localId'] for u in users if u.get('email') == 'seifeldingamal2021@gmail.com')
