import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'rolldown';

// Execute Canvas's actual routing/serialization block without initializing the
// browser store. Planning, quota projection and provider recovery remain real;
// only unused Firebase IO and the provider responses are replaced.
const source = readFileSync('src/store.ts', 'utf8');
const action = source.indexOf('async requestCanvasEdit(');
const start = source.indexOf('const routeInput:RouteInput=', action);
const end = source.indexOf('const aborter = new AbortController();', start);
const capabilitiesStart = source.indexOf('function requestCapabilities(');
const capabilitiesEnd = source.indexOf('\n}', capabilitiesStart) + 2;
assert(action >= 0 && start > action && end > start && capabilitiesStart >= 0 && capabilitiesEnd > capabilitiesStart,
  'the fixture must execute the current Canvas request-building code');
const entry = `
  import { analyze, estimateTokens, planRoute } from ${JSON.stringify(resolve('src/lib/routing.ts'))};
  import { planLayout } from ${JSON.stringify(resolve('src/lib/layout-policy.ts'))};
  import { buildChatBody } from ${JSON.stringify(resolve('src/lib/api.ts'))};
  import { buildInstructions } from ${JSON.stringify(resolve('src/lib/ai/instructions.js'))};
  import { choosePreference } from ${JSON.stringify(resolve('src/lib/ai/preferences.js'))};
  import { remaining } from ${JSON.stringify(resolve('src/lib/usage.ts'))};
  import { Masker } from ${JSON.stringify(resolve('src/lib/privacy.ts'))};
  export { runChat } from ${JSON.stringify(resolve('src/lib/ai/chat.js'))};
  export { setKeys } from ${JSON.stringify(resolve('src/lib/ai/providers.js'))};
  export { clearHealth } from ${JSON.stringify(resolve('src/lib/ai/health.js'))};
  ${source.slice(capabilitiesStart, capabilitiesEnd)}
  export function canvasRequest({ selected, settings, catalog, prompt, instructions = '', memoryNote = '', layout, usage, get, asIs = false }) {
    ${source.slice(start, end)}
    return JSON.parse(body);
  }
`;
mkdirSync('node_modules/.cache/unit-tests', { recursive: true });
const output = 'node_modules/.cache/unit-tests/canvas-routing-integration-fixture.mjs';
const fixtureId = '\0canvas-routing-integration.ts';
await build({ input: fixtureId, output: { file: output, format: 'esm' }, logLevel: 'silent', plugins: [{
  name: 'isolated-canvas-routing',
  resolveId(id, importer) {
    if (id === fixtureId) return id;
    if (importer?.endsWith('/usage.ts') && id === './firebase') return '\0canvas-firebase';
    if (importer?.endsWith('/usage.ts') && id === './quota') return '\0canvas-quota';
  },
  load(id) {
    if (id === fixtureId) return entry;
    if (id === '\0canvas-firebase') return 'export const db = {};';
    if (id === '\0canvas-quota') return 'export const quota = {};';
  },
}] });
const { canvasRequest, runChat, setKeys, clearHealth } = await import(pathToFileURL(resolve(output)).href);
setKeys({ gemini: 'synthetic-canvas-google', groq: 'synthetic-canvas-groq' });

const primary = 'gemini:gemini-2.5-flash', outside = 'groq:fixture-ready';
const exhausted = Array.from({ length: 4 }, (_, index) => `gemini:gemini-2.5-flash-lite-${index}`);
const ids = [primary, ...exhausted, outside];
const catalog = { models: ids.map(id => ({
  id, name: id.slice(id.indexOf(':') + 1), label: id, provider: id.startsWith('gemini:') ? 'google' : 'groq',
  context: 128000, vision: false, pdf: false, search: false, thinking: false,
})) };
const layout = { id: 'canvas', name: 'Canvas', icon: 'layers', description: 'Fixture layout', mode: 'auto', models: [primary, ...exhausted], fallback: 'enabled' };
const settings = { enabledModels: ids, autoSwitch: true, autoExcluded: [], privacyShield: false };

for (const readiness of ['blocked', 'remaining-zero']) test(`Canvas preserves ${readiness} readiness before its layout fallback pool can exhaust the attempt budget`, async () => {
  clearHealth();
  const blockedUntil = id => readiness === 'blocked' && exhausted.includes(id) ? Date.now() + 60000 : null;
  const view = {
    models: Object.fromEntries(ids.map(id => [id, {
      id, input: 0, output: 0, quota: 10,
      requests: readiness === 'remaining-zero' && exhausted.includes(id) ? 10 : 0,
      blockedUntil: blockedUntil(id), blockScope: 'day',
    }])),
    openrouter: { used: 0, limit: null, resetAt: Date.now() + 60000 }, geminiResetAt: Date.now() + 60000,
  };
  const request = canvasRequest({ selected: 'layout:canvas', settings, catalog, prompt: 'Improve this paragraph.', layout,
    usage: { blockedUntil }, get: () => ({ usage: view }) });
  assert.deepEqual([request.model, ...request.fallbacks], ids,
    'the real layout planner retains four exhausted assigned rows before the allowed outside fallback');

  const originalFetch = globalThis.fetch, calls = [], events = [];
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    const google = String(url).includes('googleapis');
    calls.push(google ? `gemini:${/models\/([^:]+):/.exec(String(url))[1]}` : `groq:${body.model}`);
    if (google) return Response.json({ error: { message: 'Daily quota exhausted for model' } }, { status: 429 });
    return new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: 'Working canvas edit' }, finish_reason: 'stop' }] })}\n\n`);
  };
  try {
    for await (const event of runChat(request, new AbortController().signal)) events.push(event);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.deepEqual(calls, [primary, outside],
    'known exhausted layout rows must not use all five attempts before an allowed ready backup');
  assert(events.some(event => event.t === 'model' && event.id === outside));
  assert.equal(events.filter(event => event.t === 'text').map(event => event.text).join(''), 'Working canvas edit');
  assert(!events.some(event => event.t === 'error'));
  assert.deepEqual(request.options.blockedModels, exhausted, 'readiness must survive Canvas request serialization');
});
