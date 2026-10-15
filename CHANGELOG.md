# Changelog

## 1.6.0 · Moonlight

- A new crescent moon. Every new chat starts with Lumen's eclipse: a thin ring of light whose shadow slides
  away to reveal a glowing crescent, with two sparkles popping in beside it. It then floats and glows softly.
- While a reply is on its way, a tiny moon goes through its phases (instead of a pulsing dot).
- Sending: a ring ripples out of the send button, and the new-chat welcome lifts away as your first
  message rises into place.
- When a reply finishes, its buttons rise in one after another and the model's dot gives a small glow.
- Menus, the model list, the + menu, Settings and (on phones) the chat list flow in one item at a time.
- The copy tick draws itself; a warning notification gives a small shake; the + on New chat turns as you
  press it.
- The sign-in screen: the Lumen mark arrives with a glow and the rest rises in after it.
- While a reply is being written, the Lumen mark in the sidebar glows softly.
- With "reduce motion" turned on in your device settings, all of this stays still.

## 1.5.1

- Fixed: on slower phones, press-and-hold on a message could be cancelled by the conversation scrolling itself.
- Fixed: catching a sheet while it moves no longer makes it jump slightly.

## 1.5.0 · Opens instantly

- Lumen opens straight away: it starts from the copy of your settings and chats on your device and refreshes
  them in the background, instead of waiting for the internet first.
- When opened from the iPhone home screen, Lumen shows its icon on a light or dark background (matching your
  phone) while it starts, instead of a white screen.
- While a reply is being written, the conversation glides down with it instead of jumping a line at a time.
- With the keyboard open, drag the conversation down to hide it (what you typed stays). On iPhone the
  message box now slides smoothly with the keyboard instead of jumping.
- If a reply is being written or finishes while you're reading further up, the arrow button says
  "Writing…" or "New reply". Tapping it glides you down to it, even from far up.
- Text size has a new Auto option, now the standard: on iPhone and iPad, Lumen's text follows the size you
  chose in your device's settings. If you picked a size before, choose Auto in Settings → General → Text size.
- Optional: a soft sound when you send (Settings → General → Sound when sending; off by default). On iPhone
  it follows the silent switch.

## 1.4.0 · The finishing touches

- Smoother everywhere: when you let go of a sheet, the side menu, a swiped chat or a photo, the rest of the
  motion is now run by the phone's graphics hardware at the screen's full rate, instead of being worked
  out frame by frame by the app. Before, anything else the app was doing (or Low Power Mode on iPhone,
  which slows that frame-by-frame work to 30 frames a second) made it stutter. The Settings slide, the
  side menu and the swipe-back no longer redraw shadows and dimming every frame.
- Sending feels like a messaging app: your message rises out of the text box with a soft spring while the
  conversation slides up to make room, and its buttons fade in as it lands.
- Fixed: since 1.3, swiping back in Settings on a phone showed an empty area instead of the list underneath.
- Tap a picture in a chat and it grows out of its thumbnail into a full-screen viewer. Pinch or double-tap
  to zoom, drag around while zoomed, and swipe it down to put it back, with the background fading as you go.
  Tap once to hide or show the buttons. On a computer, click to zoom and press Esc to close.
- Menus and pop-ups (model picker, usage, the ⋯ menus) grow out of the button you pressed.
- Switching chats fades the conversation in, and each chat remembers where you were reading. Go back to it
  and you're on the same message, not thrown to the bottom (until you close the app).
- Opening the app shows its frame straight away (sidebar, top bar and message box in their real places,
  with soft placeholders) instead of a blank screen, and the real content fades in over it without anything
  moving. Lists that load (shared links, documents and sources) show placeholder rows instead of
  "Loading…".

## 1.3.0 · Feels like an app

- Press and hold a message or a chat on your phone: it sinks slightly, then lifts out of a blurred background
  with its actions right next to it (Copy, Select text, Edit, Regenerate, Pin, Rename, Delete…), with a
  small buzz. To select part of a message, use "Select text" from that menu.
- In "View all chats" on phones, swipe a chat right to pin it, or left to show Delete. A long swipe left
  deletes it straight away, and the notification has an Undo button.
- When you send, your message lifts out of the text box and settles into the conversation. Replies fade in
  word by word as they're written, instead of appearing in chunks.
- Light vibrations (Android, and iPhone where Safari allows it) when you send, hold a message, flip a
  switch, close a sheet by dragging, or a swipe goes through. You can turn them off in Settings → General
  → Vibration.
- Sheets now rise from the bottom of the screen and settle with a spring; menus and pop-ups open with a
  slight bounce. The phone drawer slides with the same spring.
- Fixed: buttons in notifications (like Undo) now work while a window is open.

## 1.2.0 · Gestures that follow your finger

- Sheets (model picker, usage, +) and the phone drawer move exactly with your finger and keep its speed
  when you let go: a quick flick closes or opens even after a short drag, while a slow, short one
  settles back where it was.
- You can catch a sheet or the drawer while it's still moving and carry on dragging from there, without it
  jumping. This also works on a drawer you opened with the menu button.
- Pulling a sheet up, or the drawer further open than it goes, stretches a little and springs back, instead
  of stopping dead.
- In Settings on phones, swipe from the left edge of a section to go back to the list. The list shows
  underneath as you swipe, and a short swipe stays in the section.
- Fixed: on phones, tapping the dimmed area beside the open drawer now closes it again.

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
