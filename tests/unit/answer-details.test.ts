// Answer details (src/lib/answer-details.ts): only what a reply recorded, and which question Compare with… repeats.
import { answerFacts, answerSelection, compareSource, selectionWords } from '../../src/lib/answer-details';
import type { Chat, Message } from '../../src/types';
let fails = 0;
const check = (c: boolean, l: string) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) fails++; };
const q = (id: string, text: string, extra: Partial<Message> = {}): Message => ({ id, role: 'user', text, createdAt: 0, ...extra });
const a = (id: string, extra: Partial<Message> = {}): Message => ({ id, role: 'assistant', text: 'Answer.', model: 'gemini:gemini-flash-latest', status: 'done', createdAt: 0, ...extra });
const chat = (messages: Message[], extra: Partial<Chat> = {}): Chat => ({ id: 'c', title: 'T', createdAt: 0, updatedAt: 0, messages, ...extra });

// How the model was chosen: recorded facts only.
const auto = answerSelection(a('r', { route: 'reads images', routeDetail: { why: ['Reads images', ''], next: ['gemini:gemini-2.5-pro'] } }));
check(auto.kind === 'auto' && auto.reasons.join('|') === 'Reads images' && auto.next.join() === 'gemini:gemini-2.5-pro', 'Auto: recorded reasons (blank ones dropped) and alternatives');
check(answerSelection(a('r', { route: 'reads images' })).reasons.join() === 'reads images', 'Auto without details (synced from another device): the short reason only');
check(answerSelection(a('r')).kind === 'unrecorded' && answerSelection(a('r')).reasons.length === 0, 'nothing recorded: no reason is made up');
const layout = answerSelection(a('r', { via: 'Max writing', route: 'long writing' }));
check(layout.kind === 'layout' && layout.layout === 'Max writing' && layout.reasons.join() === 'long writing' && selectionWords(layout) === 'Via Max writing', 'layout and its recorded reason');
const switched = answerSelection(a('r', { notices: ['Gemini 2.5 Pro hit its usage limit — switched to Gemini Flash.'] }));
check(switched.kind === 'fallback' && switched.switched === 'Gemini 2.5 Pro hit its usage limit', 'a switch while answering, from its recorded notice');
const autoSwitched = answerSelection(a('r', { route: 'fast', notices: ['X hit its usage limit — switched to Y.'] }));
check(autoSwitched.kind === 'auto' && autoSwitched.switched === 'X hit its usage limit', 'Auto with a later switch keeps both facts');
check(answerSelection(a('r', { via: 'Combined from 3 answers' })).kind === 'combined', 'a combined comparison answer is not called a layout');
check(answerSelection(a('r', { notices: ['Answer stopped at the length limit.'] })).kind === 'unrecorded', 'an unrelated notice is not a switch');

// Status, privacy, memory, research.
check(answerFacts(a('r', { status: 'stopped' })).status === 'Stopped before it finished.', 'stopped');
check(answerFacts(a('r', { status: 'error', error: 'x' })).status?.startsWith('Didn’t finish') === true, 'failed');
check(answerFacts(a('r', { notices: ['Reply hit the length limit.'] })).status === 'Cut off at the model’s length limit.', 'cut off');
check(answerFacts(a('r'), q('q', 'x', { privacy: { masked: 1 } })).privacy === '1 personal detail hidden from the model.', 'privacy: one detail masked');
check(answerFacts(a('r'), q('q', 'x', { privacy: { masked: 0, unmasked: true } })).privacy === 'Your question was sent without masking.', 'privacy: sent as is');
check(answerFacts(a('r'), a('x', { privacy: { masked: 3 } })).privacy === undefined, 'privacy only from a question you sent');
check(answerFacts(a('r', { memory: { saved: [{ id: 'm', text: 't' }, { id: 'n', text: 'u' }], forgotten: ['old'] } })).memory === '2 memories saved, 1 removed.', 'memory changes counted');
check(answerFacts(a('r', { research: { phase: 'done', steps: [{ query: 'a', status: 'done' }, { query: 'b', status: 'failed' }] } })).research === 'Deep research: 1 search completed.', 'deep research: completed searches only');
const plain = answerFacts(a('r'));
check(!plain.status && !plain.privacy && !plain.memory && !plain.research, 'a plain reply has no invented facts');

// Which question Compare with… repeats.
const file = { id: 'f', kind: 'text' as const, name: 'notes.txt', mime: 'text/plain', size: 5, text: 'hello' };
const turns = chat([q('q1', 'First?'), a('r1'), q('q2', 'Second?', { files: [file] }), a('r2'), q('q3', 'Third?'), a('r3')]);
const middle = compareSource(turns, 'r2');
check(middle.ok && middle.question.id === 'q2' && middle.prompt === 'Second?' && middle.files[0].name === 'notes.txt', 'the question right before the reply, with its files');
check(compareSource(turns, 'r3').ok && (compareSource(turns, 'r3') as { question: Message }).question.id === 'q3', 'the last turn');
check(!compareSource(turns, 'q2').ok, 'only replies can be compared');
check(!compareSource(turns, 'gone').ok && !compareSource(null, 'r1').ok, 'a missing reply or chat');
const between = compareSource(chat([q('q', 'Why?'), a('r1'), { id: 'auto', role: 'user', auto: 'files', text: 'Loaded a.ts', createdAt: 0 }, a('r2')]), 'r2');
check(!between.ok && /can’t tell which question/.test(between.reason), 'an app-added message in between: refused, not guessed');
check(!compareSource(chat([a('r0'), a('r1')]), 'r1').ok, 'two replies in a row: refused');
const missing = compareSource(chat([q('q', 'Read it', { files: [{ id: 'p', kind: 'pdf', name: 'ticket.pdf', mime: 'application/pdf', size: 9, stored: true }] }), a('r')]), 'r');
check(!missing.ok && /ticket\.pdf isn’t on this device/.test(missing.reason), 'a file that is not on this device: refused, named');
check(!compareSource(chat([q('q', 'Watch', { files: [{ ...file, videoUri: 'https://youtu.be/x' }] }), a('r')]), 'r').ok, 'a video question: refused (Compare has no video)');
check(!compareSource(chat([q('q', 'Research', { deepResearch: true }), a('r')]), 'r').ok, 'deep research: refused');
check(!compareSource(chat([q('q', 'Draw', { imagePrompt: true }), a('r')]), 'r').ok, 'an image request: refused');
check(!compareSource(chat([q('q', 'Plan', {}), a('r', { coding: { id: 'p', phase: 'plan', repo: 'o/r' } })]), 'r').ok, 'a coding reply: refused');
check(!compareSource(chat([q('q', '   '), a('r')]), 'r').ok, 'an empty question: refused');
const summarized = chat([q('q1', 'Old?'), a('r1'), q('q2', 'New?'), a('r2')], { summary: { text: 'Earlier: old question.', upTo: 'r1' } as Chat['summary'] });
check(!compareSource(summarized, 'r1').ok && compareSource(summarized, 'r2').ok, 'a question folded into the summary is refused; one after it works');

console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
