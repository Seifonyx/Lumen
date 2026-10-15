import { allLayouts, findLayout, recommendedLayouts } from '../../src/lib/layouts';
let fails = 0;
const check = (c: boolean, l: string) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) fails++; };
const m = (id: string, o: any = {}) => ({ id, provider: id.split(':')[0] === 'gemini' ? 'google' : id.split(':')[0], name: id.split(':').slice(1).join(':'), label: id, context: 1e6, vision: id.startsWith('gemini:'), pdf: true, thinking: /gemini-(2\.5|flash)|thinking|r1/.test(id) && !/lite/.test(id), search: id.startsWith('gemini:'), ...o });
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
check(L.fast.models[0].startsWith('cerebras:') && L.fast.models.some((id: string) => id.startsWith('groq:')) && !L.fast.models.slice(0, 3).some((id: string) => /thinking|r1|2\.5-pro/.test(id)), `Fastest: ${L.fast.models.join(', ')}`);
check(L.languages.models[0].startsWith('gemini:') && L.documents.models.slice(0, 2).every((id: string) => id.startsWith('gemini:')), `Languages and Documents prefer Gemini: ${L.documents.models.join(', ')}`);
const geminiOnly = recommendedLayouts(catalog.filter((x) => x.id.startsWith('gemini:')));
check(geminiOnly.find((l) => l.id === 'coding')!.models[0] === 'gemini:gemini-2.5-pro' && geminiOnly.find((l) => l.id === 'fast')!.models[0] === 'gemini:gemini-flash-lite-latest', 'works with only a Gemini key');
const custom = [{ id: 'custom-1', name: 'Web apps', icon: 'code', description: '', models: ['groq:llama-3.3-70b-versatile'], mode: 'order' }] as any[];
check(findLayout('layout:custom-1', catalog, custom)?.name === 'Web apps' && findLayout('layout:coding', catalog, custom)?.builtin === true && !findLayout('layout:nope', catalog, custom), 'finding layouts by id');
const edited = [...custom, { id: 'coding', name: 'My coding', icon: 'code', description: 'mine', models: ['groq:openai/gpt-oss-120b'], mode: 'auto' }] as any[];
const all = allLayouts(catalog, edited, ['languages']);
const coding = all.find((l) => l.id === 'coding')!;
check(coding.name === 'My coding' && coding.edited === true && coding.builtin === true && all.indexOf(coding) === 0, 'an edited recommended layout replaces it in place');
check(all.filter((l) => l.id === 'coding').length === 1 && all.at(-1)!.id === 'custom-1', 'edited recommended layouts are not listed twice');
check(!all.some((l) => l.id === 'languages') && !findLayout('layout:languages', catalog, edited, ['languages']) && findLayout('layout:languages', catalog, edited)?.name === 'Languages & translation', 'removed recommended layouts are hidden');
check(findLayout('layout:arabic', catalog, [])?.id === 'languages', 'the old Arabic layout id still works (now Languages & translation)');
check(findLayout('layout:coding', catalog, edited)?.models[0] === 'groq:openai/gpt-oss-120b', 'routing uses the edited models');
// Building a layout for a described task.
import('../../src/lib/layout-builder').then(({ rankForTask, taskFromText, TASKS }) => {
  const web = taskFromText('debugging React web apps');
  check(web.weights.coder === 3 && web.name === 'Debugging React web apps', 'a description maps to the coding profile');
  const picks = rankForTask(web, catalog);
  check(picks[0].id === 'openrouter:qwen/qwen3-coder:free' && picks[0].why.includes('built for code'), `explains its picks: ${picks[0].why.join(', ')}`);
  check(new Set(picks.slice(0, 3).map((p) => p.id.split(':')[0])).size >= 2, 'backups come from another provider');
  const images = rankForTask(TASKS.find((t) => t.id === 'images')!, catalog);
  check(images.length > 0 && images.every((p) => p.id.startsWith('gemini:')), 'image work only picks models that can see');
  const limited = rankForTask(TASKS.find((t) => t.id === 'coding')!, catalog, { blocked: (id) => id === 'openrouter:qwen/qwen3-coder:free' });
  check(limited[0].id !== 'openrouter:qwen/qwen3-coder:free', 'a model at its limit moves down');
  const versions = rankForTask(TASKS.find((t) => t.id === 'thinking')!, [...catalog, m('gemini:gemini-2.0-pro')] as any);
  check(versions.findIndex((p) => p.id === 'gemini:gemini-2.0-pro') === -1 || versions.findIndex((p) => p.id === 'gemini:gemini-2.0-pro') > versions.findIndex((p) => p.id === 'gemini:gemini-2.5-pro'), 'the newest version of a family comes first');
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
});

