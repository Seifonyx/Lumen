import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Chat, Memory } from '../../src/types';
import { DEFAULT_SETTINGS } from '../../src/lib/settings';
import { comparisonSnapshotKey, titleSnapshotKey, type ComparisonSnapshotInput } from '../../src/lib/comparison-snapshot';

const chat: Chat = {
  id: 'chat', title: 'Original', createdAt: 1, updatedAt: 2, projectId: 'project',
  repo: { owner: 'owner', repo: 'repo', branch: 'main', defaultBranch: 'main' }, context: ['notes.md'],
  messages: [{ id: 'message', role: 'user', text: 'Original context', createdAt: 1 }],
};
const memories: Memory[] = [
  { id: 'general', text: 'General preference', createdAt: 1, updatedAt: 1, source: 'manual' },
  { id: 'scoped', text: 'Project preference', projectId: 'project', createdAt: 1, updatedAt: 1, source: 'manual' },
  { id: 'other', text: 'Other project', projectId: 'other', createdAt: 1, updatedAt: 1, source: 'manual' },
];
const input: ComparisonSnapshotInput = {
  settings: {
    ...DEFAULT_SETTINGS, memory: true, enabledModels: ['model:a', 'model:b'],
    projects: [{ id: 'project', name: 'Project', instructions: 'Project instructions', createdAt: 1, updatedAt: 1,
      files: [{ id: 'reference', name: 'reference.txt', kind: 'text', mime: 'text/plain', size: 5, text: 'Original reference' }] }],
  },
  chat, projectId: 'project', memories,
};

test('equivalent snapshots have a stable structural key without retaining mutable references', () => {
  const key = comparisonSnapshotKey(input);
  assert.equal(comparisonSnapshotKey(structuredClone(input)), key);
  const copy = structuredClone(input);
  copy.memories[0].text = 'Changed';
  assert.notEqual(comparisonSnapshotKey(copy), key);
  assert.equal(comparisonSnapshotKey(input), key);
});

test('privacy, search, instructions and model routing policy changes invalidate old requests', () => {
  for (const patch of [
    { privacyShield: !input.settings.privacyShield }, { privacyRestore: !input.settings.privacyRestore },
    { privacyMode: input.settings.privacyMode === 'ask' ? 'auto' as const : 'ask' as const },
    { webSearch: !input.settings.webSearch }, { customInstructions: 'Different instructions' },
    { replyLanguage: 'Japanese' }, { answerLength: 'short' as const },
    { enabledModels: ['model:a'] }, { autoSwitch: !input.settings.autoSwitch },
    { autoExcluded: ['model:b'] }, { routingPreference: 'cost' as const }, { autoPreferProvider: 'other' },
    {defaultModel:'model:b'}, {hiddenLayouts:['saved']},
    {layouts:[{id:'saved',name:'Saved',icon:'layers' as const,description:'',mode:'order' as const,models:['model:a'],fallback:'none' as const}]},
    { memory: false }, { memoryAuto: !input.settings.memoryAuto }, { aboutMe: 'Changed about me' },
  ]) {
    assert.notEqual(comparisonSnapshotKey({ ...input, settings: { ...input.settings, ...patch } }), comparisonSnapshotKey(input));
  }
});

test('appearance and unrelated project changes do not invalidate request meaning', () => {
  const next = structuredClone(input);
  next.settings.theme = 'black';
  next.settings.fontSize = 'large';
  next.settings.projects!.push({ id: 'other', name: 'Other', instructions: 'Unrelated', createdAt: 1, updatedAt: 1 });
  next.chat!.title = 'Renamed only';
  assert.equal(comparisonSnapshotKey(next), comparisonSnapshotKey(input));
});

test('deleting or changing active memories and references forbids resending old data', () => {
  const key = comparisonSnapshotKey(input);
  for (const kind of ['memory', 'reference', 'project']) {
    const next = structuredClone(input);
    if (kind === 'memory') next.memories = next.memories.filter(item => item.id !== 'scoped');
    if (kind === 'reference') next.settings.projects![0].files = [];
    if (kind === 'project') next.settings.projects = [];
    assert.notEqual(comparisonSnapshotKey(next), key);
  }
  const unrelated = structuredClone(input);
  unrelated.memories = unrelated.memories.filter(item => item.id !== 'other');
  assert.equal(comparisonSnapshotKey(unrelated), key);
});

test('disabled memory does not fingerprint unused remembered text', () => {
  const disabled = { ...input, settings: { ...input.settings, memory: false } };
  assert.equal(comparisonSnapshotKey({ ...disabled, memories: [] }), comparisonSnapshotKey(disabled));
});

test('changed conversation, assistant or repository context invalidates a frozen request', () => {
  const key = comparisonSnapshotKey(input);
  for (const kind of ['conversation', 'assistant', 'repository', 'context', 'deleted-chat','model','project-model']) {
    const next = structuredClone(input);
    if (kind === 'conversation') next.chat!.messages[0].text = 'Changed conversation';
    if (kind === 'assistant') next.chat!.assistant = { id: 'assistant', name: 'Assistant', description: '', model: 'model:a', instructions: 'Changed assistant instructions' };
    if (kind === 'repository') next.chat!.repo!.branch = 'changed';
    if (kind === 'context') next.chat!.context = [];
    if (kind === 'deleted-chat') next.chat = null;
    if (kind === 'model') next.chat!.model='model:b';
    if (kind === 'project-model') next.settings.projects![0].defaultModel='model:b';
    assert.notEqual(comparisonSnapshotKey(next), key);
  }
});

test('the active composer project is fingerprinted before any chat exists', () => {
  const fresh = { ...input, chat: null };
  assert.notEqual(comparisonSnapshotKey({ ...fresh, projectId: null }), comparisonSnapshotKey(fresh));
});

test('a first-message title survives automatic repository reads and later turns but not original input or consent changes', () => {
  const key=titleSnapshotKey(input),next=structuredClone(input);
  next.chat!.repo!.branch='new-branch';next.chat!.context=['loaded.ts'];
  next.chat!.messages.push({id:'automatic-read',role:'user',text:'Here are requested files',createdAt:3});
  assert.equal(titleSnapshotKey(next),key,'background title only depends on the first user message, not later tool continuations');
  for(const kind of ['input','deleted','privacy','routing','model','assistant','title-disabled']) {
    const changed=structuredClone(input);
    if(kind==='input')changed.chat!.messages[0].text='Replaced first question';
    if(kind==='deleted')changed.chat=null;
    if(kind==='privacy')changed.settings.privacyShield=!changed.settings.privacyShield;
    if(kind==='routing')changed.settings.autoSwitch=!changed.settings.autoSwitch;
    if(kind==='model')changed.chat!.model='other';
    if(kind==='assistant')changed.chat!.assistant={id:'new',name:'New',description:'',model:'other',instructions:'Different'};
    if(kind==='title-disabled')changed.settings.autoTitle=!changed.settings.autoTitle;
    assert.notEqual(titleSnapshotKey(changed),key,kind+' must invalidate old naming work');
  }
});
