# Model Router

- Repo: `Seifonyx/Model-Router`, branch `main`. Live: https://model-router.web.app. Preview: https://model-router--dev-82jv5mm2.web.app.
- React 19, Vite, TypeScript, Zustand; static Firebase Hosting with Auth/Firestore. Browser calls Gemini/OpenRouter/Groq/Cerebras with users' own keys. Preserve Firebase Spark/free-only operation.
- User wants polished phone/desktop UX, verified fixes on main, and this small file updated with important context. Old pasted handoff instructions were revoked.
- Latest feature batch: projects with instructions/defaults/reference files, tags and branching, model comparisons, Ctrl+K palette. Smart routing, memory, attachments/document generation and GitHub coding workspace already exist. Do not assume every roadmap item is implemented.

## October 10 fixes

- Offline comparison and privacy confirmation preserve composer drafts and attachments.
- First messages and repository chats inherit the selected project after reload; composer checks and model picker use its context before a chat exists.
- Comparison replies respect local privacy restoration, including when continuing with an answer. Raw masked details remain local.
- Modal autofocus and keyboard shortcuts work across re-renders.
- Project editor action buttons reflow at small phone widths.
- iOS keyboard handling allows scrollable settings/dialogs/textareas while still blocking composer page dragging. Physical iPhone keyboard/rotation behavior still needs user verification; automated tests simulate the viewport and events.
- Live Deploy workflow also refreshes the `dev` preview channel from the same build. Preview workflow remains available for branch testing. This resolves the old preview build's squished portrait settings.

## Validation and release

- Visual refresh: `src/design.css` defines warm light / soft dark surfaces, sage accents, typography and spacing. Existing `styles.css` retains functional layouts and phone fixes. New-chat composer is centred; starter actions are below it. Desktop files/repositories share the + menu; desktop sidebar can collapse (saved locally). Useful features remain available.
- Phased October 11 updates: True black saves `theme: 'black'`, applies `data-theme="dark"` for editor compatibility and `data-appearance="black"` for neutral black surfaces. Privacy & data is one tab (`privacy`); legacy `data` links resolve to it. Masking preview is expandable; backups and deletion remain available. Models separates saved models, searchable catalogue (24 results per page) and layouts; row options retain reorder/removal. Usage uses a small context ring and expandable details; context is an estimate against the compaction threshold, daily provider limits stay separate and unknown allowances have no invented percentage. Deploy each requested phase before implementing the next (sidebar gestures).

- Regression coverage: `tests/e2e/regressions.cjs` (desktop + phone, drafts, projects, privacy, focus, narrow buttons, simulated iOS scrolling).
- The regression script can check deployed builds with `MR_TEST_URL` set to live or preview; it uses isolated local data and mocked model requests.
- Run `npm test`, `npm run build`, and `npm run test:e2e:ci` (Java 21, Firebase emulators, Chromium). Existing CI runs on main pushes and PRs.
- Deploy workflow: `.github/workflows/deploy.yml`, manual Actions dispatch; existing repository Firebase service-account secret publishes hosting only.
- Tests/release status is recorded in the relevant commit and GitHub Actions; check it before further work. Next: finish roadmap items after confirming these fixes on a physical iPhone.
