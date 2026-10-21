// Synthetic QA build only: the review account's starting state. Reuses the existing synthetic proof
// fixture (made-up chats and projects) and the proof's settings, so reviews start from the same content.
// Changing either file changes the build's recorded fixture version.

import fixture from '../../../docs/blackout/workspace-proofs/fixture.json';

export const FIXTURE_CHATS = fixture.chats as unknown[];
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
  layouts: [{ id: 'launch-writing', name: 'Launch writing', icon: 'pen', description: 'A focused writing route, with a deliberate backup.', models: ['gemini:gemini-2.5-pro', 'gemini:gemini-flash-latest'], mode: 'order', fallback: 'layout', priority: 'quality' }],
};
