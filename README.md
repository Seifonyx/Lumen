# TheModelRouter

A private, phone-friendly AI chat that brings free models from **Google AI Studio (Gemini)** and
**OpenRouter** together in one place, and switches to another model automatically when one hits its
free limit. It reads your files and creates real Word, Excel, PowerPoint and PDF documents.

Live at **https://themodelrouter.web.app** (Firebase Hosting, project `study-planner-a2291`).

## Features

- **Google sign-in**; API keys are entered once in Settings → API keys and saved privately in Firestore.
- **One chat, many models**: pick any model per chat, or retry an answer with a different one.
- **Automatic switching**: if a model hits its usage limit or fails, the next model in your list answers.
- **Model manager**: browse every free Gemini and OpenRouter model and choose which appear (Settings → Models).
- **Attachments**: PDF, Word, Excel, PowerPoint, images (incl. camera), CSV and text files; drag & drop or paste.
- **Creates files** with preview and save:
  - Word: cover page, headers, page numbers, coloured headings, tables, callouts, Arabic right-to-left.
  - Excel: colours, number/currency/percent/date formats, formulas, totals, conditional formatting, frozen headers, filters, several sheets.
  - PowerPoint: themes, title/section/bullets/two-column/table/chart/stats/timeline/quote slides, native charts, speaker notes.
  - PDF (via the print dialog), CSV, HTML (live preview), code and text files.
- **Charts in chat**, LaTeX maths, highlighted code with copy buttons.
- **Web search** with sources (Gemini models) and collapsible **thinking**.
- Edit & resend, regenerate, stop, copy, read aloud, voice input, save a reply as Word.
- Chat history with search, pin, rename, export, plus backup/restore.
- Custom instructions, light/dark theme, text size, installable on the home screen.

## How it works

Everything runs in the browser. The app calls Google AI Studio and OpenRouter directly with the
signed-in user's own keys (`src/lib/ai/`). Firebase provides hosting, Google sign-in and a Firestore
document per user at `modelRouter/{uid}` for the keys; `firestore.rules` limits each user to their own
document. Chats are stored on each device in IndexedDB.

## Development

```bash
npm ci
npm run build       # outputs dist/
npm run typecheck
npm run deploy      # build + upload to Firebase Hosting (needs Google credentials)
```

`scripts/deploy_firebase.py` deploys through the Firebase Hosting REST API using the settings in
`firebase.json`; with the Firebase CLI you can use `firebase deploy --only hosting` instead.

Free tiers may use conversations to improve the providers' models, so don't send patient or
confidential data.
