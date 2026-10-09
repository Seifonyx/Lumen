import { allLayouts, findLayout, recommendedLayouts } from '../../src/lib/layouts';
let fails = 0;
const check = (c: boolean, l: string) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) fails++; };
const m = (id: string, o: any = {}) => ({ id, provider: id.split(':')[0] === 'gemini' ? 'google' : id.split(':')[0], name: id.split(':').slice(1).join(':'), label: id, context: 1e6, vision: false, pdf: true, thinking: false, search: false, ...o });
const catalog = [
  'gemini:gemini-flash-latest', 'gemini:gemini-flash-lite-latest', 'gemini:gemini-2.5-pro', 'gemini:gemma-4-31b-it',
  'openrouter:qwen/qwen3-coder:free', 'openrouter:deepseek/deepseek-r1:free', 'openrouter:moonshotai/kimi-k2:free',
  'groq:llama-3.3-70b-versatile', 'groq:llama-3.1-8b-instant', 'groq:openai/gpt-oss-120b',
  'cerebras:gpt-oss-120b', 'cerebras:llama3.1-8b', 'cerebras:qwen-3-235b-a22b-thinking-2507',
].map((id) => m(id)) as any[];
const L = Object.fromEntries(recommendedLayouts(catalog).map((l) => [l.id, l]));
check(L.coding.models[0] === 'openrouter:qwen/qwen3-coder:free' && L.coding.models.includes('gemini:gemini-2.5-pro') && L.coding.models.includes('openrouter:moonshotai/kimi-k2:free'), `Max coding: ${L.coding.models.join(', ')}`);
check(L.coding.mode === 'order' && /software engineer/.test(L.coding.instructions || ''), 'coding runs in order with coding instructions');
check(L.everyday.mode === 'auto' && L.everyday.models[0] === 'gemini:gemini-flash-latest', `Everyday: ${L.everyday.models.join(', ')}`);
check(L.thinking.models[0] === 'gemini:gemini-2.5-pro' && L.thinking.models.includes('openrouter:deepseek/deepseek-r1:free'), `Deep thinking: ${L.thinking.models.join(', ')}`);
check(L.fast.models.slice(0, 2).every((id: string) => id.startsWith('cerebras:')) && L.fast.models.some((id: string) => id.startsWith('groq:')), `Fastest: ${L.fast.models.join(', ')}`);
check(L.arabic.models[0].startsWith('gemini:') && L.documents.models.every((id: string) => id.startsWith('gemini:')), 'Arabic and Documents prefer Gemini');
const geminiOnly = recommendedLayouts(catalog.filter((x) => x.id.startsWith('gemini:')));
check(geminiOnly.find((l) => l.id === 'coding')!.models[0] === 'gemini:gemini-2.5-pro' && geminiOnly.find((l) => l.id === 'fast')!.models[0] === 'gemini:gemini-flash-lite-latest', 'works with only a Gemini key');
const custom = [{ id: 'custom-1', name: 'Web apps', icon: 'code', description: '', models: ['groq:llama-3.3-70b-versatile'], mode: 'order' }] as any[];
check(findLayout('layout:custom-1', catalog, custom)?.name === 'Web apps' && findLayout('layout:coding', catalog, custom)?.builtin === true && !findLayout('layout:nope', catalog, custom), 'finding layouts by id');
const edited = [...custom, { id: 'coding', name: 'My coding', icon: 'code', description: 'mine', models: ['groq:openai/gpt-oss-120b'], mode: 'auto' }] as any[];
const all = allLayouts(catalog, edited, ['arabic']);
const coding = all.find((l) => l.id === 'coding')!;
check(coding.name === 'My coding' && coding.edited === true && coding.builtin === true && all.indexOf(coding) === 0, 'an edited recommended layout replaces it in place');
check(all.filter((l) => l.id === 'coding').length === 1 && all.at(-1)!.id === 'custom-1', 'edited recommended layouts are not listed twice');
check(!all.some((l) => l.id === 'arabic') && !findLayout('layout:arabic', catalog, edited, ['arabic']) && findLayout('layout:arabic', catalog, edited)?.name === 'Arabic', 'removed recommended layouts are hidden');
check(findLayout('layout:coding', catalog, edited)?.models[0] === 'groq:openai/gpt-oss-120b', 'routing uses the edited models');
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
