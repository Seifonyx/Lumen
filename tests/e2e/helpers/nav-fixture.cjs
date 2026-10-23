// Phase 2 navigation: a synthetic, realistic account for screenshots and navigation tests (no network, no real data).
// Three projects, twenty chats over two months (two pinned, two archived) and readable messages in the open ones.
// Seeds localStorage (preview sign-in, settings) and the account's IndexedDB chat store before the app starts.
const DAY = 86400000;
const UID = 'preview-nav';
const titles = [
  ['launch', 'A launch worth remembering', 'studio', 0.1, { pinned: true }],
  ['brief', 'A better project brief', 'studio', 0.4],
  ['clients', 'First three clients: outreach plan', 'studio', 1.2],
  ['pricing', 'Pricing the studio offer', 'studio', 3],
  ['lisbon', 'Four quiet days in Lisbon', 'trip', 2],
  ['lisbon-food', 'Where to eat near Alfama', 'trip', 5],
  ['thesis-outline', 'Thesis outline, chapter by chapter', 'thesis', 0.2],
  ['thesis-lit', 'Literature review: attention and memory', 'thesis', 6],
  ['thesis-method', 'Method section feedback', 'thesis', 9],
  ['safari', 'Fix the Safari sign-in flow', null, 0.05, { pinned: true }],
  ['quiet', 'Notes for a quieter workspace', null, 0.3],
  ['research', 'Research: independent studios', null, 0.9],
  ['reading', 'Reading list — October', null, 1.5],
  ['recipe', 'A weeknight dal, simplified', null, 2.5],
  ['taxes', 'Quarterly taxes as a freelancer', null, 4],
  ['run', 'Ten-week plan for a first 10K', null, 7],
  ['garden', 'Balcony herbs that survive neglect', null, 12],
  ['letter', 'Letter to the landlord about the boiler', null, 20],
  ['old-a', 'Old: conference talk outline', null, 40, { archived: true }],
  ['old-b', 'Old: moving checklist', null, 55, { archived: true }],
];
const PROJECTS = (now) => [
  { id: 'studio', name: 'Studio launch', description: 'Offer, portfolio and first clients.', instructions: 'Keep plans realistic for one person.', color: 'indigo', files: [], createdAt: now - 30 * DAY, updatedAt: now },
  { id: 'trip', name: 'Lisbon in spring', description: 'A slow week, planned together.', instructions: '', color: 'green', files: [], createdAt: now - 20 * DAY, updatedAt: now - 2 * DAY },
  { id: 'thesis', name: 'Thesis', description: 'Chapters, sources and feedback.', instructions: 'Cite sources; be precise.', color: 'amber', files: [], createdAt: now - 60 * DAY, updatedAt: now - DAY },
];
function chats(now) {
  return titles.map(([id, title, projectId, days, extra = {}]) => {
    const t = now - days * DAY;
    const messages = [
      { id: `${id}-u`, role: 'user', text: `${title}: where should I start?`, createdAt: t - 60000 },
      { id: `${id}-a`, role: 'assistant', text: `Here is a short, practical start for “${title}”.\n\n1. Name the one outcome that matters this week.\n2. List what you already have.\n3. Do the smallest next step today.\n\nWant me to turn this into a checklist?`, createdAt: t, model: 'gemini:gemini-flash-latest' },
    ];
    return { id, title, createdAt: t - 60000, updatedAt: t, rev: t, messages, ...(projectId ? { projectId } : {}), ...extra };
  });
}
const SETTINGS = (theme, now, extra = {}) => ({ theme, autoIntroduced: true, autoTitle: false, autoCompact: false, privacyShield: false,
  enabledModels: ['gemini:gemini-flash-latest'], defaultModel: 'gemini:gemini-flash-latest', projects: PROJECTS(now), ...extra });

/** Adds the routes and seed to a Playwright context. Call before the first page opens. */
exports.seedNav = async (ctx, { theme = 'light', extra = {} } = {}) => {
  await ctx.route('**/firestore.googleapis.com/**', (r) => r.abort());
  await ctx.route('**/generativelanguage.googleapis.com/**', (r) => r.request().url().includes('/models?')
    ? r.fulfill({ json: { models: [{ name: 'models/gemini-flash-latest', displayName: 'Gemini Flash', supportedGenerationMethods: ['generateContent'], inputTokenLimit: 1048576 }] } })
    : r.fulfill({ contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Fixture reply.' }] }, finishReason: 'STOP' }] }) + '\n\n' }));
  const now = Date.now();
  await ctx.addInitScript(({ uid, settings, chats }) => {
    if (window.top !== window || localStorage.getItem('mr.nav.seeded')) return;
    localStorage.setItem('mr.preview_user', JSON.stringify({ uid, email: 'nav@local.invalid', displayName: 'Mira Okafor' }));
    localStorage.setItem(`mr.account.${uid}`, JSON.stringify({ geminiKey: 'fixture', settings }));
    localStorage.setItem('mr.settings', JSON.stringify(settings));
    localStorage.setItem('mr.installHint', '1');
    localStorage.setItem('mr.nav.seeded', '1');
    const req = indexedDB.open(`model-router-account-${uid}`, 2);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('chats')) req.result.createObjectStore('chats', { keyPath: 'id' }); };
    req.onsuccess = () => { const tx = req.result.transaction('chats', 'readwrite'); for (const c of chats) tx.objectStore('chats').put(c); tx.oncomplete = () => { req.result.close(); location.reload(); }; };
  }, { uid: UID, settings: SETTINGS(theme, now, extra), chats: chats(now) });
};
exports.NAV_UID = UID;
