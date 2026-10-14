# Motion and responsiveness audit (Lumen 1.0)

How it was measured: every main interaction run in Chromium with the CPU slowed 4× (a mid-range phone),
on a phone screen (light and dark) and a computer screen. For each one: the slowest tap-to-next-frame time
(Event Timing), long tasks (main thread blocked over 50 ms), layout shift, and a frame-by-frame screencast
that was checked for flashes, jumps and things popping in or out. Tools: `tests/e2e/helpers/motion-audit.cjs`
(measurements and frames), `frames.py` (flash/jump detection), `contact.py` (frame strips),
`profile-tap.cjs` (CPU profile of one tap). At 4× a single frame is 16.7 ms; nearly every interaction was
slower than one frame before the fixes, so the list is ranked by how noticeable the result is.

Ranked, most noticeable first (times at 4× CPU, phone, before → after phase 1):

| # | What you'd notice | Cause | Before | After 1.0.1 |
|---|---|---|---|---|
| 1 | Tapping a long chat in the sidebar: nothing moves for over 2 seconds, then it all changes at once | The whole chat rendered (and every message's Markdown parsed and sanitised) before the screen could update | 2,280 ms to next frame, 2,128 ms long task | 88 ms; drawer slides at once, newest messages first, older ones added in the background |
| 2 | Menus and sheets (model picker, +, usage, chat menu, new chat) hesitate 0.25 to 0.4 s with a long chat open | Opening one made the rest of the app inert, which restyled every element (about 2,600) before the first frame; focus then re-laid out the whole chat | 336 / 256 / 384 / 320 / 376 ms | 120 / 96 / 104 / 104 / 128 ms |
| 3 | Sending a message while scrolled up a little: your message and the reply arrive off-screen | The view followed new text only if you were already at the very bottom | not visible | always brought into view |
| 4 | Opening a chat lands just above the latest message, with the "jump to latest" arrow showing | The jump to the bottom happened once, before code colouring and tables finished growing the page | yes | lands on the latest message |
| 5 | Switching theme: for about 100 ms the page is half light, half dark | Some parts animate their colours, the rest switch instantly | mixed frames | one-frame switch (crossfade in 1.1) |
| 6 | While a reply streams, buttons under earlier messages (Edit, Branch, Regenerate, Retry with) vanish and pop back, nudging the layout | They were removed while busy | layout shift 0.0033 | kept in place, dimmed |
| 7 | Menus, sheets, windows, the command palette and toasts vanish instantly when closed | No exit animations | instant | 1.1 (motion phase) |
| 8 | Chat list jumps when you pin, start or delete a chat; deleted rows vanish | No position animation (FLIP) | instant | 1.1 |
| 9 | Settings opens with a fade but closes instantly; phone settings sections pop instead of sliding | No push/pop transitions | instant | 1.1 |
| 10 | True black theme loads as dark grey, then turns black; the phone status bar ignores the theme you picked | The pre-paint script only knew light and dark; the status bar colour only followed the system | flash | fixed |
| 11 | After a reload the model button shows a raw id ("gemini-flash-latest") until the model list loads | The saved list was used only when offline | 0.5 to 2 s | saved names shown at once |
| 12 | Sheets and the drawer move on fixed timings, can't be caught mid-way, and stop dead at the edges | No velocity-matched springs, interruption or rubber banding; no swipe-back in Settings | — | 1.2 (gestures phase) |

Not issues: no flash of the wrong theme for light and dark; settings tab switches stay under 0.15 s;
typing stays under 0.09 s per key at 4×; cold start has no layout shift.

Right-to-left: the interface itself has no right-to-left mode (it's English-only). Arabic chat titles and
messages flow right to left on their own (`dir="auto"`); they were included in the frame checks.
