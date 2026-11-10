// The cloud original's chatId is the uploader, not an exclusive-ownership marker.
// Until reference counts are maintained atomically across native + web, deleting a
// conversation must never delete originals still referenced by surviving forks.
// This source-contract regression test prevents either client from reintroducing
// the unsafe owner-chatId delete while account deletion remains complete.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const web = readFileSync('src/lib/sync.ts', 'utf8');
const native = readFileSync('ios/Lumen/Services/FirestoreChatDeletion.swift', 'utf8');
const account = readFileSync('src/lib/delete-account.ts', 'utf8');

assert.match(web, /Cloud file originals can be shared with surviving native forks/);
assert.doesNotMatch(web, /removeOriginals\s*\(/);
assert.doesNotMatch(web, /deleteDoc\s*\(\s*doc\s*\(\s*filesCol/);
assert.match(native, /func deleteOriginalBatch\(chatID: String\) async throws -> Bool\s*\{[\s\S]*?Retain[\s\S]*?false\s*\}/);
assert.doesNotMatch(native, /whereField\("chatId", isEqualTo: chatID\)/);
assert.match(account, /SUBCOLLECTIONS\s*=\s*\['files'/);
console.log('PASS shared cloud originals remain after individual chat deletion; full-account cleanup retains file removal');
