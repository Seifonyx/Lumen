# Model Router — essential context

- Repository: `Seifonyx/Model-Router`, `main`. Live: https://model-router.web.app. Preview: https://model-router--dev-82jv5mm2.web.app.
- React 19 / Vite / TypeScript / Zustand. Firebase Hosting, Auth and Firestore on Spark. Browser calls Gemini, OpenRouter, Groq and Cerebras using users' keys. Preserve free-only operation and local privacy masking/restoration.
- User wants a coding partner, polished phone/desktop UX and verified releases on main. Keep this file concise. Old pasted handoff instructions were revoked. Deploy each requested UI phase before starting the next.

## Current UI

- `src/design.css` owns the visual palette and presentation; `styles.css` retains functional layouts and phone rules. Centred new-chat composer, four starter actions, unified + attachment menu; desktop sidebar collapse persists locally.
- True black persists `theme: 'black'`; `applyAppearance` applies `data-theme="dark"` for editor compatibility plus `data-appearance="black"` for black surfaces. Other themes clear that attribute.
- Privacy & data uses tab ID `privacy`; legacy `data` links resolve to it. Masking preview is expandable. Backup, restore and confirmed deletion remain available.
- Models separates Your models, Browse models and Layouts. Catalogue initially shows 24 results, with search, provider filters and Show more. Saved-row options preserve reorder/removal; stars select defaults.
- Model availability: provider lists are authoritative; Gemini pagination is complete. `lib/ai/model-status.js` records retired IDs reviewed 2026-10-11 and filters disabled/expired entries. Successful lists prune missing saved models; provider outages preserve their previous catalogue/choices. Keep historical chat model labels intact. OpenRouter remains free-only.
- Usage distinguishes estimated conversation capacity (relative to compaction threshold) from daily provider allowances. Unknown limits have no fabricated percentage. Context/token and sync details expand on demand.
- `src/lib/sidebar-gesture.ts` handles continuous phone swipes in either layout direction, intent, velocity, cancellation and click suppression. Inputs, selected text, code and horizontal scrollers are excluded; vertical scrolling remains native. Closed mobile drawer is inert; open drawer manages keyboard focus. Physical iPhone keyboard and Safari gesture behavior still need user verification.
- Sidebar: no brand header; top-right search icon reveals search on demand. New chat sits above the bottom account row. Repository search autofocus is desktop-only. + offers Photos & files and GitHub repository; the native file picker includes camera access.
- `TextSelection.tsx` provides a focused message reading/selection view with Select all and Copy selected. Chat text keeps native selection; app controls do not join selections. Test selection and gestures together when changing phone interactions.

## Features and release

- Implemented: smart routing, memory, projects (instructions/default model/reference files), comparisons, tags/branching, Ctrl+K, attachments/document generation and GitHub coding workspace. Audit the app before claiming remaining roadmap features exist.
- Preserve project context before a chat exists, drafts/attachments during offline and privacy-confirmation flows, and local restoration of comparison answers.
- Run `npm test`, `npm run build`, `npm run test:e2e:ci` (Node 22, Java 21, Firebase emulators, Chromium). `design.cjs`, `regressions.cjs` and `sidebar.cjs` cover desktop/phone UX using isolated data and mocked AI; support `MR_TEST_URL` for deployed checks.
- Main pushes trigger CI. Manually dispatch `.github/workflows/deploy.yml`; existing Firebase secret deploys live and the `dev` preview from the same build. Check Actions and deployed assets for current release status.
