// Synthetic QA build only: the review account's starting state. Reuses the existing synthetic proof
// fixture (made-up chats and projects) and the proof's settings, so reviews start from the same content.
// Changing either file changes the build's recorded fixture version.

import fixture from './canvas-fixture.json';

// The approved Canvas proof's synthetic projects (qa/iphone/fixtures/canvas-workspace.cjs): the launch
// conversation and related work filed under "Studio launch", one trip chat under "Lisbon in spring", the rest loose.
const NOW = Date.now(), DAY = 86400000;
const FILED: Record<string, string> = { launch: 'studio', 'history-1': 'studio', 'history-3': 'studio' };
export const FIXTURE_PROJECTS = [
  { id: 'studio', name: 'Studio launch', description: 'Offer, portfolio and first clients.', instructions: 'Keep plans realistic for one person.', color: 'indigo', files: [], createdAt: NOW - 30 * DAY, updatedAt: NOW },
  { id: 'trip', name: 'Lisbon in spring', description: 'A slow week, planned together.', instructions: '', color: 'green', files: [], createdAt: NOW - 20 * DAY, updatedAt: NOW - 2 * DAY },
];
// Populated Library review data is confined to the isolated synthetic QA build.
// No external image URL, real person, provider request or production persistence.
const QA_STUDIO_IMAGE = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240"><rect width="320" height="240" fill="#c6c0b2"/><rect x="28" y="28" width="264" height="184" rx="8" fill="#ece8df"/><rect x="58" y="56" width="88" height="122" rx="4" fill="#736d60"/><circle cx="210" cy="104" r="40" fill="#b7a78e"/><path d="M165 178h92" stroke="#807969" stroke-width="9"/></svg>');
const QA_LIBRARY_DOCUMENTS = [
  { id:'qa-launch-brief',name:'Launch brief.md',content:'# Launch brief\n\n## Positioning\nA quiet, independent design studio for thoughtful digital products.\n\n- Clarify the offer\n- Interview first clients\n- Build a portfolio',updatedAt:NOW-2*3600000 },
  { id:'qa-review-notes',name:'Customer interview synthesis — needs, objections, and next steps.md',content:'# Interview synthesis\n\nSynthetic notes across five fictional conversations.\n\n## Themes\nReliability, clarity, accessibility.',updatedAt:NOW-4*3600000 },
  { id:'qa-weekly-plan',name:'Week one roadmap.md',content:'# Week one\n\nMonday: Define a single promise.\nTuesday: Sketch three examples.\nWednesday: Review and iterate.',updatedAt:NOW-6*3600000 },
];
const QA_LIBRARY_FILES = [
  { id:'qa-pdf',kind:'pdf',name:'Studio positioning overview — 2026.pdf',mime:'application/pdf',size:245760,text:'Synthetic concept deck. No real clients.' },
  { id:'qa-text',kind:'text',name:'Interview follow-up questions.txt',mime:'text/plain',size:1824,text:'Synthetic interview questions.' },
  { id:'qa-photo',kind:'image',name:'Studio moodboard.svg',mime:'image/svg+xml',size:410,thumb:QA_STUDIO_IMAGE },
];
export const FIXTURE_CHATS = [
  ...(fixture.chats as { id: string; messages?: Record<string, unknown>[] }[]).map((c) => ({
    ...c,
    ...(FILED[c.id] ? { projectId: FILED[c.id] } : {}),
    ...(c.id === 'launch' ? { documents: QA_LIBRARY_DOCUMENTS } : {}),
    ...(c.id === 'history-1' ? { messages: (c.messages || []).map((m,i) => i ? m : { ...m, files: QA_LIBRARY_FILES }) } : {}),
  })),
  { id: 'lisbon', title: 'Four quiet days in Lisbon', projectId: 'trip', createdAt: NOW - 3 * DAY, updatedAt: NOW - 2 * DAY, messages: [{ id: 'l1', role: 'user', text: 'Plan four quiet days in Lisbon.', createdAt: NOW - 3 * DAY }] },
] as unknown[];
export const FIRST_CHAT = 'launch';

export const FIXTURE_SETTINGS = {
  theme: 'dark',
  autoIntroduced: true,
  autoTitle: false,
  autoCompact: false,
  privacyShield: false,
  messageNavigator: false,
  enabledModels: ['gemini:gemini-flash-latest', 'gemini:gemini-2.5-pro'],
  defaultModel: 'auto',
  projects: FIXTURE_PROJECTS,
  layouts: [{ id: 'launch-writing', name: 'Launch writing', icon: 'pen', description: 'A focused writing route, with a deliberate backup.', models: ['gemini:gemini-2.5-pro', 'gemini:gemini-flash-latest'], mode: 'order', fallback: 'layout', priority: 'quality' }],
};
