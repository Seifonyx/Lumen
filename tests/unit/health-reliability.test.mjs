import assert from 'node:assert/strict';
import { runChat } from '../../src/lib/ai/chat.js';
import { setKeys } from '../../src/lib/ai/providers.js';
import { clearHealth, clearRecord, noteFailure, noteSuccess, reliability } from '../../src/lib/ai/health.js';

const ID = 'groq:fixture-model';
setKeys({ groq: 'invalid-fixture' });
const attempts = async (status, message) => {
  globalThis.fetch = async () => Response.json({ error: { message } }, { status });
  const all = [];
  for (let i = 0; i < 4; i++) {
    for await (const event of runChat({ model: ID, messages: [{ role: 'user', text: 'hello' }] }, new AbortController().signal)) all.push(event);
  }
  return all;
};

clearHealth(); clearRecord();
await attempts(401, 'Invalid API key');
assert.equal(reliability(ID), null, 'Invalid credentials must not become model failures');
setKeys({ groq: 'corrected-fixture' });
assert.equal(reliability(ID), null, 'Correcting a key must not inherit authentication-related model penalties');

clearHealth(); clearRecord();
await attempts(403, 'This API key is not allowed for this website');
assert.equal(reliability(ID), null, 'Credential-related 403s must not poison model reliability');

clearHealth(); clearRecord();
const refused = await attempts(403, 'This model is not available for this account');
assert(refused.some(event => event.t === 'unavailable' && event.id === ID));
assert(reliability(ID) < 0.5, 'An actual model-access failure remains part of its track record');

clearHealth(); clearRecord();
for (let i = 0; i < 4; i++) noteSuccess(ID);
const successful = reliability(ID);
for (let i = 0; i < 4; i++) noteFailure(ID, 429);
assert(Math.abs(reliability(ID) - successful) < 0.001, 'Ordinary quota still says nothing about quality');
setKeys({ groq: 'another-fixture' });
assert(reliability(ID) > 0.5, 'Replacing credentials preserves real successful model history');
clearHealth(); clearRecord();

console.log('PASS authentication and quota failures do not poison reliability while model-access failures and successes remain meaningful');
