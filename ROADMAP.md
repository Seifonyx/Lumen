# Roadmap status

Audit: 2026-10-12. Only mark a feature complete after its working implementation is deployed and checked.

| Item | Status / remaining work |
| --- | --- |
| 9 Smart routing | Implemented; maintain model access and capabilities. Recent response timings improve simple Auto choices; eligible stalled starts switch after 8s. Provider-diverse fallback, transient cooldowns and bounded streams are deployed. Manual live availability checks use context-free probes, hide confirmed disabled models and preserve inconclusive/quota failures. |
| 10 Projects | Implemented: instructions, model and small reference files. |
| 11 Knowledge search | Implemented and deployed in phase 11: Library → Knowledge imports PDF/text/Markdown locally, searches with keywords or optional Gemini embeddings, resumes indexing after quota pauses, and prepares chat drafts with clickable physical-page citations. Originals/vectors stay on the device; scanned PDFs need OCR. Live and preview desktop/phone checks passed. |
| 12 Memory | Implemented with inspection/deletion. |
| 13 Data analysis | Implemented in phase 4: local CSV/TSV/Excel uploads, editable pandas calculations/cleaning, Matplotlib charts, CSV/XLSX/PNG downloads and cached offline Python. CI and all 23 local browser suites passed; live and preview verified. |
| 14 Edit uploaded Office files | Implemented 2026-10-14: attached .docx/.xlsx originals stay on the device; models reply with an office-edit list (find/replace, insert/delete paragraphs, Excel cell values/formulas) that is applied inside the original, keeping fonts, tables, headers, styles and number formats. Each edit shows whether it matched; the edited copy downloads. PowerPoint editing is not included. |
| 15 Canvas | Implemented in phase 3: document/code drafts, manual edits, selected-text AI proposals with accept/reject/undo, previews, downloads and private sync. Office/PDF imports extract text; template-preserving editing remains under item 14. Deployed and verified on live and preview. |
| 16 Free tools | Implemented and deployed in phase 5b: explicit YouTube video input, Gemini Python execution with visible code/results, and a disclosed keyless Jina web reader with draft review. All 27 browser suites and CI passed; live/preview phone and desktop checks passed. Gemini search already exists. |
| 17 Images | Conditional: current Google pricing lists image models without free API access; verify key eligibility before adding. |
| 19 Assistants / prompts | Implemented in phase 2: saved helpers with instructions/model, starter helpers, reusable editable prompts and private account sync. Deployed and verified on live and preview. |
| 20 Compare | Implemented, two/three models with per-model usage. |
| 21 Organization | Projects, tags and branching implemented. Separate chat folders removed from scope at the user's request. |
| 22 Command palette | Implemented with chats/models/projects/settings. |
| 23 Voice | Implemented 2026-10-14: dictation, read-aloud and a hands-free conversation (empty message box → voice button): listens, sends after a pause, reads the reply aloud, listens again; tap to interrupt. Uses the browser's free speech features; privacy shield masks as usual. |
| 24 Sharing / chat export | Whole-chat Word/Markdown and PDF preview/system print implemented and deployed in phase 5a, including sources and Canvas. Opt-in public links implemented 2026-10-14: chat menu → Share or export → Public link; a read-only text copy under an unguessable /share/ link, personal details hidden by default, update or stop sharing any time, all links listed in Settings → Privacy & data. Rules: public get only, owner-only list/write. |
| 25 Attachment sync | Implemented 2026-10-14: thumbnails and small extracted text sync with messages; originals up to ~600 KB (images, PDFs, Word/Excel kept for editing) are saved once under the account and fetched only when another device sends or edits them; deleted with the chat. Larger files stay on the device that attached them (free Firestore documents are limited to 1 MB; Firebase file storage needs the paid plan). |
| 26 Open-time tasks | Implemented and deployed in phase 5c: one-off/daily reminders and AI requests, private schedule sync, atomic occurrence claims, time zones/DST, privacy review, separate result chats and manual retry. Runs only with the app open, visible and online. All 29 local browser suites and CI passed; live/preview desktop and phone checks passed. |
| 27 Desktop polish | Implemented 2026-10-14: installable PWA; shortcuts for new chat, palette, sidebar, Library, Settings, copy last reply, delete chat, focus message box, stop; cheat sheet (Ctrl/⌘ + / or ?); shortcut hints in tooltips. |
| 28 Performance / accessibility | Phase 10 deployed and checked: long histories render a visible window while preserving focused/selected rows; full-conversation reading and browser Find remain available. Shared nested-dialog focus/isolation, keyboard navigation, labels, contrast, reduced motion and native zoom improved. All 38 browser suites and CI passed; 144 automated accessibility scans per site passed in light/dark/black at desktop/phone widths. Physical-device and assistive-technology testing remain ongoing quality work. |
| 29 Bigger jobs | Implemented: repository reads/edits/diffs/commits/PR creation, pull-request review (phase 6), plan approval (phase 7), individual changed-block acceptance/rejection (phase 8), and latest-commit undo (phase 9). Undo creates a revert commit preserving history and the exact previous file tree; only latest single-parent commits are supported. Stale reviews, changed branches/accounts/keys and uncommitted work are guarded. Both new phases deployed and checked on live/preview at desktop/320/390px; all 36 browser suites, unit/type/build checks and final CI passed. |

## Release sequence

1. Model rejection handling, free-tier exclusions and stronger sidebar headings.
2. Custom assistants and reusable prompts.
3. Document canvas and selected-text editing.
4. Uploaded data analysis and artifact downloads.
5. Phase 5a: whole-chat exports and a confirmed shared-device account isolation fix. Phase 5b: free tools. Phase 5c: open-time tasks.
6. Coding improvements: phases 6 (PR review), 7 (plan approval), 8 (individual edit acceptance) and 9 (latest-commit undo) deployed and verified. Phases 8 and 9 shipped sequentially, with live/preview checks before starting the next.
7. Phase 10: long-chat performance and accessibility, deployed and verified on live and preview before knowledge search.
8. Phase 11: knowledge search deployed and checked on live and preview. Work paused after completion at the user's request, pending their improvements.

Arabic interface support and separate chat folders were removed from scope at the request of the user.

## New enhancement sequence

1. Multi-provider integration: Mistral, Cohere, NVIDIA NIM, Hugging Face, DeepSeek, Alibaba Cloud, Cloudflare Workers AI and Aion Labs. Complete: code and app-owned default relay deployed and hosted-verified on 2026-10-12 at desktop/320/390/430px and phone landscape; local Chromium/WebKit checks passed. Real NVIDIA catalogue discovery through the default relay passed in phone-sized Chromium/WebKit on both sites. Additional APIs require explicit billing opt-in and user-supplied keys; custom relay remains optional. GitHub Models was retired July 30, 2026 and is explained as unavailable. Task 2 was subsequently authorized and completed.
2. Visual/mobile redesign, especially Projects: completed, deployed and hosted-verified on 2026-10-13. Quiet navigation, consistent Geist typography and surfaces, desktop project context/phone disclosure, full-width project forms, readable phone chat headers, native zoom and accessible project actions. Final CI passed all 41 suites; hosted Chromium/WebKit checks passed at 1280/320/390/430px and phone landscape. Task 3 was subsequently authorized.
3. Sent-message navigation timeline: completed, deployed and hosted-verified on 2026-10-13. Clickable line overview on desktop and phones, exact older-turn jumps through the virtualizer. The message-list icon/count and dialog were subsequently removed at the user's request. Auto-added context is excluded; drafts and streaming reading position are preserved. Local and hosted Chromium/WebKit passed all five target viewports on both sites; final CI passed all 42 browser suites plus type/build/unit checks. Stop after this task; no additional roadmap work is authorized.

Keep controls compact. Preserve original free-model filtering, explicit additional-provider billing consent, account privacy, drafts and confirmations for external changes. Implement, test, deploy and verify each task individually; stop and ask the user before beginning the next.

## Current requested layout update

Claude screenshot composition adapted for desktop and phone; native Add to Chat sheet, GitHub Settings Connectors, saved canvas Artifacts navigation and real incognito implemented. Deployed live/preview as 15fc559; hosted Chromium/WebKit layout, incognito/Connectors and native safe-area checks passed. Latest full CI remains in progress. This is the authorized task; do not start another roadmap feature without confirmation.

## Design and quality pass (2026-10-14)

Done before new roadmap work, at the user's request; deployed live.

- Own identity ("Switchboard"): cool neutrals, one lime signal colour, new app icon, lime sparkles on new
  chats, routing chip in the top bar, routing line while a reply loads, reading layout, motion, dark depth.
- Cleaner sidebar (avatar opens Settings; phone New chat bottom-right) and Projects (one page, one form).
- Settings redesigned tab by tab; one provider list with search and a filter dropdown; new Usage tab.
- Secondary screens: Library, Knowledge, Documents, command palette, Canvas.
- Engineering: ten stylesheets merged into src/app.css (dead/overridden rules removed, pixel-checked);
  startup JavaScript ~534 KB → ~399 KB gzipped (KaTeX, highlight.js and rarely opened screens load on
  demand); CI about 12 minutes; manual Safari (WebKit) screenshot workflow.

Still open from the table above: 17 (images, waiting on free
access), First-run guidance for invited users was suggested and deferred by the user.
