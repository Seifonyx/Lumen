// Phase 3 chat and reading: a synthetic conversation with the content Lumen really renders (no network, no real data).
// Long mixed Markdown (headings, lists, a table, a quote, links), code in two languages, sources, an image and a PDF
// sent by "you", a short exchange, a failed reply and a stopped one. Built on the Phase 2 nav account (nav-fixture.cjs):
// seedChat(ctx, { theme, open }) seeds both and opens this conversation first.
const { seedNav, NAV_UID } = require('./nav-fixture.cjs');

// A small moodboard drawn as SVG, so the attachment preview shows a real picture (thumb as the app stores it).
const SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='176' height='176'><rect width='176' height='176' fill='#e9e2d6'/><rect x='12' y='12' width='92' height='70' rx='6' fill='#c7a27c'/><rect x='112' y='12' width='52' height='110' rx='6' fill='#5f6f5a'/><rect x='12' y='90' width='92' height='74' rx='6' fill='#2f3a45'/><circle cx='138' cy='146' r='16' fill='#d9c39a'/></svg>`;
const THUMB = 'data:image/svg+xml;base64,' + Buffer.from(SVG).toString('base64');
const long = `Here's a plan for a calm, credible launch, sized for one person and about three weeks.

## 1. Decide what "launched" means

Pick **one** outcome you can check on a date: *three paying clients by 15 November*. Everything below serves that line; anything that doesn't can wait.

> A launch is a promise to a few specific people, not an announcement to everyone.

## 2. The three-week plan

| Week | Focus | Done when |
|---|---|---|
| 1 | Offer and price | One page you would send to a friend |
| 2 | Proof | Two case studies with real numbers |
| 3 | Outreach | Twenty personal notes sent |

### Week 1: the offer
- Write the offer as a sentence a client would say back to you.
- Set one price and two add-ons. Avoid tiers until someone asks.
- Put it on a single page with a clear next step (book a call).

### Week 2: proof
1. Choose your two strongest past projects.
2. For each, write *problem → what you did → result*, with one number.
3. Ask both clients for a two-line quote.

## 3. A tiny tracker

Keep outreach honest with a short script:

\`\`\`ts
type Lead = { name: string; sent: Date; replied?: Date };

export function followUps(leads: Lead[], today = new Date()) {
  const week = 7 * 24 * 60 * 60 * 1000;
  return leads.filter((l) => !l.replied && today.getTime() - l.sent.getTime() > week);
}
\`\`\`

Or, if you prefer a spreadsheet, the same rule as a formula: \`=FILTER(A2:A, C2:C="", TODAY()-B2:B>7)\`.

\`\`\`bash
# a very long line to check horizontal scrolling inside code blocks, not across the whole page
curl -s "https://example.com/api/v1/leads?status=open&sort=sent&order=asc&fields=name,sent,replied,notes" | jq '.[] | select(.replied == null)'
\`\`\`

## 4. What to skip for now

- A logo refresh, newsletter or podcast.
- Paid ads (you can't learn from twenty clicks).
- Perfecting the website: the [one-page offer](https://example.com/offer) is enough.

That's the whole plan. Want me to draft the first five outreach notes?`;

function chat(now) {
  const t = now - 3600000;
  return {
    id: 'reading', title: 'Launch plan, three weeks', createdAt: t, updatedAt: now - 60000, rev: now - 60000, projectId: 'studio',
    messages: [
      { id: 'r1', role: 'user', text: 'I want to launch the studio properly but I only have evenings. Can you give me a realistic three-week plan? I attached the moodboard and last year\'s numbers.', createdAt: t,
        files: [
          { id: 'f1', kind: 'image', name: 'moodboard.svg', mime: 'image/svg+xml', size: 182344, thumb: THUMB },
          { id: 'f2', kind: 'text', name: 'studio-numbers-2025.pdf', mime: 'application/pdf', size: 92211, text: 'Revenue by month…' },
        ] },
      { id: 'r2', role: 'assistant', text: long, createdAt: t + 60000, model: 'gemini:gemini-flash-latest', route: 'good at planning', status: 'done',
        sources: [
          { title: 'How small studios find first clients', url: 'https://example.com/first-clients' },
          { title: 'Pricing creative work — a field guide', url: 'https://example.org/pricing-guide' },
        ] },
      { id: 'r3', role: 'user', text: 'Short version please.', createdAt: t + 120000 },
      { id: 'r4', role: 'assistant', text: 'Week 1: offer and price. Week 2: two case studies. Week 3: twenty personal notes. Skip everything else until you have three clients.', createdAt: t + 180000, model: 'gemini:gemini-flash-latest', status: 'done' },
      { id: 'r5', role: 'user', text: 'Now draft the first outreach note.', createdAt: t + 240000 },
      { id: 'r6', role: 'assistant', text: '', createdAt: t + 250000, model: 'gemini:gemini-flash-latest', status: 'error', error: 'The model is busy right now (429). Nothing was charged; try again in a moment.' },
      { id: 'r7', role: 'user', text: 'Try again, warmer tone.', createdAt: t + 300000 },
      { id: 'r8', role: 'assistant', text: 'Hi Ana — I loved the way your shop', createdAt: t + 310000, model: 'gemini:gemini-flash-latest', status: 'stopped' },
    ],
  };
}

/** Seeds the nav account plus this conversation, and opens it first (it is the most recent chat). */
exports.seedChat = async (ctx, { theme = 'light', extra = {} } = {}) => {
  await seedNav(ctx, { theme, extra });
  const now = Date.now();
  await ctx.addInitScript(({ uid, chat }) => {
    if (window.top !== window || localStorage.getItem('mr.chat.seeded')) return;
    const req = indexedDB.open(`model-router-account-${uid}`, 2);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('chats')) req.result.createObjectStore('chats', { keyPath: 'id' }); };
    req.onsuccess = () => { const tx = req.result.transaction('chats', 'readwrite'); tx.objectStore('chats').put(chat); tx.oncomplete = () => { req.result.close(); localStorage.setItem('mr.chat.seeded', '1'); if (localStorage.getItem('mr.nav.seeded')) location.reload(); }; };
  }, { uid: NAV_UID, chat: chat(now) });
};
exports.CHAT_ID = 'reading';
