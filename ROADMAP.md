# Roadmap status

Audit: 2026-10-11. Only mark a feature complete after its working implementation is deployed and checked.

| Item | Status / remaining work |
| --- | --- |
| 9 Smart routing | Implemented; maintain model access and capabilities. |
| 10 Projects | Implemented: instructions, model and small reference files. |
| 11 Knowledge search | Missing: large-library indexing, retrieval and page citations. |
| 12 Memory | Implemented with inspection/deletion. |
| 13 Data analysis | Implemented in phase 4: local CSV/TSV/Excel uploads, editable pandas calculations/cleaning, Matplotlib charts, CSV/XLSX/PNG downloads and cached offline Python. CI and all 23 local browser suites passed; live and preview verified. |
| 14 Edit uploaded Office files | Partial: reads files and creates new documents; template-preserving editing remains. |
| 15 Canvas | Implemented in phase 3: document/code drafts, manual edits, selected-text AI proposals with accept/reject/undo, previews, downloads and private sync. Office/PDF imports extract text; template-preserving editing remains under item 14. Check Actions for deployment status. |
| 16 Free tools | Implemented and deployed in phase 5b: explicit YouTube video input, Gemini Python execution with visible code/results, and a disclosed keyless Jina web reader with draft review. All 27 browser suites and CI passed; live/preview phone and desktop checks passed. Gemini search already exists. |
| 17 Images | Conditional: current Google pricing lists image models without free API access; verify key eligibility before adding. |
| 18 Arabic interface | Missing: full translation and RTL app navigation (Arabic content already works). |
| 19 Assistants / prompts | Implemented in phase 2: saved helpers with instructions/model, starter helpers, reusable editable prompts and private account sync. Check Actions for deployment status. |
| 20 Compare | Implemented, two/three models with per-model usage. |
| 21 Organization | Projects, tags and branching implemented; separate folders remain. |
| 22 Command palette | Implemented with chats/models/projects/settings. |
| 23 Voice | Partial: dictation/read-aloud; continuous conversation remains. |
| 24 Sharing / chat export | Whole-chat Word/Markdown and PDF preview/system print implemented and deployed in phase 5a, including sources and Canvas. Desktop/phone checks passed on live and preview. Opt-in public links remain. |
| 25 Attachment sync | Partial: thumbnails/small extracted text sync; small original binaries remain. |
| 26 Open-time tasks | Implemented and deployed in phase 5c: one-off/daily reminders and AI requests, private schedule sync, atomic occurrence claims, time zones/DST, privacy review, separate result chats and manual retry. Runs only with the app open, visible and online. All 29 local browser suites and CI passed; live/preview desktop and phone checks passed. |
| 27 Desktop polish | Partial: installable PWA; desktop controls/shortcuts need audit. |
| 28 Performance / accessibility | Partial: responsive UI, font sizes, focus and gestures; long-history virtualization/full accessibility audit remain. |
| 29 Bigger jobs | Partial: repository reads/edits/diffs/commits/PR creation; plan approval, finer acceptance, PR review and commit undo need audit/implementation. |

## Release sequence

1. Model rejection handling, free-tier exclusions and stronger sidebar headings.
2. Custom assistants and reusable prompts.
3. Document canvas and selected-text editing.
4. Uploaded data analysis and artifact downloads.
5. Phase 5a: whole-chat exports and a confirmed shared-device account isolation fix. Phase 5b: free tools. Phase 5c: open-time tasks.
6. Larger remaining features, each in a separately verified release.

Keep user-visible controls compact. Preserve free-only operation, account privacy, drafts and safe confirmations for external changes. Deploy each phase to live and preview before starting the next.
