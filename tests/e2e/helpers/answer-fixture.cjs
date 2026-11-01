// Synthetic replies for Answer details and Compare with…: one of each kind Lumen records (Auto with reasons and
// alternatives, a model you picked, a layout, a switch while answering, a combined comparison answer, nothing recorded),
// plus stopped and failed replies, web and document sources, privacy and memory notes, a question whose file isn't on
// this device, a long reply, and a coding chat where an app-added message sits between question and reply. Nothing
// here is real data.
const now = Date.now();
const FLASH = 'gemini:gemini-flash-latest', PRO = 'gemini:gemini-2.5-pro', LITE = 'gemini:gemini-flash-lite-latest';
exports.MODELS = [FLASH, LITE, PRO];
// The catalogue the suite serves for them (names as the provider reports them).
exports.CATALOG = { models: [['gemini-flash-latest', 'Gemini Flash'], ['gemini-flash-lite-latest', 'Gemini Flash-Lite'], ['gemini-2.5-pro', 'Gemini 2.5 Pro']].map(([name, displayName]) => ({ name: `models/${name}`, displayName, inputTokenLimit: 1048576, supportedGenerationMethods: ['generateContent'] })) };
let t = 0;
const at = () => now - 9e6 + (t += 6e4);
const q = (id, text, extra = {}) => ({ id, role: 'user', text, createdAt: at(), ...extra });
const a = (id, text, extra = {}) => ({ id, role: 'assistant', text, status: 'done', model: FLASH, createdAt: at(), ...extra });
const long = 'Start at the river, then climb through the old town. '.repeat(60);

exports.chats = [
  { id: 'ad-tour', title: 'Weekend in Porto', createdAt: now - 9e6, updatedAt: now - 1e6, messages: [
    q('q-auto', 'Plan a weekend in Porto'),
    a('r-auto', 'Day one: Ribeira and the bridge. Day two: Foz by tram.', {
      route: 'quick general question', routeDetail: { why: ['Quick general question: a fast model fits', 'Has room for this conversation'], next: [PRO, LITE] },
      sources: [{ title: 'Visit Porto: getting around', url: 'https://example.com/porto/transport' }, { title: 'https://example.org/trams', url: 'https://example.org/trams' }],
    }),
    q('q-manual', 'Same plan, cheaper please', { privacy: { masked: 2 } }),
    a('r-manual', 'Skip the cable car and walk the riverside instead.', { model: PRO, memory: { saved: [{ id: 'mem-1', text: 'Prefers walking' }] } }),
    q('q-layout', 'Write it up as a short guide'),
    a('r-layout', `## A short guide\n\n${long}`, { via: 'Max writing', route: 'long writing' }),
    q('q-switch', 'Check it against my guidebook', { files: [{ id: 'f-guide', kind: 'text', name: 'guide-notes.txt', mime: 'text/plain', size: 2048, text: 'Tram 1 runs along the river.' }] }),
    a('r-switch', 'Your notes agree: tram 1 follows the river [D1].', { notices: ['Gemini 2.5 Pro hit its usage limit — switched to Gemini Flash.'], knowledgeSources: [{ docId: 'doc-guide', page: 3, title: 'Porto guide.pdf', excerpt: 'Tram 1 runs from the Infante to Foz.' }] }),
    q('q-stop', 'And a day trip?'),
    a('r-stop', 'Guimarães is an hour away by', { status: 'stopped' }),
    q('q-error', 'Try again with more detail'),
    a('r-error', '', { status: 'error', error: 'The model is unavailable right now.', model: PRO }),
    q('q-missing', 'What does this ticket say?', { files: [{ id: 'f-ticket', kind: 'pdf', name: 'ticket.pdf', mime: 'application/pdf', size: 90000, stored: true }] }),
    a('r-missing', 'It is a 24-hour Andante pass.'),
    q('q-combined', 'Best time to visit?'),
    a('r-combined', 'Late spring: warm days and fewer crowds.', { via: 'Combined from 2 answers' }),
    q('q-old', 'Thanks!'),
    a('r-old', 'Enjoy the trip.', { model: undefined }),
  ] },
  { id: 'ad-code', title: 'Fix the build', createdAt: now - 2e6, updatedAt: now - 2e6, messages: [
    q('c-q', 'Why does the build fail?'),
    a('c-r1', 'I need to see src/app.ts.'),
    { id: 'c-files', role: 'user', auto: 'files', text: 'Loaded src/app.ts', files: [{ id: 'c-f', kind: 'text', name: 'src/app.ts', mime: 'text/plain', size: 23, text: 'export const value = 1;' }], createdAt: at() },
    a('c-r2', 'The export is fine; the import path is wrong.'),
  ] },
];
exports.FLASH = FLASH;
exports.PRO = PRO;
