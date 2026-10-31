# Native iOS direction: design checkpoint (not merged)

Owner feedback (2026-10-30): the warm "premium" proposal looked bad and not native; Lumen should keep its own identity
while feeling like a native iOS chat app; no suggestion pills. Branch `design/native-ios`. `now/` is production,
`proposed/` this branch (iPhone 390 pt, Light and Dark). These captures use Windows' system font; on an iPhone the
same build uses San Francisco, so judge it on the preview link.

Proposed: iOS system colours (white/black, system greys at AA-safe values), the system font, a translucent chat bar,
17 pt reading text, a flat capsule composer with a round send button, plain bubbles for your messages, a plain sidebar
list without per-chat icons. Identity: Lumen's Crease mark (replacing the old lime moon) and wordmark, the ink accent,
Lamplight text selection.

## Round 2: iPhone Liquid Glass (2026-10-30)

Owner feedback: the flat checkpoint lacked the iOS 26 glass and did not feel like a premium iOS AI app. `glass/` shows
the branch now (iPhone UA, glass on; Windows font in the captures, San Francisco on a device).

- Bar: no strip; a 44 pt glass circle (chats) and a 44 pt glass capsule (usage ring, New chat) 16 pt from the edges,
  over a scroll edge that fades and blurs the conversation under the title.
- Dark glass matched to an owner-supplied iOS 26 capture: about 19 levels above the page, a light rim along the top
  and bottom edges, no dark shadow (tint `rgb(60 60 62 / .64)`: #262626 over black, #323232 over #1f1f1f).
- Composer: one glass capsule; + and the model as plain glyphs, the action as a solid ink circle.
- Usage ring moved from the composer to the bar capsule (iPhone glass only); it opens the same Usage sheet.
- System font on iPhone glass only; Geist everywhere else. Dark secondary grey #98989f (AA on selected rows).
- Fixed: model-picker layout rows overflowed the sheet; the closed drawer's shadow showed along the left edge.
- Light glass is tuned by eye (no light reference capture yet).

## Round 3: measured against native captures (2026-10-31)

Owner feedback with two iPhone screenshots (Lumen and a native iOS 26 AI app): a dark shadow at the top that blurs the
buttons; remove the chat name; at rest the message box should hold +, the mic and talk, with the model once it opens.
`round3/` shows the result.

- The dark band came from the scroll-edge layer's blur behind the bar controls; it is now a plain fade into the page.
- Glass on black measured at #1c1c1c with a bright 1 px top rim and a short sheen; Lumen now matches (tint
  `rgb(44 44 46 / .62)` plus a 7% white sheen).
- No chat title in the bar on iPhone (incognito keeps its label).
- Message box: 20 pt from the edges (10 pt under 380 pt), 52 pt tall at rest: + · message · dictate · talk; the model
  appears while writing.
- Thinking row and file cards without outlines; the model name under replies in the system font, not monospace.

## Round 4: the other pages, tables, Settings Back (2026-10-31)

Owner follow-up to round 3 ("do all but the first one"; the three-button bar capsule stays). `round4/` shows the result.

- Library, Tools, Router and Settings: Settings-like pages (Settings, Tools, Router) sit on the iOS grouped background
  (#f2f2f7 in Light, black in Dark), so their white / #1c1c1e groups read as groups (they were white on white in Light).
  Page bars have no hairline or blur band; Back, + and other bar buttons, and the Library search, use the chat's glass.
  Section tabs fade over 40 pt where more wait off-screen. Empty states are a large grey symbol, title and one line;
  an empty Library shows no count or sort.
- Tables on phones fit the screen: text wraps and long words hyphenate; only a table too wide even then scrolls.
- Back from a Settings section: the list was re-running its entrance stagger from blank (about 150 ms of black); after
  a section has been visited it now shows at once.
- Light glass: unchanged tokens; on the grouped pages it now has a grey page to sit on. Still no light native capture.
