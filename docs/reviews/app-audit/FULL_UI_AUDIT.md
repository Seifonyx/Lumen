# Lumen full UI audit (2026-10-30)

Every Canvas screen and state on production code (main `970b355`): about 180 captures at 390 px and 1440 px, Light
and Dark, plus the signed-out page and spot checks on the normal build. Synthetic data only. Ordered by importance:
first what's broken, then what's inconsistent, then what's confusing, then polish. "Where" names the screen; "Fix" is
the specific change.

## 1. Broken or broken-looking (fix first)

| # | Where | Problem | Fix |
|---|---|---|---|
| 1 | Chat, a reply's ⋯ menu (iPhone) | The menu opens past the right edge: "Read aloud", "Save as Word", "Edit in canvas", "Select text" are cut off | Keep menus inside the viewport (flip left/up); on phones open message actions as a bottom sheet |
| 2 | Composer, tool chip ("Deep research · ask your question below", "Create image · describe it below") | Monospace font, wide letter spacing, wraps onto two cramped lines with room to spare | Body font 13 px, one line, ellipsis; icon + tool name only, the hint goes in the placeholder (it already does) |
| 3 | Every dialog and sheet (New project, layout editor, assistant editor, project settings) | Fields are still white outlined boxes and selects are raw native ("Same as the rest of the app"): Phase 2's field style only reaches screens inside the app root, and dialogs render outside it | Apply the field and select styles to all Canvas surfaces, dialogs included |
| 4 | Answer tables (iPhone) | Third column cut at the edge ("Som…", "One…") with no visible sign that it scrolls | A clear right-edge fade plus a small "Scroll →" hint the first time, or a stacked card layout for tables wider than the screen |
| 5 | Settings → Memory (iPhone) | "Add a memory" field squeezed to ~90 px by the "Every chat" select; placeholder reads "Add a me" | Stack: field full width, scope and Add on the next line |
| 6 | Settings → Personalization | Reply-language select text runs under its chevron ("Match my writin") | Reserve chevron space; let the control grow or truncate with ellipsis |
| 7 | Activity → Overview | "0 this week · −100% vs the week before" | Hide the percentage when this week is 0; say "No requests this week" |
| 8 | Activity → Logs | Opens on "Last 7 days" and shows "No events match" while older history exists | If the range is empty, say "Nothing in the last 7 days · 12 older events" with one tap to show them (or default to the latest week that has events) |
| 9 | Sidebar | Opening a new chat adds "New chat · just now" to history before anything is sent; repeated taps pile them up | List a chat only after its first message (show it as the current draft otherwise) |
| 10 | Library → a document | File name shown three times (bar title, file dropdown, heading); opens in raw Markdown edit mode ("# Launch brief") | One title; open in Preview, with Edit as a toggle; the dropdown only when the chat has several documents |
| 11 | Data analysis (desktop) | Dialog taller than the screen; output area cut off; Run floats alone above the editor | Run in a sticky footer with the output; editor height fits the window |

## 2. Inconsistent (the "not one app" feeling)

| # | Where | Problem | Fix |
|---|---|---|---|
| 12 | Settings vs Library/Tools/Router | Settings is a different kind of page: its own left list, an X at the top right, and on desktop two navigation columns side by side | Make Settings a destination like Router: Back chevron, sections as tabs/rows, the main sidebar is the only left column |
| 13 | Buttons still in a third style | Connectors (Test connection, Open repository, "Not connected" pill), Privacy (Back up, Restore, Import), Memory (Save, Add), Personalization and New project suggestion chips, Prompts "+ New", Knowledge "Import", Data analysis "Add CSV…", sidebar "New chat", Quick tools tiles | Ink pill for the one main action; quiet fill buttons for the rest; chips as fill chips; no outlines |
| 14 | Section labels still in uppercase | Model picker ("LAYOUTS", "GOOGLE AI STUDIO"), attach sheet ("TOOLS"), Data analysis ("OUTPUT") | Sentence case 13/600 like everywhere else |
| 15 | Monospace outside data | Message footer ("Gemini Flash (synthetic) · Picked by Auto…") truncated to "Gemini Flash (syntheti" on iPhone; "Retry with…" cut | Body font 12–13 px, allow two lines on phones |
| 16 | Disclosures | Layouts uses browser ▶ triangles; everything else uses chevrons | One chevron disclosure component |
| 17 | Layout editor | Outlined white fields; "In order / Match request" control floats on a rule line; on desktop the editor fills the full width while the rest of Router is a 760 px column | Shared fields, segmented control in its row, 760 px column |
| 18 | Dark mode highlight | The warm "you are here" highlight is a muddy brown in Dark | Brighter warm tone in Dark (or the neutral strong fill), checked for contrast |
| 19 | Select chevrons | Library/Projects selects show a filled triangle, others a line chevron | One chevron |

## 3. Confusing (copy and flow)

| # | Where | Problem | Fix |
|---|---|---|---|
| 20 | Model picker | Every Layout says "2 available"; capability icons (eye, globe, ⊕) are tiny and unlabelled | Show what the Layout is for instead of a count; label capabilities ("Images · Web · PDFs") |
| 21 | Attach menu (desktop) | 13 items; "Compare models" greyed with no reason; "Video, web page or calculation" is vague | Group (Add · Tools); explain or hide the disabled item; name tools plainly |
| 22 | Composer | An empty circle icon appears while typing with no label (context meter) | Hide until it means something (e.g. above 50 % of the context), with a tooltip/label |
| 23 | New chat | Big empty screen; an unlabelled eye-off icon top right | 3–4 starter suggestions (from saved prompts); label the icon ("Temporary chat") |
| 24 | Command palette | Re-centres and jumps as results shrink; lists both "Files" and "Uploaded files"; key hints are ~10 px | Pin the dialog's top edge; merge the duplicate; 12 px hints |
| 25 | Library copy | "chat items", "device-local collection", "Exports are built when you choose Save; downloads are not tracked", "Originals may depend on the device…"; the "Looking for searchable sources?" card repeats on every tab; "Made by Lumen" empty state offers "New document" | Plain words ("6 files"), one line per tab, the Knowledge card only on Everything, the right empty-state action |
| 26 | Knowledge tab | An 8-line privacy paragraph in small text (blue-tinted on desktop); dashed outline drop zone | One-line summary with "How indexing works" behind a disclosure; tone drop zone |
| 27 | Library document AI panel | Five actions plus two dense footnote paragraphs always visible | "Edit with AI" disclosure; one-line note |
| 28 | Provider page (not connected) | "Add a key" button beside the status duplicates the key field right below; the field has no placeholder | Drop the button when the field is on screen; placeholder in the provider's key format |
| 29 | Quick tools / Read a web page | Long service and privacy paragraph before the field | One line + "Details" |
| 30 | Sign-in | "Enter preview sandbox" is developer wording on the public sign-in page | "Try without an account" (or hide it in production) |

## 4. Polish

| # | Where | Problem | Fix |
|---|---|---|---|
| 31 | Projects index | Sort select alone above the list; count line | Sort beside search; count in the summary |
| 32 | Sidebar | Conversations header icon (new chat? all chats?) isn't self-explanatory | Tooltip and accessible name that says what it does |
| 33 | Sign-in (desktop) | Plain centred card on an empty page | Optional: a quiet product preview or the identity's light motif |

## 5. Not verified yet (needed before calling it complete)

- A physical iPhone: VoiceOver order and labels, Dynamic Type at large sizes, keyboard covering the composer, safe areas,
  the installed (Home Screen) app.
- Right-to-left (Arabic) layout end to end: the app offers Arabic but no screen was audited in RTL.
- States that need a live provider: a reply streaming in, real provider errors, Deep research results, Compare results,
  image generation, the first-run flow from a brand-new account.
- Desktop at 200 % browser zoom, keyboard-only use of every flow, reduced motion.

## Resolved during this audit

- The Data analysis editor looked empty in the review build: the review build's security policy blocked the editor's
  styles. On the normal build the code shows correctly.
- Model picker translucency (earlier C2): every capture here shows it opaque; it was a fade-in capture.
