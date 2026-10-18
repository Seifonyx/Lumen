import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyze, planRoute, AUTO } from '../../src/lib/routing';
import { taskFromText, rankForTask } from '../../src/lib/layout-builder';
import { familyOf, versionOf, features, strength } from '../../src/lib/model-profile';
import type { ModelInfo } from '../../src/types';
import { contextTokens } from '../../src/lib/compact';
import { interpretWork, previousWork } from '../../src/lib/work-intent';

const model = (name: string, extra: Partial<ModelInfo> = {}): ModelInfo => ({
  id: `openrouter:${name}`, name, label: name, provider: 'openrouter', context: 128000,
  vision: false, pdf: false, search: false, thinking: false, ...extra,
});
const task = (text: string, extra = {}) => analyze({text,files:[],conversationTokens:100,search:false,...extra});

test('the requested deliverable takes precedence over topic keywords', () => {
  for (const text of ['Write an email about a Python bug', 'Draft a letter about the API migration', 'Write a poem about a robot class']) {
    assert.equal(task(text).code,false,text);
    assert.equal(task(text).writing,true,text);
    assert.ok(!(taskFromText(text).weights.coder || 0),text);
  }
  assert.equal(task('Fix the Python bug and write an email explaining the change').code,true);
  assert.equal(task('Write code for an email validator').code,true);
});

test('a new explicit task does not inherit the previous topic just because it starts with yes', () => {
  const recentText='Debug this Python API concurrency bug';
  assert.equal(task('Yes, write a birthday poem instead',{recentText}).code,false);
  assert.equal(task('Do it',{recentText}).code,true);
  assert.equal(task('Make it faster',{recentText}).code,true);
  assert.equal(task('Continue',{recentText}).code,true);
});

test('negated reasoning is removed before request classification', () => {
  for (const text of ['Fast coding, not reasoning','Explain briefly without lengthy reasoning','Quick answers; do not use lengthy thinking']) {
    const layout=taskFromText(text);
    assert.equal(layout.weights.reasoner || 0,0,text);
    assert.ok((layout.weights.slow || 0)<0,text);
    assert.ok(!layout.instructions?.includes('Think the problem through carefully'),text);
  }
});

test('a topic or generated diagram does not require an image input or web tool', () => {
  for (const text of ['Write a React app to draw diagrams','Explain how search engines work','Write a story about photographs']) {
    const layout=taskFromText(text);
    assert.ok(rankForTask(layout,[model('qwen3-coder')]).length,text);
  }
  assert.equal(rankForTask(taskFromText('Analyze these screenshots'),[model('qwen3-coder')]).length,0);
  assert.equal(rankForTask(taskFromText('Research current sources'),[model('qwen3-coder')]).length,0);
});

test('offline and negated research do not generate web-search instructions', () => {
  for (const text of ['Research offline','Research supplied papers, do not use web search','Analyze screenshots, not research']) {
    const layout=taskFromText(text);
    assert.ok(!(layout.requiresAll || []).includes('search'),text);
    assert.ok(!layout.instructions?.includes('Search for current information'),text);
  }
});

test('formatted and word-unit context requirements are real minimums', () => {
  for (const [text,minimum] of [
    ['Code with 200,000 tokens of context',200000],
    ['Use at least 1 million token context',1000000],
    ['Code with 1.5M context',1500000],
    ['A minimum 256 thousand token context window',256000],
  ] as const) {
    const layout=taskFromText(text);
    assert.equal(layout.minContext,minimum,text);
    assert.deepEqual(rankForTask(layout,[model('small',{context:minimum-1}),model('fits',{context:minimum}),model('unknown',{context:null})]).map(p=>p.id),['openrouter:fits'],text);
  }
});

test('the newest comparable release is recognized without inventing a latest-alias version', () => {
  const older=model('anthropic/claude-sonnet-4-5'),newer=model('anthropic/claude-sonnet-4-6');
  assert.equal(familyOf(older),familyOf(newer));
  assert.ok(versionOf(newer)>versionOf(older));
  const base=model('deepseek/deepseek-r1'),release=model('deepseek/deepseek-r1-0528');
  assert.equal(familyOf(base),familyOf(release));
  assert.ok(versionOf(release)>versionOf(base));
  assert.ok(versionOf(model('google/gemini-flash-latest'))<=0,'An unresolved alias has no verified version');
});

test('explicit small variants do not inherit the strength of much larger family members', () => {
  assert.ok(strength(model('google/gemma-4-31b-it'))>strength(model('google/gemma-4-1b-it')));
  assert.ok(features(model('anthropic/claude-sonnet-4-6')).coder>features(model('vendor/plain-7b')).coder);
  assert.ok(features(model('anthropic/claude-haiku-4-5')).speed>features(model('anthropic/claude-opus-4-6')).speed);
});

test('Auto prefers a working search model before continuity on a search-enabled request', () => {
  const coder=model('qwen/qwen3-coder:free'),searcher=model('gemini-flash-lite',{id:'gemini:gemini-flash-lite',provider:'google',search:true});
  const plan=planRoute({selected:AUTO,enabled:[coder.id,searcher.id],catalog:[coder,searcher],text:'Fix this Python bug using current documentation',files:[],conversationTokens:100,search:true,previous:coder.id,blocked:()=>false,left:()=>null});
  assert.equal(plan.model,searcher.id);
});

test('summaries use the same Unicode-aware estimate as the final request', () => {
  const chat:any={messages:[],summary:{text:'ع'.repeat(112000),upTo:null,createdAt:1}};
  assert.ok(contextTokens(chat)>=56000,'A non-ASCII summary must not be budgeted as ordinary ASCII text');
});

test('tool names used as software topics do not become runtime requirements', () => {
  for (const text of ['Find the bug in this Python function', 'Search this code for the error', 'Build an app with web search', 'Write a story about photographs']) {
    const intent=interpretWork(text);
    assert.deepEqual(intent.required,[],text);
  }
  assert.ok(interpretWork('Read these PDFs, then build a website').required.includes('pdf'));
  assert.ok(interpretWork('Research current documentation and analyze these screenshots').required.includes('vision'));
});

test('negation is limited to its clause and can coordinate exclusions', () => {
  assert.deepEqual(new Set(interpretWork('No images or web search; fast coding').excluded),new Set(['images','research']));
  const intent=interpretWork('No images. I need coding and research using current web sources.');
  assert.ok(intent.required.includes('search'));
  assert.ok(intent.tasks.includes('coding'));
  assert.ok(!intent.excluded.includes('research'));
});

test('follow-ups inherit the latest substantive task rather than older unrelated work', () => {
  const recent=previousWork(['Fix the Python bug','Write a birthday poem','Make it shorter']);
  assert.equal(task('Do it',{recentText:recent}).code,false);
  assert.equal(task('Do it',{recentText:recent}).writing,true);
});

test('Auto applies explicit reasoning exclusions to its entire fallback plan', () => {
  const forced=model('deepseek/deepseek-r1',{thinking:true}), optional=model('gemini-flash',{thinking:true});
  const plan=planRoute({selected:AUTO,enabled:[forced.id,optional.id],catalog:[forced,optional],text:'Fast coding without lengthy reasoning',files:[],conversationTokens:100,search:false,blocked:()=>false,left:()=>null});
  assert.equal(plan.model,optional.id);
  assert.ok(!plan.fallbacks.includes(forced.id));
});

test('missing catalogue entries cannot bypass attachment and context limits', () => {
  const known=model('qwen3-coder');
  const base={selected:'openrouter:missing',enabled:['openrouter:missing',known.id],catalog:[known],text:'hello',files:[],conversationTokens:100,search:false,blocked:()=>false,left:()=>null};
  assert.equal(planRoute(base).model,base.selected,'short manual text remains usable without metadata');
  assert.equal(planRoute({...base,conversationTokens:30000}).model,known.id);
  assert.equal(planRoute({...base,enabled:[base.selected],catalog:[],conversationTokens:30000}).model,'');
  const image:any={id:'photo',kind:'image',name:'photo.png',mime:'image/png',size:100,data:'abc'};
  assert.equal(planRoute({...base,files:[image]}).model,'');
});

test('zero remaining quota is unavailable even before a provider sends a block', () => {
  const searcher=model('searcher',{search:true}), backup=model('backup');
  const plan=planRoute({selected:AUTO,enabled:[searcher.id,backup.id],catalog:[searcher,backup],text:'Find current news',files:[],conversationTokens:100,search:true,blocked:()=>false,left:id=>id===searcher.id?0:10});
  assert.equal(plan.model,backup.id);
  assert.deepEqual(plan.fallbacks,[searcher.id]);
});

test('implementing or teaching a file/image feature does not require an input reader', () => {
  for (const text of ['Write a Python script to read PDF files','Implement image compression in Python','Explain image compression']) {
    assert.deepEqual(interpretWork(text).required,[],text);
  }
});

test('qualified code deliverables stay coding even when their UI or subject mentions prose', () => {
  for (const text of ['Write a React component with a message input','Write tests for a Python email service']) {
    assert.equal(task(text).code,true,text);
    assert.ok((taskFromText(text).weights.coder || 0)>0,text);
  }
});

test('a later explicit research task retains search after an explanatory clause', () => {
  const intent=interpretWork('Explain how OAuth works and research current official documentation');
  assert.ok(intent.required.includes('search'));
});

test('mixed semantic and date-only releases do not receive an invented newest claim', () => {
  const versions=[model('mistralai/mistral-small-3.2-24b-instruct-2506'),model('mistralai/mistral-small-2603')];
  assert.equal(familyOf(versions[0]),familyOf(versions[1]));
  const picks=rankForTask({...taskFromText('Everyday'),weights:{speed:1}},versions);
  assert.ok(picks.every(p=>!p.why.some(reason=>reason.includes('newest'))));
});
