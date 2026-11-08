# Lumen

A private AI workspace for phone and desktop: chat with free and bring-your-own-key models, documents,
data analysis, knowledge search and GitHub coding. Live at https://lumen-chat.web.app
(Firebase project `the-model-router`, invite-only).

The app uses React, TypeScript and Vite. Provider integrations live in `src/lib/ai/`; Firebase handles
Google sign-in, hosting and per-account Firestore storage. Chats are also cached locally in IndexedDB.

```bash
npm ci
npm run dev                        # local development
npm test                           # typecheck + unit tests
npm run build                      # ordinary build -> dist/
LUMEN_CANVAS=1 npm run build        # production Canvas presentation
npm run test:affected -- --run      # checks selected for the changed files
npm run test:e2e -- welcome layout  # selected browser suites
```

[HANDOFF.md](HANDOFF.md) is the current checkpoint; [AGENTS.md](AGENTS.md) explains how agents keep it updated.
`npm run handoff` optionally reports live git, GitHub and deployment state (`-- --offline` for local git only).

Operational references: [provider relay](server/provider-relay/README.md),
[WebKit checks](tests/webkit/README.md), [SideStore releases](docs/ios/SIDESTORE_RELEASES.md).
Third-party licences: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and [Python wheels](public/python/README.md).
