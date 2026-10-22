// QA01: the synthetic review build's only network path. Refuses every other host, never forwards a
// prompt, honours Stop, and checks the review lease before producing a reply.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const origin = 'https://qa.review.test';
let leaseOk = true;
const nativeCalls: string[] = [];
Object.assign(globalThis, {
  location: { origin, href: `${origin}/b/x/`, hostname: 'qa.review.test', search: '' },
  document: { baseURI: `${origin}/b/${'a'.repeat(40)}-1-1/`, addEventListener() {}, visibilityState: 'visible' },
  window: { addEventListener() {} },
  fetch: async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    nativeCalls.push(url);
    if (url.endsWith('/__lease')) return leaseOk ? Response.json({ buildId: `${'a'.repeat(40)}-1-1`, namespace: 'b'.repeat(32), expiresAt: Date.now() + 60_000, now: Date.now() }) : new Response('gone', { status: 410 });
    return new Response('same-origin file');
  },
});
const { qaFetch, syntheticReply } = await import('../../qa/iphone/adapters/transport');
const { isLocked } = await import('../../qa/iphone/adapters/lease');
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
const blocked = () => (globalThis as { __qaBlockedHosts?: string[] }).__qaBlockedHosts || [];
const body = (text: string) => JSON.stringify({ contents: [{ role: 'user', parts: [{ text }] }] });

test('every other host and protocol is refused before any request, and recorded by host only', async () => {
  for (const url of ['https://openrouter.ai/api/v1/chat/completions', 'https://model-router-provider-relay.model-router.workers.dev/x', 'https://r.jina.ai/https://example.com',
    'https://api.github.com/user', 'https://firestore.googleapis.com/v1/x', 'http://generativelanguage.googleapis.com/v1beta/models', 'wss://x.invalid/']) {
    nativeCalls.length = 0;
    await assert.rejects(qaFetch(`${url}?secret=PROMPT_TEXT`), /disabled in this synthetic review build/);
    assert.deepEqual(nativeCalls, [], url);
  }
  assert.ok(blocked().length >= 7 && !blocked().some((h) => h.includes('PROMPT_TEXT')));
});

test('same-origin is GET-only; local blob/data reads are allowed', async () => {
  await assert.rejects(qaFetch(`${origin}/b/x/upload`, { method: 'POST', body: 'x' }), /disabled/);
  nativeCalls.length = 0;
  assert.equal(await (await qaFetch('./assets/app.js')).text(), 'same-origin file');
  assert.equal(nativeCalls.length, 1);
  await qaFetch('data:text/plain,hi');
});

test('the synthetic catalogue and replies stay on the device and never echo a whole prompt', async () => {
  nativeCalls.length = 0;
  const catalog = await (await qaFetch(`${GEMINI}/models?pageSize=1000`)).json();
  assert.deepEqual(catalog.models.map((m: { name: string }) => m.name), ['models/gemini-flash-latest', 'models/gemini-2.5-pro']);
  const long = 'x'.repeat(500) + 'TAIL_SECRET';
  const response = await qaFetch(`${GEMINI}/models/gemini-flash-latest:streamGenerateContent?alt=sse`, { method: 'POST', body: body(long) });
  assert.equal(response.headers.get('content-type'), 'text/event-stream');
  const raw = await response.text();
  assert.match(raw, /"finishReason":"STOP"/);
  const text = raw.split('\n').filter((l) => l.startsWith('data: ')).map((l) => JSON.parse(l.slice(6)).candidates[0].content.parts[0].text).join('');
  assert.match(text, /No live provider was contacted/);
  assert.ok(!text.includes('TAIL_SECRET'));
  assert.ok(!syntheticReply(long).includes('TAIL_SECRET'));
  assert.deepEqual(nativeCalls.filter((u) => !u.endsWith('/__lease')), [], 'only the lease is asked, nothing else');
});

test('a Request object\'s own method and body are honoured, never silently dropped', async () => {
  const quota = await qaFetch(new Request(`${GEMINI}/models/gemini-2.5-pro:streamGenerateContent?alt=sse`, { method: 'POST', body: body('[synthetic:quota]') }));
  assert.equal(quota.status, 429);
  await assert.rejects(qaFetch(new Request(`${origin}/b/x/upload`, { method: 'POST', body: 'x' })), /disabled/);
});

test('scenarios: quota and provider errors are reported like a provider would', async () => {
  const quota = await qaFetch(`${GEMINI}/models/gemini-2.5-pro:streamGenerateContent?alt=sse`, { method: 'POST', body: body('[synthetic:quota]') });
  assert.equal(quota.status, 429);
  const error = await qaFetch(`${GEMINI}/models/gemini-2.5-pro:streamGenerateContent?alt=sse`, { method: 'POST', body: body('[synthetic:error]') });
  assert.equal(error.status, 503);
  const embed = await qaFetch(`${GEMINI}/models/text-embedding:batchEmbedContents`, { method: 'POST', body: '{}' });
  assert.equal(embed.status, 503);
});

test('Stop aborts a synthetic stream', async () => {
  const controller = new AbortController();
  const response = await qaFetch(`${GEMINI}/models/gemini-flash-latest:streamGenerateContent?alt=sse`, { method: 'POST', body: body('[synthetic:slow] hi'), signal: controller.signal });
  const reader = response.body!.getReader();
  controller.abort();
  await assert.rejects(reader.read(), /stopped/);
});

test('an ended lease refuses the reply and locks the review', async () => {
  leaseOk = false;
  const response = await qaFetch(`${GEMINI}/models/gemini-flash-latest:streamGenerateContent?alt=sse`, { method: 'POST', body: body('after the end') });
  assert.equal(response.status, 403);
  assert.ok(!(await response.text()).includes('No live provider'));
  assert.equal(isLocked(), true);
});

test('the QA build entry and adapters type-check against the canonical modules they replace', () => {
  execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'qa/iphone/tsconfig.json'], { stdio: 'pipe' });
});
