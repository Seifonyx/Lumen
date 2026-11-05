// Where you left off (src/lib/resume.ts): what is kept, what is refused, and what a relaunch may open.
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
};
const { applyingResume, forgetResume, onResumed, readResume, resumeInProgress, resumeTarget, writeResume } = await import('../../src/lib/resume');
const { readingAnchor, readingPositions, setReadingProbe } = await import('../../src/lib/reading-position');
let fails = 0;
const check = (c: boolean, l: string) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) fails++; };

const chats = [{ id: 'c1', messages: [{ id: 'm1' }, { id: 'm2' }] }, { id: 'c2', messages: [] }];
const projects = [{ id: 'p1' }];
const snap = (over: object = {}) => ({ v: 1 as const, chat: 'c1', workspace: null, place: null, anchor: { id: 'm2', offset: 12.4 }, ...over });

// Accounts are kept apart, and signing out forgets.
writeResume('alice', snap());
check(readResume('alice')?.chat === 'c1', 'an account reads its own spot');
check(readResume('bob') === null, 'another account on the same device reads nothing');
check(readResume('alice')?.anchor?.offset === 12, 'the offset is a whole number');
forgetResume('alice');
check(readResume('alice') === null, 'signing out forgets the spot');
forgetResume(null);

// Only opaque ids and one offset are kept, and anything malformed reads as nothing.
writeResume('alice', snap());
check(Object.keys(JSON.parse(store.get('mr.resume.alice')!)).sort().join() === 'anchor,chat,place,v,workspace', 'the snapshot holds ids, a place and an offset only');
store.set('mr.resume.alice', '{not json');
check(readResume('alice') === null, 'a corrupt snapshot reads as none');
store.set('mr.resume.alice', JSON.stringify({ v: 2, chat: 'c1' }));
check(readResume('alice') === null, 'an unknown version reads as none');
store.set('mr.resume.alice', JSON.stringify({ v: 1, chat: '<img src=x>', workspace: 'p 1', place: { kind: 'router', section: 'Models!' }, anchor: { id: 'm1', offset: 'x' } }));
const odd = readResume('alice');
check(odd?.chat === null && odd.workspace === null && odd.place === null && odd.anchor === null, 'ids and words that are not plain are dropped');

// Places.
store.set('mr.resume.alice', JSON.stringify(snap({ place: { kind: 'settings', tab: 'keys' } })));
check(readResume('alice')?.place?.kind === 'settings' && (readResume('alice')!.place as { tab: string }).tab === '', 'a Settings section that holds keys opens as the Settings list');
store.set('mr.resume.alice', JSON.stringify(snap({ place: { kind: 'settings', tab: 'privacy' } })));
check((readResume('alice')!.place as { tab: string }).tab === 'privacy', 'another Settings section opens as it was');
store.set('mr.resume.alice', JSON.stringify(snap({ place: { kind: 'library', tab: 'documents' } })));
check(JSON.stringify(readResume('alice')!.place) === '{"kind":"library","tab":"documents"}', "Library keeps its tab");
store.set('mr.resume.alice', JSON.stringify(snap({ place: { kind: 'canvas', doc: 'd1' } })));
check(readResume('alice')!.place === null, 'pushed screens (a document, a tool) are not places');

// What a relaunch may open, given what the account has now.
check(resumeTarget(snap(), chats, projects)?.anchor?.id === 'm2', 'an existing chat opens at its message');
check(resumeTarget(snap({ chat: 'gone' }), chats, projects) === null, 'a deleted chat opens a new chat');
check(resumeTarget(snap({ anchor: { id: 'gone', offset: 0 } }), chats, projects)?.anchor === null, "a missing message opens the chat at its usual place");
check(resumeTarget(snap({ chat: 'temporary-abc' }), [...chats, { id: 'temporary-abc', messages: [] }], projects) === null, 'an incognito chat is never restored');
check(resumeTarget(snap({ chat: null }), chats, projects) === null, 'a new chat (after New chat) stays a new chat');
check(resumeTarget(snap({ chat: 'c2', anchor: null }), chats, projects)?.chat === 'c2', 'an empty saved chat opens');
check(resumeTarget(snap({ chat: null, workspace: 'p1' }), chats, projects)?.workspace === 'p1', "a project's workspace opens");
check(resumeTarget(snap({ chat: null, workspace: 'p9' }), chats, projects) === null, 'a deleted project opens a new chat');
const placeOnly = resumeTarget(snap({ chat: 'gone', place: { kind: 'projects' } }), chats, projects);
check(placeOnly?.place?.kind === 'projects' && placeOnly.chat === null, 'a place still opens when the chat under it is gone');
check(resumeTarget(null, chats, projects) === null, 'no snapshot, nothing to open');

// The screen history is told once both owners show the restored screen.
let told = 0, during = false;
onResumed(() => { told++; });
applyingResume(() => { during = resumeInProgress(); });
check(during && !resumeInProgress() && told === 1, 'changes made while restoring are one step, announced after');
onResumed(null);

// The reading spot: live from the screen when the conversation is visible, otherwise what was remembered.
readingPositions.set('c1', { id: 'm1', offset: 4 });
check(readingAnchor('c1')?.id === 'm1', 'without the conversation on screen, the remembered spot is used');
setReadingProbe(() => ({ chat: 'c1', anchor: { id: 'm2', offset: 0 } }));
check(readingAnchor('c1')?.id === 'm2', 'with it on screen, the spot is read from the screen');
check(readingAnchor('c2') === null && readingAnchor(null) === null, 'another chat or a new chat has no spot');
setReadingProbe(null);

console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
