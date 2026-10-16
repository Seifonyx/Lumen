# Changelog

## 2.4.17 · Assistants live in Tools

On iPhone:
- A + only appears where it adds something. In Tools, that's the Assistants tab ("New assistant"); the other
  tabs' cards already start their tools. Collection keeps its +.
- Fixed: making an assistant from Tools opened the old Assistants page, and going back landed there. The
  editor now opens inside Tools, and Back, Save or Delete return you to the Assistants tab.
- The old Assistants page is gone on iPhone. Tools → Assistants lists them all, each with a pencil to edit it
  (or to make your own copy of one of Lumen's), and your own can be deleted from the editor. Anything that
  used to open the Assistants page now opens Tools → Assistants.

## 2.4.16 · Collection without a Search tab

On iPhone:
- Collection's tab bar has five tabs: the Search tab is gone, since the search box at the top covers it.
  Files you uploaded for Lumen to search now sit in the Files tab, under your attached files. Its + uploads
  one, and the search box finds them by name.
- The search box on Tools and Collection is now one rounded iOS-style field. It no longer looks like a box
  inside a box, or shows a double outline when you tap it.
- The tab bar steps out of the way while you type, instead of riding up on the keyboard.

## 2.4.15 · Tidier Tools and Collection

On iPhone, Tools and Collection are simpler:
- The page name sits in the middle of the top bar; the big heading and grey description are gone.
- A search box at the top searches only the tab you're in.
- The + at the top left makes something new for that tab: a document, a photo or file in a new chat, an
  image, a deep research, a data analysis, a study deck or an assistant. The "New…" buttons and notes inside
  the tabs are gone.
- A tab with nothing in it says "Nothing here yet" with a button to add the first thing.

On all phones:
- Fixed: opening the sidebar from a page like Projects or Tools opened it behind the page, so the menu
  button seemed to do nothing.

## 2.4.14 · Tools and Collection tab bars

On iPhone:
- **Tools:** the bottom tab bar now holds the tool categories (Research, Create, Analyze, Learn and
  Assistants), each in its own colour. The page shows one category at a time instead of one long list.
  Searching still looks through all of them.
- **Collection:** its filters (All, Photos, Docs, Files, Made by Lumen and Search) moved from the chips at the
  top to the same glass tab bar.
- On these two pages, leave with Done or the menu button at the top.

Everywhere:
- Connected apps are no longer listed in Tools; they're in Settings → Connectors (GitHub is still in the +
  menu).

## 2.4.13 · The + menu as a card

- On phones, the + menu is now a card like the model picker: no taller than about three-quarters of the
  screen, with its list scrolling inside. The ✕ at the top is gone: drag the card down or tap outside it
  to close.

## 2.4.12 · Sheets follow your swipe

- Fixed: swiping down on a sheet (the model picker and others) sometimes moved the chat behind it instead
  of the sheet. A swipe that starts on the search box at the top of a sheet now moves the sheet as well
  (tapping the box still lets you type), and the app itself no longer rubber-bands when a swipe isn't
  for a list or a sheet.

## 2.4.11 · Sheets close cleanly

- Fixed: on iPhone, a strip of a closing sheet (the model picker, the + menu and other cards) could flicker
  at the bottom of the screen for a moment. The sheets float slightly above the bottom edge, and they now
  slide all the way off screen when they close, whether you tap away or drag them down.

## 2.4.10 · Model button and green dot

- On iPhone, the model button in the message box is now as tall as the round buttons beside it, with its
  name centred.
- The softly glowing green dot is back: beside the model in the message box, and beside "Auto" at the top of
  a new chat.
- The top of a new chat shows "Auto · N models" in full, instead of cutting off the end.

## 2.4.9 · Smoother sidebar, clearer errors

- Swiping the sidebar open on iPhone is smoother. The floating New chat button inside it no longer
  re-blurs on every frame while the sidebar moves; it keeps its glass look, since the sidebar behind it is
  solid. The sidebar is also ready to move before your finger does.
- When a provider doesn't answer while Lumen refreshes the model list, Settings → Models now says which
  provider it was and what happened (for example "Hugging Face didn't respond in time"), instead of the
  browser's own "Fetch is aborted". It also tells you that the models found last time are still listed.

## 2.4.8 · A responsive app while replies stream

- Fixed: the whole app could freeze while a long reply streamed (the sidebar took seconds to open, taps
  didn't respond). While a reply comes in:
  - finished paragraphs are now drawn once and reused, so each update only redraws the paragraph still
    being written, instead of rebuilding the whole reply;
  - the chat checks its scroll position at most once per frame, instead of measuring the whole
    conversation on every scroll step;
  - the fade-in of new words does far less work on long replies.
- The steady flow from 2.4.7 now only applies to replies that really arrive in bursts, and it slows down if
  the phone gets busy, so it never makes the app sluggish.
- Fixed: replies could come back in another language (for example Arabic) when you wrote in English. With
  Reply language left on automatic, models are now told to answer in the language of your latest message,
  even when memories, project names, files or earlier messages are in another language.
- Correction to 2.4.7: the grey circle seen in screen recordings was the iPhone's AssistiveTouch button,
  not part of Lumen.

## 2.4.7 · Replies flow smoothly

- Fixed: replies could freeze for a few seconds and then jump ahead in big blocks. Some providers and
  networks send text in bursts (it happened with the Cloudflare models). Lumen now paces the text: it sees
  how often new text arrives and lets it flow in steadily, a word at a time, so a burst reads as one smooth
  stream. Nothing is lost or delayed at the end; the whole reply is shown when it finishes.
- Fixed: a grey circle could float over the chat on iPhone. It was the knob of the hidden switch Lumen uses
  to make the phone vibrate, which iOS 26 draws as glass outside its hiding place. It's now kept well off
  screen.

## 2.4.6 · Smooth replies on iPhone

- Fixed: on iPhone, replies could arrive in jerky chunks instead of flowing in smoothly. Safari was redrawing
  the glass blur behind every bar and button each time new text arrived. While a reply streams, the glass now
  blurs a little lighter and the fades under the top bar become plain gradients. Everything returns to full
  glass as soon as the reply finishes.
- The check that switches the glass off on phones that stutter now runs every time the app opens (before, it
  stopped after one smooth session), and it ignores the moments while a reply is streaming.

## 2.4.5 · Green where it matters

- Lumen's green is now kept for the important things: the send and voice buttons, the logo, the welcome moon
  and progress meters. The + in New chat and New project, the dots beside model names, tab underlines and
  other small marks use the normal text colours.
- The selected chat in the sidebar has no green bar. It's a clearly filled row with its name in bold.
- On iPhone, the extra space under your account picture and New chat at the bottom of the sidebar is gone.

## 2.4.4 · Glass tone

- On iPhone, the glass is darker in dark mode and lighter in light mode, so it blends with the screen behind
  it.

## 2.4.3 · Solid sidebar

- On iPhone, the sidebar is a solid full-height panel again, as in other iOS apps, instead of a floating glass
  card. Glass is kept for the floating controls: New chat, the round buttons, the message box, the tab bar,
  sheets and menus.

## 2.4.2 · Glass like other iOS 26 apps

- On iPhone, the glass now matches apps like Claude: a lighter, see-through grey with a soft sheen from the
  top, a thin edge of light all round, and a soft shadow.
- The chat now shows through the message box, blurred, instead of fading out underneath it.
- The controls inside the message box are faint translucent fills, and the send button no longer glows.

## 2.4.1 · Softer glass

- The glass on iPhone is softer, closer to other iOS 26 apps. The dark halo around buttons is gone, the edge
  is a faint line of light along the top, and the fill is a flatter grey. This applies everywhere: buttons,
  the message box, the tab bar, sheets, menus and the sidebar.

## 2.4.0 · Feels like an iPhone app

On iPhones and iPads:
- **Buttons you can feel:** hold a glass button and it swells under your finger, with a soft light where you
  touch. It leans after your finger if you drag, then springs back with a little bounce when you let go.
  List rows highlight and cards sink slightly, as in iOS.
- **Swipe back from anywhere:** on Projects, Collection, Tools and Settings, swipe right anywhere on the screen
  to go back. The page follows your finger and the chat slides back in underneath. Let go early and it
  springs back.
- **Pages slide in:** Projects, Collection, Tools, Assistants and Study slide in from the right and slide away
  when you close them. Switching tabs doesn't slide, as on iOS.
- **Long-press menus like iOS 26:** the screen behind blurs, the message lifts a little higher, and the glass
  menu grows out of it. Each action's name comes first with its icon at the far end, and thin lines separate
  them.
- **Heavier, larger icons**, closer to the iPhone's own.
- **Polish:**
  - Your own messages keep Copy, Select text, Edit and Branch in the long-press menu instead of a row of
    icons, as in Messages.
  - Buttons are capsules, and Sign out no longer has square corners.
  - Your email no longer wraps onto a second line in Settings.
  - In dark mode, the selected Theme and Text size option is lighter than its bar.
  - Every Settings row has its dividing line.
  - Sidebar rows are taller and highlight as one rounded piece when pressed.
  - The model name under a reply uses the normal font.

## 2.3.1 · Sidebar touch-ups on iPhone

- Your account picture and the New chat button now sit on the same line at the bottom of the sidebar, and
  the empty space under them is gone.
- "Your chats will appear here" is now in the middle of the sidebar.

## 2.3.0 · The iPhone look

On iPhones and iPads, Lumen now looks and feels like an iOS 26 app, with see-through "glass" controls
floating over your chats. Computers and Android phones look the same as before.

- **Chat:** messages scroll all the way under a floating top bar and message box. Text fades and blurs at the
  edges so the buttons stay readable. The chat's name sits in the middle of the top bar, with its project
  underneath.
- **Glass you can feel:** buttons swell a little under your finger and spring back. Menus spring out of the
  button that opened them.
- **Tab bar:** Projects, Collection and Tools have a floating tab bar to move between them and back to your
  chats. A glass lens slides to the tab you pick.
- **Large titles:** pages and Settings start with a big title that tucks into the top bar as you scroll.
- **Sheets and sidebar:** the + menu, model picker and other windows float just above the bottom with deep
  rounded corners. The sidebar is a floating glass panel.
- **Settings:** keeps Lumen's own look, with the new iOS 26 switches and rounder choice buttons.
- **Uses the iPhone's own font** (SF Pro).
- **Only where it runs smoothly:** iOS 16 or later. If a phone starts to stutter with the glass, Lumen switches
  that phone back to the solid look by itself.

## 2.2.0 · Projects, Collection and Tools

Lumen is reorganised so every place has one job. The sidebar now has **Collection** and **Tools**, with
**Projects** under them.

**Projects**
- New Projects page (tap "Projects ›" in the sidebar). Each project shows as a card in its own colour, with
  its description, how many chats, files and memories it has, and when you last used it. You can search and sort.
- A project's page has a soft band in its colour, a link back to all projects, and a new Memory card that lists
  the facts kept just for that project.
- The sidebar keeps your four most recent projects for quick switching.

**Collection**
- One place for everything you've added or made in any chat: photos, attached files, canvas documents, images
  Lumen made, and files you uploaded for Lumen to search ("Searchable", which used to be Knowledge).
- You can filter by type or project, search, and move an item's chat into a project. Projects are the folders.

**Tools**
- A catalog of everything Lumen can do, grouped as Research, Create, Analyze, Learn, Assistants and Connected
  apps. Each card says what the tool does and whether it's ready (for example "Needs a Cloudflare key").
- Study and your assistants now live here. GitHub is under Connected apps, with more connections to come.
- The + menu in the message box keeps the everyday tools, adds "Saved prompts" and "Video, web page or
  calculation", and has "All tools". On a computer it opens downward when there's more room below.

**Also moved**
- Scheduled tasks are now in Settings → Scheduled tasks.
- The new pages (Projects, Collection, Tools, Assistants, Study) open in place of the chat, and "Back to chat"
  (on phones, "Done") returns you.

## 2.1.1 · Fits on phones

- Study, Ask your chats and Build a layout now have proper margins on phones. Before, they ran to the edges of
  the screen and barely fit. Flashcards, quiz answers and the deep research card are also sized for small
  screens.
- The buttons in Build a layout and Writing tools wrap neatly on narrow phones instead of crowding.
- The excerpts in Ask your chats show plain text instead of raw link markup.
- Every newer screen was checked at iPhone widths (390 and 320 pixels) for anything spilling off the screen.

## 2.1.0 · Ask your chats, Study, writing tools, Combine, Archive, smarter layouts

**Ask your chats**
- Type in Search chats, then tap "Ask your chats". Lumen finds what you talked about even if you use
  different words, and answers from it. Each number in the answer opens the chat it came from.
- It uses your Gemini key. The search index is kept on your device, and only chats that changed are read again.

**Study**
- New: Study in the sidebar, or "Study this chat" from a chat's menu. Lumen makes flashcards and a quiz from a
  chat or a document.
- Flashcards flip when you tap them. "Knew it" moves a card further away; "Not yet" brings it back in the same
  round and again soon.
- The quiz marks your answer, explains the right one, keeps your best score, and lets you retry the ones you
  missed. Decks are saved to your account.

**Writing tools**
- Select words in a reply and tap "Writing tools": Improve, Shorter, Simpler, More formal, Friendlier, As bullet
  points, or Translate. You see the result first, then choose "Use in reply" or Copy.
- The same tools are in Select text, which is handy on phones.

**Compare: Combine into one answer**
- After comparing models, "Combine into one answer" has the strongest of them write one answer from all the
  others' answers, with a short list of where they disagreed. You can continue the chat from it like any answer.

**Archive**
- Archive a chat from its ⋯ menu to hide it from the sidebar without deleting it. Search still finds it, and All
  chats has an Archived view to bring chats back, one or several at a time.
- All chats now searches inside messages too, like the sidebar does.

**Smarter layouts**
- Recommended layouts now score every model you have for the task: overall strength, coding, reasoning, speed,
  images, PDFs, web search, long inputs and languages. They also prefer the newest version of each model, move
  down models that fail or are at their limit on your device, and take backups from other providers so one
  provider's limit doesn't stop the whole layout.
- New: Settings → Models → Layouts → Build for a task. Pick a task (or describe it, like "debugging React
  apps"). Lumen checks your providers for new models first, then shows the best ones with the reason for
  each, and marks new models.
- New recommended layouts: Writing, and Languages & translation (this replaces the Arabic-only layout).

**Settings**
- New: Settings → Personalization → Reply language (match my writing, or always a language you choose) and
  Answer length (Auto, Short, Detailed).
- The instruction shortcuts are now general ("Explain simply" and "Show sources" replace "Egyptian Arabic"), and
  the document quick edits are Shorten, Improve writing, Fix grammar and Simplify.
- Developer options are only shown to the people who build Lumen.

**Fixed: memory picking up things you didn't ask it to keep**
- Models were nudged to save your "preferred language" from how you wrote, so one chat in Arabic could make
  later chats answer in Arabic. They now only save what you clearly state, and never infer a preference from
  the language you write in.
- Deleting a chat now also forgets the memories a model saved in it (Undo brings them back).

## 2.0.0 · Deep research, imports, side by side, notifications, smarter memory

**Deep research**
- New: Deep research. Ask a question and Lumen plans several web searches, runs them, reads what they find,
  and writes one report with numbered sources. Each [1], [2] in the report links to its source, and the full
  list of sources is at the end.
- To use it, tap + → Deep research, or type /research followed by your question.
- While it works, you can see each search, the sites it read and how far along it is. When the report is done,
  this folds into one line you can tap to see the searches again.
- The searches use Gemini with Google Search, so you need a Gemini key. A report takes about 6 to 8 requests
  from your free Gemini allowance.

**Bring your history**
- New: Settings → Privacy & data → Import from ChatGPT, Claude or Gemini. Choose the export file from the
  other app (the .zip, or the .json inside it). For Gemini, use Google Takeout's "My Activity" file.
- Lumen shows how many chats it found. You can import all of them, or only the latest 100.
- Imported chats are tagged with where they came from. Importing the same file again updates those chats
  instead of making copies.

**Side by side** (iPad in landscape and computers)
- New: open another chat next to the one you're in. Use the chat's ⋯ menu (or press and hold it) → Open side
  by side. Switch swaps the two chats.
- Drag the divider to change how much room each side gets, or use the arrow keys. Double-click the divider to
  reset it. Lumen remembers the width.
- Documents now open beside the chat from iPad-landscape width up. Before, they covered the chat until the
  screen was quite wide. Their divider works the same way.

**Notifications**
- When a reply finishes in a chat you're not looking at, a note says so, with Open to go there.
- When a reply finishes while you're in another app or tab, Lumen's icon shows a badge.
- New setting: Settings → General → "Notify me when a reply is ready". Deep research always notifies you
  when its report is done.
- Lumen still needs to be open in the background for this. Notifications when it's fully closed need a
  small server, which comes later.

**Look**
- Numbered sources in replies ([1], [2]…) are small round badges that link to the source.
- Quotes and tips sit in a soft panel, and tables have a shaded header row (rows highlight under the
  pointer on computers).

**Smarter memory**
- New: About me (Settings → Memory). Write what you want every model to know about you, in your own words.
  "Update from memories" writes a draft from what Lumen has remembered, for you to edit and save.
- Memories can belong to a project. In a project's chats, models can keep facts that only matter to that
  project, and those facts aren't shown to other chats. You can move a memory between a project and every
  chat (Edit → "Every chat" / "Only in …"), or choose this when you add one.

## 1.7.1 · Smoother scrolling

- Scrolling on phones is now handled entirely by the phone. Lumen's gestures (side menu, swipe back in
  Settings, swiping chats) only watch your finger, so they can no longer make a scroll stick or lag.
- Fixed: on phones, the jump-to-message strip on the right edge of long chats caught swipes. Swiping there
  didn't scroll, and lifting your finger jumped the chat to an earlier message. The strip is now only on
  computers, and messages on phones use the full width.
- With the keyboard open, Lumen only checks touches while it's actually open (it used to check all the time).
- Press-and-hold waits a little longer before a message sinks, so starting a scroll doesn't make it dip.
- Fixed: a dark flicker after closing things. Dragging a sheet away (model picker, +, usage, windows) left the
  dimmed background behind for a moment; it now clears as the sheet goes. Closing animations start from how
  things actually look, and fading layers no longer use the blur that can flash black on iPhone.
- New setting: Settings → General → Message navigator, the lines on the right of long chats that jump between
  your messages. It's on by default on computers and off on phones.

## 1.7.0 · More motion

- Theme, Text size and the other choices in Settings: the selection slides to the option you pick, with a
  little spring.
- Switches spring across, and the knob stretches while you press it, like on iPhone.
- The send button morphs between voice, send and stop instead of swapping.
- Usage: the gauges fill up and the numbers count up when you open it; the tiles rise in.
- The bar marking the open chat in the sidebar glides to the chat you pick.
- Attached files pop in, and pop out when you remove them.
- Notifications show a thin bar for how long they'll stay.
- The top bar gets a soft edge once the conversation scrolls under it.
- An empty chat list shows a small crescent moon.

## 1.6.1

- Fixed: on iPhone, dragging down in a new chat with the keyboard open pulled the whole screen down and
  showed a dark band at the top.
- Fixed: dragging the conversation down to hide the keyboard no longer stops the scroll; you can drag down
  and back up in one go, and the keyboard hides when you lift your finger.

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
