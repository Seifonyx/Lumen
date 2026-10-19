import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openStream, setKeys } from '../../src/lib/ai/providers.js';

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const request = (signal,provider='gemini') => openStream({ provider, name: provider==='gemini'?'gemma-3-27b-it':'fixture' }, [{ role: 'user', text: 'Hello' }], { instructions: '', signal });
const OLD = 'KZ_BOUNDARY_PRIVATE_TOKEN_0123456789';
const NEXT = 'QX_REPLACEMENT_PRIVATE_TOKEN_9876543210';

await test('direct openStream aborts an error-body read when credentials change', async () => {
 for(const provider of ['gemini','groq','openrouter']) {
  const entered = deferred(), body = deferred();
  setKeys({ [provider]: OLD });
  globalThis.fetch = async () => ({ ok: false, status: 401, text: () => { entered.resolve(); return body.promise; } });
  const work = request(new AbortController().signal,provider);
  const outcome = work.then(value => ({ value }), error => ({ error }));
  let timer;
  try {
    await entered.promise;
    setKeys({ [provider]: NEXT });
    const result = await Promise.race([outcome, new Promise(resolve => { timer = setTimeout(() => resolve({ pending: true }), 40); })]);
    assert.equal(result.error?.name, 'AbortError', 'Abandoned error-body reads must settle promptly without publishing an old-scope response');
  } finally {
    clearTimeout(timer);
    body.resolve(JSON.stringify({ error: { message: `Rejected ${OLD}` } }));
    await outcome;
    setKeys({});
  }
 }
});

await test('HTTP error redaction runs before the 400-character display truncation', async () => {
  setKeys({ gemini: OLD });
  globalThis.fetch = async () => Response.json({ error: { message: 'x'.repeat(390) + OLD + ' was rejected' } }, { status: 401 });
  try {
    const result = await request(new AbortController().signal);
    assert.equal(result.ok, false);
    assert(!result.message.includes(OLD.slice(0, 8)), 'Truncation must not expose a partial provider credential');
    assert.equal(result.message, 'x'.repeat(390) + '[redacted]', 'The bounded public message must be built from already-redacted text');
  } finally { setKeys({}); }
});

await test('direct adapter events cannot publish buffered frames after a key change',async()=>{
 setKeys({groq:OLD});
 const frame=text=>'data: '+JSON.stringify({choices:[{delta:{content:text}}]})+'\n\n';
 globalThis.fetch=async()=>new Response(frame('Before')+frame('After old scope'));
 const opened=await request(new AbortController().signal,'groq');
 const iterator=opened.events[Symbol.asyncIterator]();
 assert.equal((await iterator.next()).value.text,'Before');
 setKeys({groq:NEXT});
 await assert.rejects(iterator.next(),{name:'AbortError'});
 await iterator.return?.();setKeys({});
});
