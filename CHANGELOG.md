# Changelog

## 1.1.0 · Smoother motion

- Nothing vanishes any more: menus, sheets, windows, the command palette and notifications now slide or
  fade away when they close, the way they arrived.
- Deleted chats slide out, and the rest of the list closes the gap smoothly. Pinning or starting a chat
  moves rows to their new place instead of jumping.
- Settings on phones moves like a native app: it slides in from the right, each section pushes in over the
  list, and going back slides it away again. On computers it crossfades.
- Changing the theme crossfades the whole screen from the old colours to the new ones.
- A sheet you drag down and let go leaves from where your finger was, without jumping back first.
- With "reduce motion" turned on in your phone or computer settings, all of this is switched off.

## 1.0.1 · Faster and steadier

- Opening a long chat is immediate: the sidebar slides away as soon as you tap, the newest messages show
  first and older ones fill in behind them. On a mid-range phone it went from about 2.3 seconds of
  frozen screen to under a tenth of a second.
- Menus and sheets (model picker, +, usage, chat menu, new chat) open about twice as fast when a long chat
  is open.
- Chats open on the latest message instead of just above it.
- Sending a message always brings it into view, even if you had scrolled up a little.
- Buttons under earlier messages no longer disappear and pop back while a reply is being written.
- Switching theme changes everything in the same frame (no half light, half dark moment).
- The True black theme no longer flashes dark grey when the app opens, and the phone's status bar now
  matches the theme you picked.
- After reloading, model names show straight away instead of a raw id until the list loads.

## 1.0.0 · 2026-10-14

The first official release of **Lumen**: a private chat app that connects you to free AI models using your own keys.

**Open it at https://lumen-chat.web.app** (the old model-router.web.app address forwards there).

### Highlights
- **One app, many free models**: Google AI Studio (Gemini), OpenRouter, Groq and Cerebras built in, plus optional Mistral, Cohere, NVIDIA, Hugging Face, Cloudflare and more.
- **Auto routing** picks a model for each message, explains why ("Why this model"), skips models at their limits, and can be steered (keep a model out, prefer a provider).
- **Model health**: one-tap check removes models that can't answer, a quiet weekly re-check, and a list of removed models with reasons.
- **Files and documents**: read PDFs and images, create Word, Excel and PowerPoint files, edit uploaded Word files keeping their formatting, Canvas documents, data analysis.
- **Voice**: dictation and hands-free voice conversations. **Images** through Cloudflare or Hugging Face.
- **Projects, Library and Knowledge**: project instructions and default models, saved assistants and prompts, searchable documents with page citations.
- **Scheduled tasks** with notifications, **share links**, **memory**, incognito chats, and a **privacy shield** that hides personal details before they leave your device.
- **Works on phones**: installable app, draggable bottom sheets, swipe-in sidebar, light, dark and black themes.

### New in 1.0
- New name, Eclipse icon and address.
- General-purpose defaults for everyone.
- Settings → About: version, "Report a problem", Privacy Policy and Terms.
- Settings → Privacy & data → **Delete my account and data**.
- Sidebar: outlined New project / New chat chips, View all chats (select, move, export, delete), clearer text levels.
- Usage as a sheet on phones with gauges for this chat and today's requests.

Free to use; your chats and keys stay private to your account. See the [Privacy Policy](https://lumen-chat.web.app/privacy.html).
