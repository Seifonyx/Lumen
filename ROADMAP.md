# Roadmap status

Audit: 2026-10-12. Only mark a feature complete after its working implementation is deployed and checked.

| Item | Status / remaining work |
| --- | --- |
| 9 Smart routing | Implemented; maintain model access and capabilities. Recent response timings improve simple Auto choices; eligible stalled starts switch after 8s. Provider-diverse fallback, transient cooldowns and bounded streams are deployed. Manual live availability checks use context-free probes, hide confirmed disabled models and preserve inconclusive/quota failures. |
| 10 Projects | Implemented: instructions, model and small reference files. |
| 11 Knowledge search | Implemented and deployed in phase 11: Library → Knowledge imports PDF/text/Markdown locally, searches with keywords or optional Gemini embeddings, resumes indexing after quota pauses, and prepares chat drafts with clickable physical-page citations. Originals/vectors stay on the device; scanned PDFs need OCR. Live and preview desktop/phone checks passed. |
| 12 Memory | Implemented with inspection/deletion. |
| 13 Data analysis | Implemented in phase 4: local CSV/TSV/Excel uploads, editable pandas calculations/cleaning, Matplotlib charts, CSV/XLSX/PNG downloads and cached offline Python. CI and all 23 local browser suites passed; live and preview verified. |
| 14 Edit uploaded Office files | Partial: reads files and creates new documents; template-preserving editing remains. |
| 15 Canvas | Implemented in phase 3: document/code drafts, manual edits, selected-text AI proposals with accept/reject/undo, previews, downloads and private sync. Office/PDF imports extract text; template-preserving editing remains under item 14. Deployed and verified on live and preview. |
| 16 Free tools | Implemented and deployed in phase 5b: explicit YouTube video input, Gemini Python execution with visible code/results, and a disclosed keyless Jina web reader with draft review. All 27 browser suites and CI passed; live/preview phone and desktop checks passed. Gemini search already exists. |
| 17 Images | Conditional: current Google pricing lists image models without free API access; verify key eligibility before adding. |
| 19 Assistants / prompts | Implemented in phase 2: saved helpers with instructions/model, starter helpers, reusable editable prompts and private account sync. Deployed and verified on live and preview. |
| 20 Compare | Implemented, two/three models with per-model usage. |
| 21 Organization | Projects, tags and branching implemented. Separate chat folders removed from scope at the user's request. |
| 22 Command palette | Implemented with chats/models/projects/settings. |
| 23 Voice | Partial: dictation/read-aloud; continuous conversation remains. |
| 24 Sharing / chat export | Whole-chat Word/Markdown and PDF preview/system print implemented and deployed in phase 5a, including sources and Canvas. Desktop/phone checks passed on live and preview. Opt-in public links remain. |
| 25 Attachment sync | Partial: thumbnails/small extracted text sync; small original binaries remain. |
| 26 Open-time tasks | Implemented and deployed in phase 5c: one-off/daily reminders and AI requests, private schedule sync, atomic occurrence claims, time zones/DST, privacy review, separate result chats and manual retry. Runs only with the app open, visible and online. All 29 local browser suites and CI passed; live/preview desktop and phone checks passed. |
| 27 Desktop polish | Partial: installable PWA; desktop controls/shortcuts need audit. |
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

1. Multi-provider integration: Mistral, Cohere, NVIDIA NIM, Hugging Face, DeepSeek, Alibaba Cloud, Cloudflare Workers AI and Aion Labs. Integration code deployed and hosted-verified on 2026-10-12 at desktop/320/390/430px and phone landscape; local Chromium/WebKit checks passed. Additional APIs require explicit billing opt-in. NVIDIA/Cloudflare relay is now user-authorized, deployed and live-checked; app-default routing follow-up is being released. Users still supply their own provider keys; custom relay remains optional. GitHub Models was retired July 30, 2026 and is explained as unavailable. Stop before Task 2, awaiting confirmation.
2. Visual/mobile redesign, especially Projects: awaiting confirmation after Task 1.
3. Sent-message navigation timeline: awaiting confirmation after Task 2.

Keep controls compact. Preserve original free-model filtering, explicit additional-provider billing consent, account privacy, drafts and confirmations for external changes. Implement, test, deploy and verify each task individually; stop and ask the user before beginning the next.
