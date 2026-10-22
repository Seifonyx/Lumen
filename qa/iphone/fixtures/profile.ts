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
export const FIXTURE_CHATS = [
  ...(fixture.chats as { id: string }[]).map((c) => (FILED[c.id] ? { ...c, projectId: FILED[c.id] } : c)),
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
