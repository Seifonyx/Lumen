# Model Router

A private, free-tier AI workspace for chat, documents, data analysis and GitHub coding. Users supply their own provider and GitHub keys. The product serves phone and desktop use; preserve drafts, account isolation, privacy review and explicit actions for external writes.

## Product direction

Keep the interface clean, professional and compact, consistent with the current app. Existing light, dark and true-black themes are authoritative. Extend the palette and component conventions in `src/design.css`; functional responsive layouts remain in `styles.css`. App controls should explain useful decisions without exposing unnecessary implementation details.

## Repository plan flow

1. Connect a repository and enable **Plan** beside its composer controls.
2. Send the task. The model inspects files and proposes ordered steps with affected paths.
3. Review, revise or reject the plan. **Approve plan** prepares an editable implementation draft; sending it passes through normal privacy checks and starts the work.
4. Review proposed edits, accept/reject individual changed blocks locally, and use the explicit commit/PR flow for GitHub writes. Rejected blocks stay rejected during Apply all.
5. Check each plan step after reviewing its changes and verification, then finish the review. Checkboxes record the user's review; they do not execute tests or certify that tests passed.

Planning replies cannot authorize edits. Approval belongs to a particular plan, repository/branch, conversation, local workspace snapshot and device. Reloading an approved but unsent plan requires renewed approval. Incomplete, failed or stopped plans require a fresh proposal. Earlier plans and plans from another device remain readable without transferring approval.

## Long conversations and keyboard access

Conversations above 120 messages render a small visible window while keeping focused controls and selected text mounted. **Show full conversation** restores every message for continuous reading; Ctrl/Cmd+F also enables it for browser search. This changes rendering only, not stored messages, AI context or exports. Jump-to-latest respects reduced motion.

Dialogs share nested focus handling, background isolation and focus restoration. Local Escape actions dismiss search, menus or edits before their enclosing dialog. Phone dialogs avoid restoring focus to text inputs and reopening the keyboard. Native page zoom is enabled; keyboard users can skip directly to the message input. Automated accessibility checks cover the three appearances and desktop/phone layouts, with keyboard and semantic checks; they do not replace testing on physical devices or with assistive technology.

## Knowledge search

Library → Knowledge imports PDFs with selectable text, text files and Markdown. Keyword search works locally and offline. **Index meaning** explicitly sends extracted text to Google's Gemini Embedding 2 using the user's key; model access is checked first, detected personal details are masked when the privacy shield is enabled, and Ask-me reviews detected details before indexing. It uses the model's standard endpoint, with no paid-model fallback.

Indexing saves each completed passage, continues while the Library is closed, pauses during chat replies, stops when hidden/offline or when the account/key/privacy settings change, and can be resumed after a free quota resets. Originals and vectors stay in an account-specific device database; they do not sync. Limits: 100 documents, 250 MB of originals, 75 MB each, 3,000 PDF pages and 30 million extracted characters per document. Scanned PDFs need OCR before import.

Search shows document/page evidence and **View source**. **Ask with these sources** prepares the question and top three pages as a normal editable chat draft; it does not send automatically. Chat replies have clickable document citations and saved excerpts. PDF references use physical PDF page numbers, not printed book numbering; text/Markdown references use numbered text sections. Deleting a library document removes its original and index; existing chats retain their citation excerpts. Excerpts and citation metadata sync with chats, allowing inspection when the original is unavailable on another device. Exports retain document/page references.

Embedding access, limits and answer quality depend on the user's provider key. Automated tests use real PDF extraction and mocked provider responses, not live user keys.

## Scope

The repository panel can preview and undo the latest non-merge commit with an explicit Undo and push action. It creates a revert commit restoring the previous tree; history is preserved. Uncommitted work blocks undo, and branch/account/key changes require a fresh preview. Merge, first and empty commits are not supported. Separate chat folders are excluded at the user's request.

`ROADMAP.md` tracks implemented features and remaining phases. Arabic interface support is excluded at the user's request. Deliver coding improvements in separately tested and verified deployments; keep existing free-only operation and account privacy intact. `HANDOFF.md` records operational context and the latest verified release.
