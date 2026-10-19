import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'rolldown';

// Run the real research planner/search callers and UsageTracker in a private
// preview account. Firebase IO is unused; provider discovery/inference is mocked.
const source = readFileSync('src/store.ts', 'utf8');
const closure = name => {
  const start = source.indexOf(`  const ${name} =`);
  const end = source.indexOf('\n  };', start) + 5;
  assert(start >= 0 && end > start, `the current ${name} closure must be exercised`);
  return source.slice(start, end);
};
const functionSource = name => {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf('\n}', start) + 2;
  assert(start >= 0 && end > start, `the current ${name} function must be exercised`);
  return source.slice(start, end);
};
const entry = `
  import { AUTO, estimateTokens } from ${JSON.stringify(resolve('src/lib/routing.ts'))};
  import { selectedModel } from ${JSON.stringify(resolve('src/lib/model-selection.ts'))};
  import { helperModels } from ${JSON.stringify(resolve('src/lib/helper-routing.ts'))};
  import { layoutModelProblem, layoutPolicy } from ${JSON.stringify(resolve('src/lib/layout-policy.ts'))};
  import { findLayout, isLayoutId } from ${JSON.stringify(resolve('src/lib/layouts.ts'))};
  import { isCoolingDown } from ${JSON.stringify(resolve('src/lib/ai/health.js'))};
  import { keyVersion } from ${JSON.stringify(resolve('src/lib/ai/providers.js'))};
  import { UsageTracker, remaining } from ${JSON.stringify(resolve('src/lib/usage.ts'))};
  import { buildChatBody, fetchSummary, streamChat } from ${JSON.stringify(resolve('src/lib/api.ts'))};
  import { modelProblem } from ${JSON.stringify(resolve('src/lib/ai/eligibility.js'))};
  import { toolModel } from ${JSON.stringify(resolve('src/lib/ai/tool-inputs.js'))};
  import { comparisonSnapshotKey, titleSnapshotKey } from ${JSON.stringify(resolve('src/lib/comparison-snapshot.ts'))};
  import { planPrompt, parsePlan as parseResearchPlan, searchPrompt } from ${JSON.stringify(resolve('src/lib/research.ts'))};
  export { setKeys, restoreCatalog } from ${JSON.stringify(resolve('src/lib/ai/providers.js'))};
  ${functionSource('modelInfo')}
  ${functionSource('requestCapabilities')}
  export async function researchRun(state) {
    const get = () => state, accountGeneration = 0;
    const usage = new UsageTracker('preview-research-readiness', view => { state.usage = view; });
    usage.start();
    ${closure('modelFor')}
    ${closure('summaryModels')}
    ${closure('helperScope')}
    ${closure('scopedSummary')}
    ${closure('runResearch')}
    const reply = {};
    try {
      const steps = await runResearch(reply, 'Research solar energy.', new AbortController().signal, () => {}, accountGeneration, state.chat);
      return { steps, usage: usage.view() };
    } finally { usage.stop(); }
  }
`;
mkdirSync('node_modules/.cache/unit-tests', { recursive: true });
const output = 'node_modules/.cache/unit-tests/research-readiness-integration-fixture.mjs';
const fixtureId = '\0research-readiness-integration.ts';
await build({ input: fixtureId, output: { file: output, format: 'esm' }, logLevel: 'silent', plugins: [{
  name: 'isolated-research-readiness',
  resolveId(id, importer) {
    if (id === fixtureId) return id;
    if (importer?.endsWith('/usage.ts') && id === './firebase') return '\0research-firebase';
    if (importer?.endsWith('/usage.ts') && id === './quota') return '\0research-quota';
  },
  load(id) {
    if (id === fixtureId) return entry;
    if (id === '\0research-firebase') return 'export const db = {};';
    if (id === '\0research-quota') return 'export const quota = { level: () => "normal", count() {} };';
  },
}] });
const { researchRun, setKeys, restoreCatalog } = await import(pathToFileURL(resolve(output)).href);

test('later research queries use fresh quota readiness within the original permitted search pool', async () => {
  const exhausted = Array.from({ length: 5 }, (_, index) => `gemini:gemini-2.5-flash-lite-${index}`);
  const ready = 'gemini:gemini-2.5-flash-lite-ready', outside = 'gemini:gemini-2.5-flash-outside';
  const assigned = [...exhausted, ready], ids = [...assigned, outside];
  const models = ids.map(id => ({ id, name: id.split(':')[1], label: id, provider: 'google',
    context: 128000, vision: false, pdf: false, search: true, thinking: false }));
  const layout = { id: 'research', name: 'Research', icon: 'flask', description: 'Fixture',
    mode: 'order', models: assigned, fallback: 'layout', requirements: { capabilities: ['search'] } };
  const chat = { id: 'research-chat', model: 'layout:research', messages: [] };
  const state = { chat, chats: [chat], memories: [], catalog: { models, defaults: ids }, settings: {
    enabledModels: ids, autoSwitch: true, autoExcluded: [], layouts: [layout], privacyShield: false,
  } };
  setKeys({ gemini: 'synthetic-research-readiness' }); restoreCatalog(state.catalog);
  const queries = Array.from({ length: 6 }, (_, index) => `solar energy topic ${index}`);
  const originalFetch = globalThis.fetch, searches = [], planning = [];
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body), id = `gemini:${/models\/([^:]+):/.exec(String(url))[1]}`;
    if (String(url).includes(':generateContent')) {
      planning.push(id);
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(queries) }] }, finishReason: 'STOP' }] });
    }
    const query = body.contents.flatMap(item => item.parts).map(part => part.text || '').join('\n').match(/Search the web for: ([^\n]+)/)?.[1];
    searches.push({ id, query, tools: body.tools, maxTokens: body.generationConfig?.maxOutputTokens });
    if (exhausted.includes(id)) return Response.json({ error: { message: 'Daily search quota exhausted for model' } }, { status: 429 });
    return new Response(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: `Verified notes for ${query}.` }] }, finishReason: 'STOP' }] })}\n\n`);
  };
  let result;
  try { result = await researchRun(state); } finally { globalThis.fetch = originalFetch; }
  assert.deepEqual(planning, [exhausted[0]], 'the actual planner runs once before search quota is learned');
  assert(result.usage.models[exhausted[4]].blockedUntil > Date.now(), 'failed searches update the real usage tracker');
  assert.deepEqual(result.steps.map(step => step.status), ['failed', 'failed', 'done', 'done', 'done', 'done'],
    'later queries must reach the ready sixth assignment after earlier searches learn five quota blocks');
  for (const query of queries.slice(2)) assert.deepEqual(searches.filter(call => call.query === query).map(call => call.id), [exhausted[0], ready],
    'fresh readiness keeps the original first choice and moves the ready backup before known exhausted siblings');
  assert.equal(searches.length, 18, 'two initial five-attempt searches then four two-attempt recoveries remain bounded');
  assert(searches.every(call => assigned.includes(call.id)), 'recovery cannot broaden the layout-authorized pool');
  assert(searches.every(call => call.tools?.some(tool => tool.google_search) && call.maxTokens === 4096),
    'research retains strict search and its answer allowance across recovery');
});
