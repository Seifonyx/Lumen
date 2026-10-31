# Lumen

A private AI workspace for phone and desktop: chat with free and bring-your-own-key models that Lumen routes per
message, plus documents, data analysis, knowledge search and GitHub coding. Live at **https://lumen-chat.web.app**
(Firebase project `the-model-router`, invite-only).

Everything runs in the browser with the signed-in user's own provider keys (`src/lib/ai/`). Firebase provides
hosting, Google sign-in and Firestore (`modelRouter/{uid}` for keys and settings, `…/chats/{chatId}/messages/…` for
history; `firestore.rules` keeps each user to their own section). Chats are also cached per device in IndexedDB.

```bash
npm ci
npm test                 # typecheck + unit tests
npm run build            # ordinary build → dist/   (LUMEN_CANVAS=1 for the production Canvas presentation)
npm run test:e2e         # in-app tests; see scripts/test-e2e.mjs for emulator setup
```

Working on Lumen: start with [AGENTS.md](AGENTS.md), then [HANDOFF.md](HANDOFF.md) and [DESIGN.md](DESIGN.md).
Third-party licences: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
