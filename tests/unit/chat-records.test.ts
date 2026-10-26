import assert from 'node:assert/strict';
import { answersByDay, latestRequestEvidence, recentRequests } from '../../src/lib/chat-records';
import type { Chat, Message } from '../../src/types';

const now = new Date(2026, 9, 26, 12).getTime();
const assistant = (id: string, status: Message['status'], createdAt: number, extra: Partial<Message> = {}): Message => ({
  id,
  role: 'assistant',
  text: `private-${id}`,
  model: 'gemini:flash',
  status,
  createdAt,
  ...extra,
});
const chat = (id: string, messages: Message[], title = `private-title-${id}`): Chat => ({
  id,
  title,
  createdAt: now,
  updatedAt: now,
  messages,
});

const saved = chat('saved', [
  assistant('done', 'done', now - 5_000),
  assistant('legacy', undefined, now - 4_500),
  assistant('rerouted', 'done', now - 4_000, { notices: ['Pro reached its limit — switched to Flash.'] }),
  assistant('stopped', 'stopped', now - 3_000),
  assistant('failed', 'error', now - 2_000, { error: '401 provider quoted private request data' }),
  assistant('active', 'streaming', now - 1_000),
]);
const temporary = chat('temporary-private', [assistant('temp', 'done', now - 500)]);

const history = answersByDay([saved, temporary], 1, now);
assert.deepEqual(history.days[0], { day: history.days[0].day, answers: 2, failed: 1, stopped: 1 });
assert.deepEqual(history.models, [['gemini:flash', 2]], 'only explicitly completed answers contribute; stopped, failed and unknown-status requests do not');

const requests = recentRequests([saved, temporary]);
assert.deepEqual(requests.map((row) => row.outcome), ['failed', 'stopped', 'rerouted', 'answered'], 'legacy messages without a completion status are not presumed answered');
assert.equal(requests[0].detail, 'Connection refused', 'provider error text is reduced to a safe category');
assert(!JSON.stringify(requests).includes('private request data'));

assert.deepEqual(latestRequestEvidence([saved, temporary]), {
  at: now - 1_000,
  model: 'gemini:flash',
  outcome: 'in-progress',
  detail: '',
  chatId: 'saved',
  chatTitle: 'private-title-saved',
  route: null,
});
assert.equal(latestRequestEvidence([temporary]), null, 'temporary account-local work is not retained as history evidence');
assert.equal(latestRequestEvidence([chat('status-unknown', [assistant('unknown', undefined, now)])]), null, 'unknown status cannot become an invented latest outcome');
assert.equal(latestRequestEvidence([]), null, 'empty history remains missing evidence');

const otherAccount = chat('other-account', [assistant('other', 'done', now + 10)]);
assert.equal(latestRequestEvidence([saved])?.chatId, 'saved');
assert.equal(latestRequestEvidence([otherAccount])?.chatId, 'other-account');
assert.equal(latestRequestEvidence([saved])?.chatId, 'saved', 'the adapter cannot retain data from another scoped input');

console.log('PASS saved-chat completion, stopped/failed/in-progress, privacy, empty and account-scoped evidence');
