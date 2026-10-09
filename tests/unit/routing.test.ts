import { planRoute, AUTO } from '../../src/lib/routing';
const M = (id: string, o: any = {}) => ({ id, provider: id.startsWith('gemini:') ? 'google' : 'openrouter', name: id.split(':').slice(1).join(':'), label: id, context: 1_000_000, vision: true, pdf: true, thinking: true, search: true, ...o });
const catalog = [
  M('gemini:gemini-2.5-pro'),
  M('gemini:gemini-flash-latest'),
  M('gemini:gemini-flash-lite-latest'),
  M('gemini:gemma-4-31b-it', { thinking: false, search: false, pdf: false, context: 131_072 }),
  M('openrouter:qwen/qwen3-coder:free', { vision: false, search: false, thinking: false, context: 262_144 }),
  M('openrouter:deepseek/deepseek-r1:free', { vision: false, search: false, thinking: true, context: 163_840 }),
  M('openrouter:meta/llama-3.3-8b:free', { vision: false, search: false, thinking: false, context: 32_000 }),
] as any[];
const enabled = catalog.map((m) => m.id);
let fails = 0;
const plan = (o: any) => planRoute({ selected: AUTO, enabled, catalog, text: '', files: [], conversationTokens: 100, search: false, blocked: () => false, left: () => null, ...o });
const t = (name: string, o: any, expect: (p: any) => boolean) => {
  const p = plan(o);
  const ok = expect(p);
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} → ${p.model}${p.reason ? ` (${p.reason})` : ''}${p.notice ? ` [${p.notice}]` : ''}`);
};
const img = [{ id: '1', kind: 'image', name: 'x.jpg', mime: 'image/jpeg', size: 1000 }];
t('quick hello → light/fast model, not Pro', { text: 'hi, how are you?' }, (p) => /lite|flash/.test(p.model) && !/pro/.test(p.model));
t('image → a model that reads images', { text: 'what is in this photo?', files: img }, (p) => p.reason === 'reads images' && catalog.find((m) => m.id === p.model).vision);
t('plain image question → Flash, saves Pro', { text: 'what is in this photo?', files: img }, (p) => /flash/.test(p.model));
t('image: text-only models never first', { text: 'describe', files: img }, (p) => !/qwen|deepseek|llama/.test(p.model));
t('code question → coder or strong model', { text: 'Fix this python bug:\n```python\ndef f(x): return x+\n```' }, (p) => /coder|pro/.test(p.model) && p.reason === 'good at code');
t('maths → thinking model', { text: 'Solve the equation 3x^2 + 2x - 5 = 0 step by step' }, (p) => catalog.find((m) => m.id === p.model).thinking && p.reason === 'thinks step by step');
t('make a PowerPoint → Gemini (reliable files)', { text: 'Make a PowerPoint presentation about hand hygiene' }, (p) => p.model.startsWith('gemini:gemini') && p.reason === 'reliable at making files');
t('web search on → search-capable Gemini', { text: 'latest WHO news', search: true }, (p) => catalog.find((m) => m.id === p.model).search && p.reason === 'can search the web');
t('Arabic → Gemini', { text: 'اشرح لي أسباب ارتفاع ضغط الدم بالتفصيل وكيف يمكن علاجه' }, (p) => p.model.startsWith('gemini:') && !p.model.includes('gemma'));
t('very long conversation → huge-context model', { text: 'summarise everything so far', conversationTokens: 400_000 }, (p) => catalog.find((m) => m.id === p.model).context >= 400_000 / 0.85);
t('model at its limit is skipped', { text: 'hi there', blocked: (id: string) => /lite/.test(id) }, (p) => !/lite/.test(p.model) && /lite/.test(p.fallbacks.at(-1)));
t('fallbacks contain every other model', { text: 'hello' }, (p) => p.fallbacks.length === enabled.length - 1 && !p.fallbacks.includes(p.model));
t('manual text-only model + image → rerouted with notice', { selected: 'openrouter:qwen/qwen3-coder:free', text: 'what is this?', files: img }, (p) => p.model !== 'openrouter:qwen/qwen3-coder:free' && /can't read images/.test(p.notice));
t('manual model that can handle it → kept', { selected: 'openrouter:deepseek/deepseek-r1:free', text: 'hello' }, (p) => p.model === 'openrouter:deepseek/deepseek-r1:free' && !p.notice);
t('manual small-context model + huge chat → rerouted', { selected: 'openrouter:meta/llama-3.3-8b:free', text: 'continue', conversationTokens: 60_000 }, (p) => p.model !== 'openrouter:meta/llama-3.3-8b:free' && /too small/.test(p.notice));
// Groq / Cerebras: fastest for quick replies; never sent PDFs they can't read.
{
  const G = (id: string, o: any = {}) => ({ ...M(id), provider: id.split(':')[0], vision: false, pdf: false, search: false, thinking: false, context: 131_072, ...o });
  const cat2 = [M('gemini:gemini-flash-latest'), G('groq:llama-3.3-70b-versatile'), G('groq:llama-3.1-8b-instant'), G('cerebras:gpt-oss-120b', { thinking: true })] as any[];
  const en2 = cat2.map((m) => m.id);
  const plan2 = (o: any) => planRoute({ selected: AUTO, enabled: en2, catalog: cat2, text: '', files: [], conversationTokens: 100, search: false, blocked: () => false, left: () => null, ...o });
  const check2 = (name: string, ok: boolean, p: any) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} → ${p.model}${p.notice ? ` [${p.notice}]` : ''}`); };
  let p = plan2({ text: 'thanks! what time zone is Cairo in?' });
  check2('quick question → Groq/Cerebras (fastest)', /^(groq|cerebras):/.test(p.model), p);
  const pdf = [{ id: 'p', kind: 'pdf', name: 'labs.pdf', mime: 'application/pdf', size: 90_000, data: 'x' }];
  p = plan2({ text: 'summarise this', files: pdf });
  check2('PDF → a model that reads PDFs', p.model.startsWith('gemini:'), p);
  p = plan2({ selected: 'groq:llama-3.3-70b-versatile', text: 'summarise this', files: pdf });
  check2('manual Groq + PDF → rerouted with a note', p.model.startsWith('gemini:') && /can't read PDFs/.test(p.notice), p);
  const textPdf = [{ ...pdf[0], text: 'extracted text' }];
  p = plan2({ selected: 'groq:llama-3.3-70b-versatile', text: 'summarise this', files: textPdf });
  check2('PDF already turned into text → Groq is fine', p.model === 'groq:llama-3.3-70b-versatile' && !p.notice, p);
}
// Name checks
import { analyze as _a } from '../../src/lib/routing';
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
const pick = (models: string[], text: string) => planRoute({ selected: AUTO, enabled: models.map((n) => 'openrouter:' + n), catalog: models.map((n) => M('openrouter:' + n, { vision: false, search: false, thinking: false })), text, files: [], conversationTokens: 100, search: false, blocked: () => false, left: () => null }).model;
const q = pick(['vendor/model-70b:free', 'google/gemini-x', 'vendor/tiny-8b:free'], 'hello');
console.log(`${!/70b/.test(q) ? 'PASS' : 'FAIL'}  quick chat avoids the 70B model → ${q}`);
const h = pick(['vendor/model-8b:free', 'vendor/model-70b:free', 'vendor/model-mini:free'], 'Write a detailed technical report as a Word document');
console.log(`${/70b/.test(h) ? 'PASS' : 'FAIL'}  heavy task picks the 70B model → ${h}`);
