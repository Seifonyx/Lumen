# Model Router design: "Switchboard"

Model Router is a switchboard for free AI models: one place to talk, and the app routes each message to
the right model. The design says that: calm ink-and-paper neutrals, and one **signal colour** that lights
up wherever something is live, like the status light on a router.

It is its own app. Don't copy another product's look (no serif "greeting" headings, no terracotta/orange
accent, no warm-brown dark mode, no ghost icon). When in doubt, remove.

## Tokens (src/identity.css is the source of truth)

| Role | Light | Dark | True black |
|---|---|---|---|
| Page `--bg` | `#f6f7f9` | `#0d0f12` | `#000` |
| Panels `--surface` | `#fff` | `#15181c` | `#0b0c0e` |
| Sidebar `--sidebar` | `#eef0f3` | `#0a0c0e` | `#000` |
| Text `--text / -2 / -3` | `#0e1116` / `#4a5260` / `#636b78` | `#eceef1` / `#a9b1bb` / `#8b939d` | `#eef0f2` / `#adb3ba` / `#8d939a` |
| Lines `--border` | `#e1e4e9` | `#22272e` | `#1c1f23` |
| Primary buttons `--accent` | ink `#0e1116` | paper `#eceef1` | paper |
| **Signal** `--signal` | lime `#c2ef3a` with ink text `--signal-ink` | same | same |
| Signal as text/icon `--signal-strong` | `#3f6a00` (readable on white) | `#c2ef3a` | `#c2ef3a` |

Neutrals are cool (slightly blue-grey), never warm. Status colours (green/red/orange/blue) keep their
meanings from styles.css.

### The signal colour is only for "live" things
- the Send button, the Auto option and the active model dot in the message box
- the dot before each reply's model name, and the "routing" pill on the welcome screen
- the bar beside the open chat in the sidebar, switches that are on, keyboard focus
- the output node of the logo

Never use it for large areas, body text on white, or decoration.

## Type
- **Geist** for everything; **Geist Mono** for code, file paths and *model names* (they read like routes:
  `● Gemini Flash · Auto: quick reply`).
- Body 15px (14/17 with the text-size setting). Fields are 16px+ on touch screens (no iPhone zoom).
- Headings are semibold with slight negative tracking. Welcome heading 26–36px, weight 650.
- Section labels in the sidebar are sentence case ("Projects", "Recents", "Today"), not uppercase.

## Shape & depth
- Corners: buttons/fields 8px, cards/menus 12–14px, message box 16px (20px on phones), chips are pills.
- User messages: `16px 16px 4px 16px` (the "tail" corner points at the sender).
- Depth comes from tone and 1px lines; shadows only on floating things (message box, menus, dialogs).

## Layout and what goes where (one place for each thing)
- **Sidebar**: logo + name · **New chat** (primary) · search · **Library** (assistants, prompts, tools,
  knowledge, scheduled tasks; one window with tabs) · **Documents** · Projects (with +) · Recents · account.
- **Top bar**: chat title, project pill, repository toggle, canvas. Incognito (eye-off) only on a new chat
  or while incognito.
- **Welcome**: logo mark, one short greeting, and the routing pill (what will answer).
- **Message box**: `+` menu · model chip · active chips (Web search, Project) · context ring · mic · Send.
  The context ring stays a quiet circle until the chat is half full.
- **`+` menu** (one level): Files and images, Web search (switch), Project, GitHub repository; *Tools*:
  Document canvas, Data analysis, Compare models. Phones add big Camera/Photos buttons. Settings
  (memory, connectors, privacy) live in Settings, not here.
- **Under a reply**: model name, Copy, Regenerate, Retry with…, and `⋯` for Read aloud, Share,
  Save as Word, Edit in canvas, Select text.

## Rules
- Before adding a control, check it doesn't already exist somewhere else. If it does, don't add it.
- Touch targets are 44px on phones; nothing scrolls sideways at 320px (tests/e2e/fit.cjs checks this).
- Keep visible focus (2px `--focus` outline).
- Zoom is off on phones (pinch blocked in src/main.tsx, double-tap via `touch-action`, 16px fields);
  don't add `user-scalable=no` to the viewport tag (accessibility tools flag it).
- Stylesheets load in this order: styles.css, design.css, feature-surfaces.css, workspace.css,
  layout.css (structure), identity.css (look). Put new colours and identity rules in identity.css.
