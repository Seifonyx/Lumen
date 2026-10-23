# Phase 2 navigation: checks that need a physical iPhone

Automated runs cover Chromium with emulated iPhone viewports (390×844 and 320×568, touch) and Linux WebKit in CI.
They cannot reproduce Safari's own edge-swipe gesture, the installed home-screen app, or VoiceOver. These checks
are **not done** until someone runs them on a real device and records the result below (device, iOS version,
Safari or installed app, date, pass/fail and a note). Use a synthetic or personal test account, never someone
else's data.

## Setup
- Open https://lumen-chat.web.app in Safari (and repeat the Back checks in the installed home-screen app).
- Have at least one project with three chats, a pinned chat and a long chat title.
- Type an unsent draft in the open chat before starting; it must survive every step.

## Back and edge swipe (slice 1, kept in slice 2)
1. Open the drawer → Library. Swipe right from the left edge. Expect: the chat, not the previous website; the draft is still there.
2. Repeat from Tools and from Models & routing (Routing Center).
3. Library → Tools via the drawer, then Safari's Back (or edge swipe): one step returns to the chat.
4. Installed app (no browser Back): the in-page swipe from Library/Tools/Routing Center returns to the chat.

## Drawer (slice 2)
5. iPhone SE or a 320-wide setting / Zoomed display: Library, Tools and Models & routing appear as one row of tiles; at least three conversations are visible without scrolling; every tile and row is easy to hit.
6. On a modern iPhone (390–430 wide): the drawer keeps its list of places; long titles end in "…"; the open chat is in view when the drawer opens, even far down the list.
7. Search in the drawer: the keyboard opens, typing narrows the list, the ✕ clears it and keeps the keyboard; "Search" on the keyboard opens the first result and the drawer closes.
8. Safe areas: nothing sits under the notch/Dynamic Island or the home indicator, in portrait and landscape.

## VoiceOver focus (slice 2)
9. Open the drawer from the chat's ☰ and close it (✕ or two-finger scrub): VoiceOver lands back on "Open chats".
10. Open the drawer from Library's ☰ and close it: VoiceOver lands on Library's "Open sidebar", not the hidden chat.
11. Same from the Routing Center's ☰.
12. Swipe through the drawer: a folder reads its name, chat count and expanded/collapsed; its chats are in a list named after the project; the open chat is announced as current; a pinned chat says "Pinned".
13. Type in search: VoiceOver announces "N conversations found" (or "No conversations match").

## Results
| # | Device / iOS / Safari or app | Date | Result | Note |
|---|---|---|---|---|
| | | | not run | |
