# Gate1 product-experience reconsideration — two directions

> **Update:** the owner selected A · Canvas; its single polish pass is recorded in [CANVAS_POLISH.md](CANVAS_POLISH.md). Gate1 still NOT APPROVED.

21 October 2026. Owner verdict on the consolidated Workspace + Focus proposal: promising, not there. Reading and writing were less comfortable, the composer was messy, navigation fragmented, and the iPhone lost Lumen's glass. **Gate1 NOT APPROVED. The consolidated visual architecture is not accepted.** This is design exploration: no production migration, merge or deployment, and no direction is selected.

- **Base:** PR #34 branch `docs/lumen-blackout-phase1-20261019` at `89caae4`.
- **Review:** [review.html](review.html) (offline; production · rejected consolidation · A · B, per state, iPhone and desktop). Machine evidence: [evidence.json](evidence.json).

## How the proofs are built

Open `docs/blackout/workspace-proofs/?proposal=canvas` or `?proposal=desk` on the localhost preview, with a fresh synthetic profile.
- **What's real:** each runs the real App with the real `Composer` (textarea, draft, attachments, + sheet, ModelPicker, UsageMeter, mic, Send/Stop), store actions (`selectChat`, `selectProject`, `newChat`), pages (Library, Tools, Settings), and production iPhone glass (`html.glass`, same materials and safeguards).
- **What each proposal adds:** only navigation, a few top-bar slots and the expand control (`proposals/ProposalChrome.tsx`), plus scoped stylesheets (`shared.css`, `canvas.css`, `desk.css`).
- **What's kept from production:** the production top bar's trailing actions (canvas, repository, incognito). Expanded writing reuses the verified selection-preserving hook.
- **What's hidden:** only the production sidebar. Its features are re-homed or listed under limits below.

## A · Canvas — the conversation is the canvas

- **Navigation:** one tree. **Projects are folders of conversations** in the same list as unfiled chats. Each project opens to its chats plus *New chat here* and *Overview*. A breadcrumb (*Studio launch › A launch worth remembering*) shows where you are, and tapping the project opens its overview. Library, Tools, Models & routing and Settings sit together at the foot.
  - **Desktop:** the tree is a 272px panel.
  - **iPhone:** a drawer behind a glass button, with a compose button opposite.
- **Composer:** a single capsule.
  - **At rest:** one row: `+` · *Message Lumen* · `Auto ▾` · Send/voice.
  - **While writing** (focus, text or an attachment): the text takes its own row, and the tools you need appear under it (model, context estimate, expand, dictation, Send).
  - **Expand:** the same textarea rises into a writing sheet. A grabber, title, word/token count and Done sit over the dimmed conversation. Done, the expand control or Escape returns you, with draft, cursor and selection intact.
  - **The sheet surface:** it is solid; glass is used only at its rim, so writing never depends on blur.
  - **Desktop:** the same capsule floats over the reading column on real translucency.
- **Model and context:** the model is always visible as `Auto ▾` and opens the real picker (popover on desktop, sheet on iPhone). The context chip shows its real estimate (`~231 tokens`), and its panel gauge reads **<1%**, not 0%.

## B · Desk — Lumen as a writing desk

- **Navigation:** **spaces**: *All* or a project.
  - **Desktop:** a spaces rail (monogram tiles, with Library/Tools/Models/Settings at its foot) beside the chosen space's conversation list (Mail/Notes structure). A project space opens with its brief (description, instructions, files → Overview), then its conversations with previews and dates.
  - **iPhone:** native push navigation. The conversation has a round glass back button to its space, and the space screen has a large title, space chips (All, each project, Library, Tools…), the brief, search and the list.
- **Composer:** docked like an editor's panel, not floating. A quiet **route line** (`+` · `Auto ▾` · `~231 tokens` · expand) sits over a writing field, with Send beside it.
  - **iPhone:** a full-width docked glass panel.
  - **Expand: page mode.** The document view gives way to a page. The answer you're replying to stays one tap away as a *Replying to* excerpt, and on desktop the list steps aside.
- **Model and context:** permanently visible in the route line, using the same real picker and usage panel.

## Key interaction differences

| | Production today | Rejected consolidation | A · Canvas | B · Desk |
|---|---|---|---|---|
| Where projects live | Separate list in drawer + separate Projects page | Separate nav items | Folders inside the one conversation tree | Spaces; each conversation belongs to one |
| iPhone navigation | Drawer (two lists) + tab bar on pages | One toolbar of icons | Drawer tree + breadcrumb | Push: conversation ⇄ space |
| Composer at rest | Two rows always | Three rows always | **One row** | Route line + field (two light rows) |
| Model visibility | Pill in lower row | Lower row | Pill in the capsule | Route line text |
| Expanded writing | None | Side-by-side destination ("Focus") | Sheet over the conversation | Page replacing the document |
| Reading width (desktop) | Centred column | Column + intelligence rail | Column, nothing beside it | Column after rail + list |

## Trade-offs and weaknesses

**Canvas**
- **Strengths:** the calmest composer, and the closest to the production iPhone glass you liked. It's the most direct fix for the fragmentation, since everything is one tree. Reading has the most room.
- **Reading while writing:** the expanded sheet hides most of the answer you're replying to. You collapse it to re-read, whereas the rejected split view kept the answer visible.
- **Long trees:** many projects will need collapse memory or pinning.
- **Desktop glass** depends on `backdrop-filter` and would need performance checks on low-end desktops.

**Desk**
- **Strengths:** the strongest structure for ongoing work. Projects feel like real places with their brief, and conversations are scannable with previews. Model and context are always explicit, and page mode is the most focused writing surface.
- **Desktop width:** rail and list take about 396px, leaving a narrower reading column on smaller laptops.
- **iPhone composer height:** route line plus field is taller at rest than Canvas's one row.
- **Switching chats on iPhone** takes a push back to the space.
- **Truncation:** rail labels truncate (*Lisbon in spri…*).
- **Page mode** shows only an excerpt of the answer.

**Both**
- **Not yet re-homed from the production sidebar:** "View all chats" (bulk archive/move/export), the chat-row menus (rename/pin/delete/branch), the account avatar and swipe-row actions. Their search filters titles only, as local view state with no new store.
- **Not built:** gestures beyond production's own (swipe-down to dismiss the sheet, sheet detents, edge-swipe back for Desk), motion beyond reduced-motion behaviour, light theme and Routing Center integration.
- **Visual hierarchy:** the proposals change the composition, not the type and colour system. Both are monochrome Blackout with Archivo titles.

## Verification (actual renders, synthetic account, one intercepted send)

[capture.cjs](capture.cjs) drives production, Canvas and Desk through the same seven states (conversation, navigation, composer at rest, writing, expanded, model picker, context). It passes for all of these, with 0 axe violations, 0 page errors and 0 overflow:
- Chromium: desktop 1440×900 and iPhone 393×852 (iPhone UA, so production glass is on); Canvas also at iPhone 320×693 and 430×932, and Desk at 320×693.
- WebKit 26.0 (official `mcr.microsoft.com/playwright:v1.56.1-noble` image): iPhone 393×852.

For both proposals it also asserts:
- expanding keeps the **same textarea node, draft, selection (12–38) and focus**, and Escape returns with draft and selection intact;
- the real model picker and Usage dialogs open;
- exactly one intercepted Send, then the real Stop.

The existing consolidated harness still passes at 1440 and 390 (it's unchanged), as do the proof `tsc` and the production build.
- **Layout fixes from this review:** comparing the frames side by side caught Canvas's writing row wrapping Send onto a third line at 393px in Chromium (which offers dictation) and at 320px, and Desk's title touching the back button at 320px. Both are fixed and checked at 320, 393 and 430.
- **What it doesn't show:** this WebKit build draws little or no backdrop blur, so glass appears clearer than on a device. It checks layout only. A real-iPhone check is still blocked by the preview's localhost-only guard (see [FINAL_VERIFICATION.md](../FINAL_VERIFICATION.md)).
- **Raw output** is outside Git in `/home/user/.lumen-verification/gate1-reconsideration/`.

## Recommendation (not a selection)

Take **A · Canvas as the base**. It answers your strongest notes most directly: a calm, comfortable composer; premium iPhone glass built on what already works; and one coherent place for projects and conversations. Borrow two things from B: the **project brief at the top of a project's folder**, and an **always-legible route/context line while writing on desktop**.

The open question is reading while writing. If keeping the answer visible during long drafts matters more than calm, B's page mode, or a resizable Canvas sheet, is the better choice. Please choose a direction, or a mix, before any implementation. **Stop for owner review.**
