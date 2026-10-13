# Model Router

A private AI workspace for chat, documents, data analysis and GitHub coding. Users supply their own provider and GitHub keys. Existing free-tier providers remain available; additional providers may consume credits or incur charges only after explicit per-provider opt-in. The product serves phone and desktop use; preserve drafts, account isolation, privacy review and explicit actions for external writes.

## Product direction

Keep a clean, professional conversation workspace at the craft level of ChatGPT/Claude: clear groups, restrained decoration and a spacious writing area. Preserve light, dark and true-black appearances. `DESIGN.md` records the implemented system; `src/workspace.css` supplies the final presentation overrides after `styles.css` and `design.css`. Functional phone keyboard rules remain in `lib/viewport.ts` and `touch.css`. App controls should explain useful decisions without exposing unnecessary implementation details.

Projects have a writing/conversation column and adjacent reference files/instructions on desktop. On phones, project context is expandable; project forms use full-width fields and wrapping color choices. Workspace selection uses the selected project even when another project's chat was previously open. New chat opens the regular composer, preserving project instructions, model and files. Workspace defaults are edited in project settings; model selection in an actual chat changes that chat. Conversation titles are native buttons. Narrow chat headers put project context on a separate row so model selection remains readable. Native pinch zoom is enabled; no automatic keyboard opening is required when creating a project.

## Provider connections

Settings → API keys supports the existing Google AI Studio, OpenRouter, Groq and Cerebras connections plus Mistral, Cohere, NVIDIA NIM, Hugging Face Inference Providers, DeepSeek, Alibaba Cloud Model Studio, Cloudflare Workers AI and Aion Labs. Additional connections start disabled. A saved key alone never authorizes a catalogue or inference request: users must enable that provider's credit/charge checkbox and save. Enabled models can participate in Auto, fallbacks, comparisons, titles and open-time tasks. The app cannot distinguish free credits from paid balances; users should configure provider-side spending caps.

Live catalogues determine available chat models, supported modalities and context where supplied. Deprecated/non-chat models are excluded; key, quota and network failures do not count as model retirement. New providers have separate usage counters and preserve the normal privacy, attachment extraction and account-isolation flows. Original providers retain their free-model catalogue policy.

NVIDIA/Cloudflare use the app-owned HTTPS relay at `model-router-provider-relay.model-router.workers.dev` because their APIs block browser requests. Leaving the custom relay URL blank uses that default; users can override it with a relay they control. Settings disclose that provider keys and prompts pass through the relay, which stores neither. `server/provider-relay` provides its BYOK Worker and deployment instructions; the app does not use a public CORS proxy. Cloudflare also needs a 32-character account ID matching its token. Alibaba's endpoint must match the key's official region/workspace URL. Credentials and connection options save privately with the account and remain isolated across account changes.

GitHub Models was retired on July 30, 2026; its inference API is unavailable and settings explain this. GitHub repository coding remains separate. Provider tests use synthetic keys and mocked inference; WebKit checks validate Safari-engine behavior, not physical iPhone devices or actual paid account access.

## Repository plan flow

1. Connect a repository and enable **Plan** beside its composer controls.
2. Send the task. The model inspects files and proposes ordered steps with affected paths.
3. Review, revise or reject the plan. **Approve plan** prepares an editable implementation draft; sending it passes through normal privacy checks and starts the work.
4. Review proposed edits, accept/reject individual changed blocks locally, and use the explicit commit/PR flow for GitHub writes. Rejected blocks stay rejected during Apply all.
5. Check each plan step after reviewing its changes and verification, then finish the review. Checkboxes record the user's review; they do not execute tests or certify that tests passed.

Planning replies cannot authorize edits. Approval belongs to a particular plan, repository/branch, conversation, local workspace snapshot and device. Reloading an approved but unsent plan requires renewed approval. Incomplete, failed or stopped plans require a fresh proposal. Earlier plans and plans from another device remain readable without transferring approval.

## Long conversations and keyboard access

Conversations above 120 messages render a small visible window while keeping focused controls and selected text mounted. **Show full conversation** restores every message for continuous reading; Ctrl/Cmd+F also enables it for browser search. This changes rendering only, not stored messages, AI context or exports. Jump-to-latest respects reduced motion. Conversations with two or more sent questions have a quiet, clickable line navigator on both desktop and phones. It samples large histories to fit the available conversation height, includes the first/latest questions and marks the current position. Lines have 44px hit targets; their accessible labels include question previews or attachment names. Automatic file/repository context is excluded. Choosing a line mounts and focuses its original turn, preserves the composer draft and prevents an arriving reply from pulling the reader to the end. The message-list icon, count and searchable dialog were removed at the user's request. Clicking/tapping a timeline line does not outline the destination message; keyboard activation retains a visible focus indicator.

Dialogs share nested focus handling, background isolation and focus restoration. Local Escape actions dismiss search, menus or edits before their enclosing dialog. Phone dialogs avoid restoring focus to text inputs and reopening the keyboard. Native page zoom is enabled; keyboard users can skip directly to the message input. Automated accessibility checks cover the three appearances and desktop/phone layouts, with keyboard and semantic checks; they do not replace testing on physical devices or with assistive technology.

## Knowledge search

Library → Knowledge imports PDFs with selectable text, text files and Markdown. Keyword search works locally and offline. **Index meaning** explicitly sends extracted text to Google's Gemini Embedding 2 using the user's key; model access is checked first, detected personal details are masked when the privacy shield is enabled, and Ask-me reviews detected details before indexing. It uses the model's standard endpoint, with no paid-model fallback.

Indexing saves each completed passage, continues while the Library is closed, pauses during chat replies, stops when hidden/offline or when the account/key/privacy settings change, and can be resumed after a free quota resets. Originals and vectors stay in an account-specific device database; they do not sync. Limits: 100 documents, 250 MB of originals, 75 MB each, 3,000 PDF pages and 30 million extracted characters per document. Scanned PDFs need OCR before import.

Search shows document/page evidence and **View source**. **Ask with these sources** prepares the question and top three pages as a normal editable chat draft; it does not send automatically. Chat replies have clickable document citations and saved excerpts. PDF references use physical PDF page numbers, not printed book numbering; text/Markdown references use numbered text sections. Deleting a library document removes its original and index; existing chats retain their citation excerpts. Excerpts and citation metadata sync with chats, allowing inspection when the original is unavailable on another device. Exports retain document/page references.

Embedding access, limits and answer quality depend on the user's provider key. Automated tests use real PDF extraction and mocked provider responses, not live user keys.

## Scope

The repository panel can preview and undo the latest non-merge commit with an explicit Undo and push action. It creates a revert commit restoring the previous tree; history is preserved. Uncommitted work blocks undo, and branch/account/key changes require a fresh preview. Merge, first and empty commits are not supported. Separate chat folders are excluded at the user's request.

`ROADMAP.md` tracks implemented features and remaining phases. Arabic interface support is excluded at the user's request. Deliver enhancements one task at a time, test and verify, then stop for user confirmation before the next task. Preserve existing free-provider behavior, explicit billing consent and account privacy. `HANDOFF.md` records operational context and the latest verified release.

## New-chat welcome

The empty chat shows one short, single-line greeting above the composer, with no recommendation cards or gray subtitle. Five greetings rotate on New chat, including reuse of an existing empty chat; typing does not change the greeting. The session-only greeting counter is not synced or persisted. Repository, file, Canvas and analysis tools remain in the + menu. Empty chats without projects normalize their project identity before reuse, preserving the draft instead of creating duplicate empty chats.
