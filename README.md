# Model Router

A private, phone-friendly AI chat that brings free models from **Google AI Studio (Gemini)** and
**OpenRouter** together in one place, and switches to another model automatically when one hits its
free limit. It reads your files and creates real Word, Excel, PowerPoint and PDF documents.

## Features

- **One chat, many models** – pick any model per chat, or retry an answer with a different one.
- **Automatic switching** – if a model hits its usage limit or fails, the next model in your list answers.
- **Model manager** – browse every free Gemini and OpenRouter model and choose which appear (Settings → Models).
- **Attachments** – PDF, Word, Excel, PowerPoint, images (incl. camera), CSV and text files; drag & drop or paste.
- **Creates files** – ask for a document, spreadsheet or presentation and get a file card with preview + save:
  - Word: cover page, headers, page numbers, coloured headings, tables, callouts, Arabic right-to-left.
  - Excel: colours, number/currency/percent/date formats, formulas, totals, conditional formatting, frozen headers, filters, several sheets.
  - PowerPoint: themes, title/section/bullets/two-column/table/chart/stats/timeline/quote slides, native charts, speaker notes.
  - PDF (via the print dialog), CSV, HTML (live preview), code and text files.
- **Charts in chat**, LaTeX maths, highlighted code with copy buttons.
- **Web search** with sources (Gemini models) and collapsible **thinking**.
- Edit & resend, regenerate, stop, copy, read aloud, voice input, save a reply as Word.
- Chat history with search, pin, rename, export, plus backup/restore.
- Custom instructions, light/dark theme, text size, installable on the home screen.

## Setup (Vercel)

Environment variables (Settings → Environment Variables), then redeploy:

| Key | Value |
|---|---|
| `APP_PASSWORD` | the password for signing in |
| `GEMINI_API_KEY` | key from aistudio.google.com |
| `OPENROUTER_API_KEY` | key from openrouter.ai (optional) |
| `GEMINI_MODELS`, `OPENROUTER_MODELS` | optional, comma-separated starting model list; you can change models in the app |

`vercel.json` tells Vercel to build with Vite; the `api/` folder holds the edge functions.

## Development

```bash
npm ci
npm run build      # outputs dist/
npm run typecheck
```

Chats are stored in the browser (IndexedDB) on each device. Free tiers may use conversations to improve
the providers' models, so don't send patient or confidential data.
