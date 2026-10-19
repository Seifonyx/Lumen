import assert from 'node:assert/strict';
import { runChat } from '../../src/lib/ai/chat.js';
import { catalog, setKeys } from '../../src/lib/ai/providers.js';
import { clearHealth, noteFailure } from '../../src/lib/ai/health.js';

setKeys({ gemini: 'fixture', groq: 'fixture', perplexity: 'fixture', providerAccess: { perplexity: true } });
let reject = 0;
const calls = [];
globalThis.fetch = async (url, options) => {
  const body = JSON.parse(options.body);
  calls.push({ url: String(url), body });
  if (reject-- > 0) return Response.json({ error: { message: 'Unsupported thinkingConfig parameter in generation configuration' } }, { status: 400 });
  const event = String(url).includes('googleapis')
    ? { candidates: [{ content: { parts: [{ text: 'Fixture answer' }] }, finishReason: 'STOP' }] }
    : { choices: [{ delta: { content: 'Fixture answer' }, finish_reason: 'stop' }] };
  return new Response('data: ' + JSON.stringify(event) + '\n\n');
};
const collect = async (model, options = { search: true }, fallbacks = []) => {
  calls.length = 0;
  clearHealth();
  const events = [];
  for await (const event of runChat({ model, fallbacks, messages: [{ role: 'user', text: 'Latest news' }], options }, new AbortController().signal)) events.push(event);
  return events;
};

reject = 1;
let events = await collect('gemini:gemini-2.5-flash');
assert.equal(calls.length, 2, 'An unsupported thinking configuration may retry once');
assert.deepEqual(calls[1].body.tools, [{ google_search: {} }], 'A retry must retain requested Google Search');
assert.equal(calls[1].body.generationConfig, undefined);
assert(events.some(event => event.t === 'text'));

reject = 2;
events = await collect('gemini:gemini-2.5-flash');
assert(events.some(event => event.t === 'error'), 'A rejected search must fail honestly rather than answer without it');
assert(calls.every(call => call.body.tools?.some(tool => tool.google_search)));

reject = 1;
events = await collect('gemini:gemini-2.5-flash', { search: true, requireSearch: true });
assert.equal(calls.length, 1, 'Strict research/task search still refuses retries that can remove requested tools');
assert(events.some(event => event.t === 'error'));

reject = 0;
events = await collect('perplexity:sonar');
assert(!events.some(event => event.t === 'notice' && /did not search|only works with Gemini/i.test(event.text)), 'Native Sonar search must not get a false no-search notice');

events = await collect('gemini:gemma-4-31b-it');
assert(events.some(event => event.t === 'notice' && /did not search/i.test(event.text)), 'A Google-hosted model without search gets an honest no-search notice');
assert.equal(calls[0].body.tools, undefined);

events = await collect('groq:fixture-text');
assert(events.some(event => event.t === 'notice' && /did not search/i.test(event.text)));
assert(!events.some(event => event.t === 'notice' && /only works with Gemini/i.test(event.text)), 'Search notices must not claim Gemini is the only searchable provider');

const PRIMARY = 'gemini:gemini-2.5-flash', SEARCH = 'gemini:gemini-2.5-flash-lite', TEXT = 'groq:fixture-text';
const capability = (search) => ({ context: 128000, vision: false, pdf: false, search });
const searchOptions = { search: true, modelCapabilities: { [PRIMARY]: capability(true), [SEARCH]: capability(true), [TEXT]: capability(false) } };
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  if (String(url).includes('/gemini-2.5-flash:')) {
    calls.push({ url: String(url), body: JSON.parse(options.body) });
    return Response.json({ error: { message: 'Temporary overload' } }, { status: 503 });
  }
  return originalFetch(url, options);
};
events = await collect(PRIMARY, searchOptions, [SEARCH, TEXT]);
assert.deepEqual(events.filter(event => event.t === 'model').map(event => event.id), [SEARCH], 'A healthy searchable backup must answer before an unrelated provider that cannot search');
assert.equal(calls.length, 2);
assert(calls[1].url.includes('/gemini-2.5-flash-lite:'));
assert.deepEqual(calls[1].body.tools, [{ google_search: {} }]);

events = await collect(TEXT, searchOptions, [SEARCH]);
assert.equal(calls.length, 1, 'A compatible manual choice stays first even when a searchable backup exists');
assert(events.some(event => event.t === 'model' && event.id === TEXT));

events = await collect(PRIMARY, { ...searchOptions, preferredModels: [PRIMARY, TEXT] }, [SEARCH, TEXT]);
assert(events.some(event => event.t === 'model' && event.id === TEXT), 'Ready layout models stay ahead of ready models outside the layout');

events = await collect(PRIMARY, { ...searchOptions, preferredModels: [PRIMARY] }, [TEXT, SEARCH]);
assert(events.some(event => event.t === 'model' && event.id === SEARCH), 'The outside pool starts with its searchable candidate, preserving only the actual manual choice first');

const SONAR = 'perplexity:sonar';
events = await collect(PRIMARY, { ...searchOptions, modelCapabilities: { ...searchOptions.modelCapabilities, [SONAR]: capability(true) } }, [SEARCH, SONAR, TEXT]);
assert(events.some(event => event.t === 'model' && event.id === SONAR), 'Searchable fallbacks still diversify providers before retrying the same one');
assert.equal(calls.length, 2);

events = await collect(PRIMARY, { ...searchOptions, preferredModels: [PRIMARY], modelCapabilities: { ...searchOptions.modelCapabilities, [SONAR]: capability(true) } }, [SEARCH, SONAR, TEXT]);
assert(events.some(event => event.t === 'model' && event.id === SONAR), 'Provider counts remain anchored to the actual primary when leaving its preferred layout pool');
assert.equal(calls.length, 2);

calls.length = 0;
clearHealth();
noteFailure(SEARCH, 503);
events = [];
for await (const event of runChat({ model: PRIMARY, fallbacks: [SEARCH, TEXT], messages: [{ role: 'user', text: 'Latest news' }], options: searchOptions }, new AbortController().signal)) events.push(event);
assert(events.some(event => event.t === 'model' && event.id === TEXT), 'A healthy non-search fallback precedes a cooling searchable model');
assert(events.some(event => event.t === 'notice' && /did not search/i.test(event.text)), 'The final non-search fallback remains explicit about degradation');

const quotaBlocked = Array.from({ length: 4 }, (_, index) => `gemini:gemini-2.5-flash-lite-${index}`);
const quotaOptions = { ...searchOptions, blockedModels: quotaBlocked, modelCapabilities: { ...searchOptions.modelCapabilities, ...Object.fromEntries(quotaBlocked.map(id => [id, capability(true)])) } };
globalThis.fetch = async (url, options) => {
  if (String(url).includes('googleapis')) {
    calls.push({ url: String(url), body: JSON.parse(options.body) });
    return Response.json({ error: { message: 'Daily quota exhausted' } }, { status: 429 });
  }
  return originalFetch(url, options);
};
events = await collect(PRIMARY, quotaOptions, [TEXT, ...quotaBlocked]);
assert(events.some(event => event.t === 'model' && event.id === TEXT), 'Ready text fallback must answer before known quota-blocked search models consume the five-attempt cap');
assert.equal(calls.length, 2);
assert.deepEqual(events.filter(event => event.t === 'attempt').map(event => event.id), [PRIMARY, TEXT]);

events = await collect(PRIMARY, { ...quotaOptions, blockedModels: [PRIMARY, ...quotaBlocked] }, [TEXT, ...quotaBlocked]);
assert.deepEqual(events.filter(event => event.t === 'attempt').map(event => event.id), [PRIMARY, TEXT], 'An explicitly chosen primary stays first even when its recorded quota is exhausted');

events = await collect(PRIMARY, { ...quotaOptions, preferredModels: [PRIMARY, ...quotaBlocked] }, [TEXT, ...quotaBlocked]);
assert.deepEqual(events.filter(event => event.t === 'attempt').map(event => event.id), [PRIMARY, TEXT], 'Four exhausted preferred layout rows must not consume the attempt budget before an allowed ready outside fallback');
assert(events.some(event => event.t === 'model' && event.id === TEXT));
assert.equal(calls.length, 2, 'Known exhausted layout rows stay behind the working outside fallback');

globalThis.fetch = async (url, options) => {
  if (String(url).includes('api.groq.com')) {
    calls.push({ url: String(url), body: JSON.parse(options.body) });
    return Response.json({ error: { message: 'Temporary overload' } }, { status: 503 });
  }
  return originalFetch(url, options);
};
events = await collect(TEXT, { ...searchOptions, blockedModels: [SEARCH] }, [SEARCH]);
assert(events.some(event => event.t === 'model' && event.id === SEARCH), 'A quota-blocked model remains available as the final resort after ready candidates fail');
assert.equal(calls.length, 2);

const GEMMA = 'gemini:gemma-4-31b-it';
globalThis.fetch = async (url, options = {}) => {
  if (String(url).includes('/models?')) return Response.json({ models: [SEARCH, GEMMA].map(id => ({ name: `models/${id.split(':')[1]}`, inputTokenLimit: 128000, supportedGenerationMethods: ['generateContent'] })) });
  if (String(url).endsWith('/models')) return Response.json({ data: [{id:'fixture-text',context_window:128000,architecture:{input_modalities:['text']}}] });
  if (String(url).includes('api.groq.com')) {
    calls.push({ url: String(url), body: JSON.parse(options.body) });
    return Response.json({ error: { message: 'Temporary overload' } }, { status: 503 });
  }
  return originalFetch(url, options);
};
await catalog({ refresh: true });
events = await collect(TEXT, { search: true, modelCapabilities: { [TEXT]: capability(false), [GEMMA]: capability(true), [SEARCH]: capability(false) } }, [GEMMA, SEARCH]);
assert(events.some(event => event.t === 'model' && event.id === SEARCH), 'Fresh searchable metadata overrides cached false flags, and fresh false flags override cached true ones');
assert.equal(calls.length, 2);
assert(calls[1].url.includes('/gemini-2.5-flash-lite:'));

console.log('PASS Search survives retries and failover while preserving manual choices, readiness, layout preference, diversity and fresh metadata');
