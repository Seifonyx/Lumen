import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as P from '../../src/lib/ai/providers.js';
import { DEFAULT_PROVIDER_RELAY_URL, EXTRA_PROVIDERS, normalizeKeys, validAlibabaBase, validRelayUrl } from '../../src/lib/ai/provider-config.js';
import relay from '../../server/provider-relay/worker.mjs';
assert(JSON.parse(readFileSync(new URL('../../server/provider-relay/wrangler.jsonc', import.meta.url))).compatibility_flags.includes('enable_request_signal'), 'Workers incoming cancellation requires enable_request_signal');
const ids = Object.keys(EXTRA_PROVIDERS), calls = [];
const config = { ...Object.fromEntries(ids.map(id => [id, `synthetic-${id}`])), providerAccess: Object.fromEntries(ids.map(id => [id, true])), providerRelayUrl: 'https://relay.example', cloudflareAccountId: 'a'.repeat(32) };
const model = id => id === 'cloudflare' ? '@cf/meta/current-chat' : id === 'aion' ? 'aion-labs/current-chat' : id === 'openai' ? 'gpt-current-chat' : id === 'perplexity' ? 'sonar' : `${id}-current-chat`;
// Every provider lists one chat model, except Perplexity, whose three documented models are built in.
const TOTAL = ids.length - 1 + EXTRA_PROVIDERS.perplexity.models.length;
const stream = body => new Response(`data: ${JSON.stringify(body)}\n\ndata: [DONE]\n\n`, { headers: { 'content-type': 'text/event-stream' } });
let failure = null;
globalThis.fetch = async (url, opts = {}) => {
  const p = ids.find(id => id === 'nvidia' || id === 'cloudflare' ? String(url).includes(`relay.example/${id}`) || String(url).startsWith(`${DEFAULT_PROVIDER_RELAY_URL}/${id}/`) : String(url).includes(EXTRA_PROVIDERS[id].base.replace('/compatibility/v1', ''))) || 'cohere';
  calls.push({ url: String(url), p, opts });
  if (failure?.provider === p) return Response.json({ error: { message: failure.message } }, { status: failure.status, headers: { 'retry-after': '4' } });
  if (String(url).includes('/models')) {
    if (p === 'cohere') return Response.json({ models: [{ name: model(p), endpoints: ['chat'], is_deprecated: false }, { name: 'old-chat', endpoints: ['chat'], is_deprecated: true }, { name: 'embed', endpoints: ['embed'] }] });
    if (p === 'cloudflare') return Response.json({ success: true, result: [{ name: model(p), task: { name: 'Text Generation' } }, { name: '@cf/embed', task: { name: 'Text Embeddings' } }] });
    return Response.json({ data: [{ id: model(p), capabilities: { completion_chat: true, vision: true }, architecture: { input_modalities: ['text', 'image'], output_modalities: ['text'] }, providers: [{ status: 'live' }], context_length: 100000 }, { id: 'embed-model' }, { id: 'retired-chat', status: 'retired' }, { id: '../bad' }, {}, ...(p === 'nvidia' ? [{ id: 'nvidia/nemotron-4-340b-reward' }, { id: 'nvidia/ai-synthetic-video-detector' }, { id: 'nvidia/nvclip' }] : [])] });
  }
  const body = JSON.parse(opts.body);
  if (body.stream) return stream({ choices: [{ delta: { content: `Hello ${p}`, reasoning_content: 'Reasoning' }, finish_reason: 'stop' }], usage: { prompt_tokens: 12, completion_tokens: 8 } });
  return Response.json({ choices: [{ message: { content: 'Title' } }], usage: { prompt_tokens: 3, completion_tokens: 2 } });
};
P.setKeys(config);
let catalogue = await P.catalog({ refresh: true });
assert.equal(catalogue.errors.length, 0);
assert.equal(catalogue.models.length, TOTAL);
for (const id of ids) {
  assert(P.hasKey(id));
  assert(catalogue.models.some(m => m.id === `${id}:${model(id)}`));
  assert(catalogue.defaults.includes(`${id}:${model(id)}`));
  const out = await P.openStream(P.parseModelId(`${id}:${model(id)}`), [{ role: 'user', text: 'hello' }], { instructions: 'Be concise', signal: new AbortController().signal });
  assert(out.ok);
  const events = []; for await (const e of out.events) events.push(e);
  assert(events.some(e => e.t === 'text' && e.text === `Hello ${id}`));
  assert(events.some(e => e.t === 'think'));
  assert(events.some(e => e.t === 'usage' && e.input === 12 && e.output === 8));
  const sent = calls.at(-1);
  assert.equal(new Headers(sent.opts.headers).get('authorization'), `Bearer synthetic-${id}`);
  assert.equal(JSON.parse(sent.opts.body).messages[0].role, 'system');
  const info = {};
  assert.equal(await P.complete({ provider: id, name: model(id) }, 'title', { info }), 'Title');
  assert.equal(info.input, 3);
}
assert(calls.some(c => c.url === 'https://api.cohere.ai/v1/models?endpoint=chat'));
assert(calls.some(c => c.url.startsWith('https://relay.example/cloudflare/models') && new Headers(c.opts.headers).get('x-mr-account-id') === 'a'.repeat(32)));
P.setKeys({ ...config, providerRelayUrl: '' });
assert.equal((await P.catalog({ refresh: true })).models.length, TOTAL);
assert(calls.some(c => c.url.startsWith(`${DEFAULT_PROVIDER_RELAY_URL}/nvidia/models`)));
assert(calls.some(c => c.url.startsWith(`${DEFAULT_PROVIDER_RELAY_URL}/cloudflare/models`)));
P.setKeys({ ...config, providerAccess: {} });
const before = calls.length;
assert.equal((await P.catalog({ refresh: true })).models.length, 0);
for (const id of ids) {
  assert(!P.hasKey(id));
  assert.equal((await P.openStream({ provider: id, name: model(id) }, [], {})).status, 403);
  assert.equal(await P.complete({ provider: id, name: model(id) }, 'do not send'), null);
}
assert.equal(calls.length, before, 'Disabled providers make no catalogue/inference calls');
P.setKeys(config);
failure = { provider: 'deepseek', status: 429, message: 'quota exceeded' };
const limited = await P.openStream({ provider: 'deepseek', name: model('deepseek') }, [{ role: 'user', text: 'hi' }], { signal: new AbortController().signal });
assert.equal(limited.status, 429); assert.equal(limited.limit.retryAfterSec, 4);
catalogue = await P.catalog({ refresh: true });
assert.deepEqual(catalogue.failedProviders, ['deepseek']);
assert.equal(catalogue.models.length, TOTAL - 1);
failure = null;
assert.equal(P.parseModelId('cloudflare:@cf/meta/model').provider, 'cloudflare');
assert.equal(P.parseModelId('githubmodels:retired'), null);
assert.equal(P.parseModelId('aion:../escape'), null);
assert(!validAlibabaBase('https://evil.example/compatible-mode/v1'));
assert(!validAlibabaBase('https://dashscope-intl.aliyuncs.com.evil.example/compatible-mode/v1'));
assert(validAlibabaBase('https://workspace.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1'));
assert(!validRelayUrl('https://name:password@example.com'));
assert(!validRelayUrl('http://relay.example'));
assert.equal(normalizeKeys({ providerAccess: { aion: 'true' } }).providerAccess.aion, false);
P.setKeys({}); assert(ids.every(id => !P.hasKey(id)), 'Account reset clears opt-ins and keys');

let pages = 0;
P.setKeys({ cohere: 'synthetic-cohere', providerAccess: { cohere: true } });
globalThis.fetch = async url => {
  pages++;
  if (pages === 2) assert(String(url).includes('page_token=next'));
  return Response.json({ models: [{ name: `command-current-${pages}`, endpoints: ['chat'] }], ...(pages === 1 ? { next_page_token: 'next' } : {}) });
};
assert.equal((await P.catalog({ refresh: true })).models.length, 2);
assert.equal(pages, 2, 'Native Cohere pagination is followed');
globalThis.fetch = async () => Response.json({ models: [], next_page_token: 'repeated' });
assert.deepEqual((await P.catalog({ refresh: true })).failedProviders, ['cohere']);

P.setKeys({ mistral: 'old-synthetic', providerAccess: { mistral: true } });
let release;
globalThis.fetch = () => new Promise(resolve => { release = resolve; });
const stale = P.catalog({ refresh: true });
P.setKeys({});
release(Response.json({ data: [{ id: 'old-account-model', capabilities: { completion_chat: true } }] }));
await assert.rejects(stale, /settings changed/);
assert.equal((await P.catalog()).models.length, 0, 'Late catalogue cannot repopulate the next account');

// Backend forwarding is tested independently of frontend route mocks.
let relayCall;
globalThis.fetch = async (url, opts) => { relayCall = { url, opts }; return stream({ choices: [{ delta: { content: 'Relayed' } }] }); };
const req = (path, opts = {}) => new Request(`https://relay.example${path}`, { headers: { origin: 'https://model-router.web.app', authorization: 'Bearer synthetic', 'content-type': 'application/json', 'x-mr-account-id': 'a'.repeat(32) }, ...opts });
let res = await relay.fetch(req('/nvidia/models'));
assert.equal(res.status, 200); assert.equal(relayCall.url, 'https://integrate.api.nvidia.com/v1/models');
assert.equal(res.headers.get('access-control-allow-origin'), 'https://model-router.web.app');
res = await relay.fetch(req('/cloudflare/models?page=2'));
assert(relayCall.url.endsWith('/ai/models/search?per_page=100&page=2'));
res = await relay.fetch(req('/cloudflare/chat/completions', { method: 'POST', body: JSON.stringify({ model: '@cf/meta/current', messages: [{ role: 'user', content: 'hi' }], stream: true }) }));
assert.equal(res.status, 200); assert((await res.text()).includes('Relayed'));
assert.equal(relayCall.opts.headers.authorization, 'Bearer synthetic');
assert.equal((await relay.fetch(req('/nvidia/models', { method: 'OPTIONS' }))).status, 204);
assert.equal((await relay.fetch(req('/arbitrary/models'))).status, 404);
assert.equal((await relay.fetch(req('/cloudflare/models?page=evil'))).status, 400);
assert.equal((await relay.fetch(req('/nvidia/models', { headers: { origin: 'https://evil.example' } }))).status, 403);
assert.equal((await relay.fetch(req('/nvidia/models', { headers: { origin: 'https://model-router.web.app' } }))).status, 401);
assert.equal((await relay.fetch(req('/nvidia/chat/completions', { method: 'POST', body: 'invalid' }))).status, 400);
assert.equal(relayCall.opts.redirect, 'manual');
globalThis.fetch = async () => new Response(null, { status: 302, headers: { location: 'https://untrusted.example' } });
assert.equal((await relay.fetch(req('/nvidia/models'))).status, 502, 'Relay refuses redirects without forwarding credentials');
// 2.6: the relay also stands in for providers that refuse browser requests, but only at their official address.
let forwarded = '';
globalThis.fetch = async (url) => { forwarded = String(url); return Response.json({ data: [] }); };
assert.equal((await relay.fetch(req('/sambanova/models'))).status, 200);
assert.equal(forwarded, 'https://api.sambanova.ai/v1/models');
assert.equal((await relay.fetch(req('/openai/models'))).status, 404, 'providers that allow browser calls are not relayed');
assert.equal((await relay.fetch(req('/constructor/models'))).status, 404);
// In the app: Claude gets its own headers; a refused browser request (no CORS) retries through the relay.
const sent = [];
globalThis.fetch = async (url, opts = {}) => {
  sent.push({ url: String(url), headers: new Headers(opts.headers) });
  if (String(url).startsWith('https://api.sambanova.ai')) throw new TypeError('Failed to fetch');
  return Response.json({ data: [{ id: 'claude-current', display_name: 'Claude Current', created_at: '2026-05-01T00:00:00Z' }, { id: 'sambanova-chat' }] });
};
P.setKeys({ anthropic: 'synthetic-claude', sambanova: 'synthetic-samba', providerAccess: { anthropic: true, sambanova: true }, providerRelayUrl: 'https://relay.example' });
const both = await P.catalog({ refresh: true });
const claude = sent.find(c => c.url.startsWith('https://api.anthropic.com'));
assert.equal(claude.headers.get('x-api-key'), 'synthetic-claude');
assert.equal(claude.headers.get('anthropic-dangerous-direct-browser-access'), 'true');
assert(both.models.some(m => m.id === 'anthropic:claude-current' && m.label === 'Claude Current'));
assert(sent.some(c => c.url === 'https://relay.example/sambanova/models'), 'falls back to the relay');
assert(both.models.some(m => m.id === 'sambanova:sambanova-chat'));
console.log('PASS all provider adapters, opt-ins, usage, limits, model safety and relay forwarding');
