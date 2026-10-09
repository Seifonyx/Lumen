# Model Router

A private, phone-friendly AI chat that brings free models from **Google AI Studio (Gemini)**,
**OpenRouter**, **Groq** and **Cerebras** together in one place, and switches to another model automatically when one hits its
free limit. It reads your files and creates real Word, Excel, PowerPoint and PDF documents.

Live at **https://model-router.web.app** (Firebase project `the-model-router`).

## Features

- **Invite-only**: only the Google accounts listed in `firestore.rules` can use the app; others see a "Not invited" screen.
- **Google sign-in**; API keys are entered once in Settings → API keys and saved privately in Firestore.
- **One chat, many models**: pick any model per chat, or retry an answer with a different one.
- **Auto routing**: picks the best enabled model for each message (images, long documents, code, maths, web search, files, Arabic, quick replies) and saves the scarce Pro limits for heavy work. A manually chosen model is kept unless it can't handle the message.
- **Automatic switching**: if a model hits its limit, errors, hangs (no response in 45 s), returns nothing or is blocked, the next model answers; a rejected key skips that provider's other models.
- **Usage meter** (Settings → Usage): requests and tokens per model today, daily limits learned from the providers, and models at their limit skipped until they reset. Shared across devices.
- **Model manager**: browse every free Gemini, OpenRouter, Groq and Cerebras model and choose which appear (Settings → Models).
- **Attachments**: PDF, Word, Excel, PowerPoint, images (incl. camera), CSV and text files; drag & drop or paste.
- **Creates files** with preview and save:
  - Word: cover page, headers, page numbers, coloured headings, tables, callouts, Arabic right-to-left.
  - Excel: colours, number/currency/percent/date formats, formulas, totals, conditional formatting, frozen headers, filters, several sheets.
  - PowerPoint: themes, title/section/bullets/two-column/table/chart/stats/timeline/quote slides, native charts, speaker notes.
  - PDF (via the print dialog), CSV, HTML (live preview), code and text files.
- **Charts in chat**, LaTeX maths, highlighted code with copy buttons.
- **Web search** with sources (Gemini models) and collapsible **thinking**.
- Edit & resend, regenerate, stop, copy, read aloud, voice input, save a reply as Word.
- **Syncs across devices**: chats (with pins and renames) and settings follow your Google account.
- Chat history with search, pin, rename, export, plus backup/restore.
- Custom instructions, light/dark theme, text size, installable on the home screen.

## How it works

Everything runs in the browser. The app calls Google AI Studio, OpenRouter, Groq and Cerebras directly with the
signed-in user's own keys (`src/lib/ai/`). Firebase provides hosting, Google sign-in and Firestore:

- `modelRouter/{uid}`: API keys and shared settings
- `modelRouter/{uid}/chats/{chatId}`: chat details; `…/messages/{messageId}`: one document per message

`firestore.rules` limits each user to their own `modelRouter/{uid}` section. Chats are also kept on each
device in IndexedDB (`src/lib/sync.ts` keeps the two in step). Attachment contents stay on the device
that added them; names, thumbnails and small extracted texts sync.

For local testing against the Firebase emulators (auth on 9099, Firestore on 8080), open the app on
`http://localhost:…/?emulator`.

## Development

```bash
npm ci
npm run build       # outputs dist/
npm run typecheck
npm run deploy      # build + upload to Firebase Hosting (needs Google credentials)
```

`scripts/deploy_firebase.py` deploys through the Firebase Hosting REST API using the settings in
`firebase.json`; with the Firebase CLI you can use `firebase deploy --only hosting` instead.

## Tests

GitHub runs every test on each push (see the **Actions** tab, workflow `Tests`).

```bash
npm test                 # type check + unit tests (routing, rerouting, compacting, memory)
npm run build
npx firebase-tools@15.30.2 emulators:start --only auth,firestore --project the-model-router
npm run test:e2e         # in-app tests in Chromium against the emulators (another terminal)
npm run test:e2e -- memory offline   # just some of them
```

The in-app tests (`tests/e2e`) sign in through the Firebase emulators, fake the AI providers, and
check sync between two devices, invite-only access, Auto routing and switching, usage limits,
long-chat compacting, memory, generated Word/Excel/PowerPoint files, the free-plan guard, and
offline mode with the update prompt. Screenshots land in `tests/e2e/out`.

Free tiers may use conversations to improve the providers' models, so don't send patient or
confidential data.
