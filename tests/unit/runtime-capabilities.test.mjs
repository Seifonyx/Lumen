import assert from 'node:assert/strict';
import { runChat } from '../../src/lib/ai/chat.js';
import { catalog, setKeys } from '../../src/lib/ai/providers.js';
import { clearHealth, clearRecord } from '../../src/lib/ai/health.js';

const calls = [];
const TEXT = 'groq:fixture-text', VISION = 'groq:fixture-vision';
const metadata = (extra = {}) => ({ context: 128000, vision: false, pdf: false, search: false, ...extra });
globalThis.fetch = async (url, options = {}) => {
  if (String(url).endsWith('/models')) return Response.json({ data: [{ id: 'fixture-text', context_window: 32000, architecture: { input_modalities: ['text'] } }] });
  const body = JSON.parse(options.body);
  calls.push({ url: String(url), body });
  return new Response('data: ' + JSON.stringify({ choices: [{ delta: { content: 'Fixture answer' }, finish_reason: 'stop' }] }) + '\n\n');
};
const collect = async (input) => {
  calls.length = 0;
  clearHealth();
  const events = [];
  for await (const event of runChat(input, new AbortController().signal)) events.push(event);
  return events;
};
const text = [{ role: 'user', text: 'hello' }];
const raw = (kind) => [{ role: 'user', text: 'Read the attachment', files: [{ kind, name: `reference.${kind === 'image' ? 'png' : 'pdf'}`, mime: kind === 'image' ? 'image/png' : 'application/pdf', data: 'AQID' }] }];
setKeys({ groq: 'fixture' });
clearRecord();

for (const kind of ['image', 'pdf']) {
  const events = await collect({ model: TEXT, messages: raw(kind) });
  assert.equal(calls.length, 0, `Missing metadata must not silently accept a raw ${kind}`);
  assert(events.some(event => event.t === 'error' && /capabilit|refresh|attachment/i.test(event.text)));
}

let events = await collect({ model: TEXT, messages: [{ role: 'user', text: 'A'.repeat(100000) }] });
assert.equal(calls.length, 0, 'Missing metadata must not give an oversized request unlimited context');
assert(events.some(event => event.t === 'error' && /context|capabilit|refresh/i.test(event.text)));

events = await collect({ model: TEXT, messages: text });
assert.equal(calls.length, 1, 'Unknown short-text choices remain usable as a last resort');
assert(events.some(event => event.t === 'text'));

events = await collect({ model: VISION, messages: raw('image'), options: { modelCapabilities: { [VISION]: metadata({ vision: true }) } } });
assert.equal(calls.length, 1);
assert(calls[0].body.messages[1].content.some(part => part.type === 'image_url'), 'Recovered vision metadata must reach the provider serializer, preserving the actual image');

events = await collect({ model: TEXT, fallbacks: [VISION], messages: raw('image'), options: { modelCapabilities: { [TEXT]: metadata(), [VISION]: metadata({ vision: true }) } } });
assert.deepEqual(calls.map(call => call.body.model), ['fixture-vision'], 'Recovered text-only metadata rejects the primary before making a request');
assert(events.some(event => event.t === 'model' && event.id === VISION));

events = await collect({ model: TEXT, messages: [{ role: 'user', text: 'A'.repeat(100000) }], options: { modelCapabilities: { [TEXT]: metadata({ context: 32000 }) } } });
assert.equal(calls.length, 0, 'Recovered context limits constrain oversized requests');

events = await collect({ model: TEXT, messages: [{ role: 'user', text: 'A'.repeat(100000) }], options: { modelCapabilities: { [TEXT]: metadata({ context: null }) }, modelContexts: { [TEXT]: 32000 } } });
assert.equal(calls.length, 0, 'An explicit unknown context is bounded and cannot grant infinite capacity');

await catalog({ refresh: true });
events = await collect({ model: TEXT, messages: raw('image'), options: { modelCapabilities: { [TEXT]: metadata({ vision: true }) } } });
assert.equal(calls.length, 0, 'Fresh text-only catalogue metadata overrides a stale recovered vision flag');
events = await collect({ model: TEXT, messages: [{ role: 'user', text: 'A'.repeat(100000) }], options: { modelCapabilities: { [TEXT]: metadata({ context: null }) } } });
assert.equal(calls.length, 0, 'Fresh finite context overrides a stale unknown context');

console.log('PASS missing, recovered and fresh runtime capabilities preserve attachments and honest context limits');
