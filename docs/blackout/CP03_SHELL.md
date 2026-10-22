# CP03 — Canvas navigation, header and reading (flagged, off in production)

**22 October 2026.** The owner accepted CP02 at its checkpoint and authorized **CP03 only**, under the [integration blueprint](CANVAS_PRODUCTION_INTEGRATION_BLUEPRINT.md) and the lean, risk-based workflow.

**Not authorized:** CP04, merge, deployment, production activation and Gate 2 approval. The budget stays $0. Progress is unchanged at **21.5%**.

Code is in commit `df2a6d7`; tests are in `fdab79e`, `de0af60` and `cebb3b8`.

## What changed

| File | Role |
|---|---|
| `src/components/SidebarCanvas.tsx` | The navigation (details below) |
| `src/components/Sidebar.tsx` | One early return to `SidebarCanvas` when the shell is on. Exports `ChatRow` and the lazy `AskChats` for reuse |
| `src/App.tsx` | Adds the scope attributes `data-lumen-canvas-shell` and the CP01 token scope on `.app` when the shell is on |
| `src/components/ChatView.tsx` | Phone-only new-chat button in the header, when the shell is on |
| `src/styles/canvas-shell.css` | Scoped styles (details below) |
| `src/lib/canvas-presentation.ts` | Adds `CANVAS_SHELL = false` |
| `qa/iphone/adapters/canvas-presentation.ts` | The review build turns the shell on and loads the styles |
| `qa/iphone/fixtures/profile.ts` | Seeds the approved proof's two synthetic projects |

**What `SidebarCanvas.tsx` shows.** One tree:
- destinations: New chat, Library, Tools, Models & routing;
- **Projects** as folders, each with a brief (opens the project workspace), its chats, "Show more" and "New chat in …";
- loose **Conversations** grouped by day;
- All chats;
- the account footer.

On phones it adds a search toggle and a New chat pill.

**What `SidebarCanvas.tsx` reuses.** It is the same `aside.sidebar` with the same `sidebarOpen` and collapse state, focus scope and drawer gesture. It also reuses:
- Sidebar's `ChatRow`: rename, pin, move, archive, side by side, share/export, delete, long press;
- Sidebar's search semantics: titles and message text, with archived chats included while searching;
- `AllChats`, `AskChats` and `ProjectManager`.

Folder disclosure is presentation only. It is kept in memory and resets per account, with no new storage and no project data change.

**What `canvas-shell.css` styles:**
- the tree;
- the breadcrumb: desktop "Project › Chat"; on phones, the title with the project beneath;
- reading measure and type;
- on desktop, a header and composer that float over the conversation with fades.

The proof's DOM-observing bridge, root flags and duplicate row handlers were **not** carried over.

**Production stays unchanged.** Every seam folds away. Icons are limited to ones production already bundles, and the existing lazy `AskChats` is reused, so no module side effect leaks into the ordinary build. The ordinary build is **byte-identical to the baseline (174 files)**.

## Verification (lean)

- **New CP03 browser contract** (Chromium and Linux WebKit; 1440×960, 390×844, 320×568): **pass**, 10 checks per size:
  - breadcrumb;
  - reading measure, and the last answer clearing the floating composer;
  - folders, disclosure and inert closed folders;
  - rename through the row menu;
  - search across folders, with Ask;
  - All chats;
  - project overview, and a new chat in a project;
  - phone drawer and desktop collapse;
  - second-reviewer isolation;
  - axe, zero external requests, no CSP violations, no overflow, no page errors.
- **CP02 composer contract:** **pass** in both engines at 4 sizes, with the shell on. Its reload step now opens the chat's project folder first.
- **Existing QA browser contract:** **pass** in both engines.
- **QA01 isolation audit:** **8/8**. The allowlist now covers exactly the CP02 and CP03 source files, with both flags off.
- **CP01 graph check:** **pass**. Byte equality holds, and the CP03 sentinels are absent from production.
- **`npm test`:** **pass**.

Evidence: [desktop](cp03/desktop-1440.png), [phone 390 and 320](cp03/phone.png), and results in [cp03](cp03).

## For the owner

- **Try it on the iPhone:** open the Codespace. It updates and starts the review by itself. Tap **Reset** in the yellow banner to load the new synthetic projects; a review account seeded earlier keeps its old data until then.
- **Physical checks worth a minute:**
  - drawer swipe open/close with the new tree;
  - folder open/close animation;
  - long-press menu on a row;
  - header title with the project beneath;
  - scrolling with the floating header on an iPad or wide window, if available.
- **Decisions made, easy to change:**
  - Folders open automatically for the project you're in. Other folders start closed.
  - The project initials are monochrome, as in the proof; the production colour dots are not shown.
