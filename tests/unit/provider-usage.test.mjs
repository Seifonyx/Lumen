import assert from 'node:assert/strict';
import { build } from 'rolldown';
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
mkdirSync('node_modules/.cache/unit-tests', { recursive: true });
const file = 'node_modules/.cache/unit-tests/provider-usage-fixture.mjs';
await build({ input: 'src/lib/usage.ts', output: { file, format: 'esm' }, logLevel: 'silent', plugins: [{
  name: 'isolated-provider-usage',
  resolveId(source, importer) {
    if (source === 'firebase/firestore') return '\0firestore';
    if (importer?.endsWith('usage.ts') && source === './firebase') return '\0firebase';
    if (importer?.endsWith('usage.ts') && source === './quota') return '\0quota';
  },
  load(id) {
    if (id === '\0firebase') return 'export const db = {};';
    if (id === '\0quota') return "export const quota = {level:()=> 'normal', count:()=>{}, subscribe:()=>()=>{}};";
    if (id === '\0firestore') return 'export const writes=[]; export const doc=(db,...parts)=>parts.join("/"); export const increment=n=>n; export const onSnapshot=()=>()=>{}; export const setDoc=async(path,data)=>{globalThis.__usageWrites.push({path,data});};';
  },
}] });
globalThis.__usageWrites = [];
const { UsageTracker, providerOf, dayKey } = await import(pathToFileURL(resolve(file)).href);
const providers = ['mistral', 'cohere', 'nvidia', 'huggingface', 'deepseek', 'alibaba', 'cloudflare', 'aion'];
const tracker = new UsageTracker('synthetic-account', () => {});
tracker.useProviders(providers);
for (const provider of providers) {
  const id = `${provider}:current-chat`;
  assert.equal(providerOf(id), provider);
  tracker.record(id, { requests: 1, input: 10, output: 5 });
  assert(globalThis.__usageWrites.some(w => w.path.endsWith(dayKey(provider)) && Object.values(w.data.m || {}).some(m => m.id === id && m.requests === 1 && m.input === 10 && m.output === 5)));
  tracker.block(id, { scope: 'day', resetAt: Date.now() + 10000, quota: 12 });
  assert(globalThis.__usageWrites.some(w => w.path.endsWith(dayKey(provider)) && Object.values(w.data.b || {}).some(b => b.id === id && b.quota === 12)));
}
assert.equal(tracker.view().openrouter.used, 0, 'New gateways never consume the OpenRouter free pool');
assert(globalThis.__usageWrites.every(w => !w.path.includes('/usage/openrouter-')));
tracker.stop();
console.log('PASS all eight providers have separate usage counts, token totals and quota blocks');
