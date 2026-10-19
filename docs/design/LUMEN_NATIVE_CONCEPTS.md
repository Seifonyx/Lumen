# Lumen Native — initial concept studies (round 1)

**Direction selected:** Refined Lumen Native. **Status:** conceptual, awaiting visual approval and real-app screenshot baseline. **These are layout studies, not evidence that the running application has this appearance.**

See [specification](LUMEN_NATIVE_SPEC.md) and [independent design-progress plan](LUMEN_NATIVE_PLAN.md). Standalone illustrative HTML preview: [`lumen-native-concept.html`](lumen-native-concept.html). It must not be wired to production routing or used as behavioral test evidence.

## The three-screen thesis

### Concept A: Desktop new chat — "Quiet arrival"

**Target:** 1440×900, composed of the existing ~272px sidebar and a spacious main canvas.

```text
┌── LUMEN sidebar ─────────┬───────────────────────────────────────────────────────────────┐
│ ◐  Lumen            [≡] │  New chat                                     [contextual] │
│ + New chat               │───────────────────────────────────────────────────────────────│
│ ⌕ Search                 │                                                               │
│ Library                  │                      [Eclipse moon]                           │
│ Tools                    │                                                               │
│                          │                     Good afternoon                           │
│ Projects                +│                 Where should we begin?                        │
│   Product research       │                                                               │
│   Design notes           │                                                               │
│ Recents                  │                                                               │
│   Compare model APIs     │                                                               │
│   Welcome to Lumen       │      ┌────────────────────────────────────────────────┐       │
│                          │      │ Ask anything, build something…                 │       │
│                          │      │                                                │       │
│                          │      │ +  Auto  ▾                 context  Mic  Send │       │
│ [avatar]  Settings       │      └────────────────────────────────────────────────┘       │
└──────────────────────────┴───────────────────────────────────────────────────────────────┘
```

**Composition:** content center is horizontally the primary landmark; greeting slightly above the composer. The centered phone welcome contract stays unchanged—desktop polish must not push it higher/lower on phones. Welcome copy respects the existing five-greeting sequence; placeholder above is illustrative and not new product copy authority.

**Hierarchy:** Eclipse at ~42px visual size (existing component); one confident 30–34px semibold greeting (responsive); a single 14–15px secondary prompt; composer narrow enough for focus but roomy for multi-line text; two clearly distinct navigation anchors in the sidebar. No suggestion-card wall. Lime only on active/routing/send.

**Acceptance questions:** Does this feel uniquely Lumen rather than ChatGPT cloned? Is the sidebar discoverable without boxing everything? Is the composer centered and visually stable at 1440 and 1024? Is reduced-motion mark static?

### Concept B: Desktop active conversation — "Reading desk"

**Target:** 1440×900 and 1024×768.

```text
┌──────────────────────────┬───────────────────────────────────────────────────────────────┐
│ persistent same sidebar  │ API migration notes                     Project • Workspace│
│                          │───────────────────────────────────────────────────────────────│
│ active chat + signal bar │               user prompt — subtle bubble                   │
│                          │                                                               │
│                          │         assistant answer in open reading column            │
│                          │         quiet headings and readable paragraphs              │
│                          │         small code/output panel if applicable              │
│                          │         ● Gemini Flash     Copy · Retry · ⋯               │
│                          │                                                               │
│                          │         ┌────────────────────────────────────┐               │
│                          │         │ Continue the conversation…         │               │
│                          │         │ +  Auto  ▾       Mic       Send   │               │
│                          │         └────────────────────────────────────┘               │
└──────────────────────────┴───────────────────────────────────────────────────────────────┘
```

**Composition:** reading measure max ~760px and deliberate line length; light/ink backgrounds provide clarity, not an always-on white card around every assistant message. Actions are discoverable but visually secondary. Preserve stream completion, model attribution and failure/partial output notices. On narrower desktops, make sidebar temporary before crushing content or Canvas.

**Acceptance questions:** Can one scan message author/model, copy, retry and resume without distraction? Are code blocks and tables legible? Does expanding the project or Canvas pane preserve draft and current scroll?

### Concept C: Phone active conversation — "Pocket workbench"

**Target:** 390×844 (also test 375/320, Safari and Android equivalent); calm solid material is the fallback, supported iOS can have existing restrained glass.

```text
┌─────────────────────────┐
│ ≡    Migration notes  ⋯ │  safe area/topbar
│─────────────────────────│
│                         │
│    Your prompt          │  right-side user bubble
│                         │
│  ◐ Lumen · model        │  quiet assistant author line
│  Clear content and      │
│  breathing room…        │  scroll owns content
│  • readable bullets     │
│                         │
│  Copy  Retry  •••       │
│                         │
│                         │
│ ┌─────────────────────┐ │
│ │ Message Lumen       │ │  bottom composer, keyboard-aware
│ │                     │ │
│ │ +  Auto ▾  Mic   ↗  │ │  compact native-feeling row
│ └─────────────────────┘ │
└─────────────────────────┘
```

**Composition:** compact top title and one contextual control; left-edge safe scrolling content; no global fixed translucent haze. Bottom composer is one continuous reachable touch surface, preserving the existing attachment/voice/menu flows. Tabbed hubs use their existing navigation contracts instead of a new omnipresent app-wide bottom bar.

**Acceptance questions:** Is the composer reachable and readable with keyboard shown? Can users select text and activate model/attachments with 44px hit targets? Is there 0px horizontal overflow at 320px? Does a return from Tools/Study preserve position and draft?

## Cross-surface preview: Projects and Tools

Not yet standalone high-fidelity concepts; apply the same hierarchy:
- Tools: one labeled contextual header, one row of clear categories, content cards in an adaptive grid. Cards show icon, title, one sentence and a compact status—not an oversized colored tile.
- Projects: recognizable workspaces with quiet naming, meaningful metadata and one primary create action. Information-density should adapt from desktop grid to one-column phone list without truncating content.
- Library: resource thumbnails where they add value, file/doc metadata otherwise; predictable filtering and search; avoid image-heavy decoration.
- Settings/Model Picker: one focus owner per modal, trustworthy information hierarchy, accessible status hints, guarded fallback/Auto decisions unchanged.

Do not use these brief notes as final approval of those future surfaces; they require their own concrete renders during LN04/LN05.

## Theme interpretations

| Appearance | Desired feel | Keep |
|---|---|---|
| Light | very light cool-gray workspace, white content surfaces, dark legible ink | delicate boundaries, no warm tinted wash |
| Dark | soft charcoal with defined raised surfaces, not pure black everywhere | readable subtext, reserved highlights |
| True black | OLED canvas black with subtle bordering, few gradients | low-halo actions and stable legibility |
| Glass-eligible iPhone | native-feeling sheets and rim light only on floating layers | robust reduced transparency / slow-frame fallback |

Signal lime is reserved for active/send/Auto/brand flare and shouldn't become a card-fill color.

## Prototype review worksheet

Review the standalone concept using desktop and phone-sized windows; it is **nonfunctional sample data** and has no real chat history, auth, provider requests, persistent settings or navigation. It must not be deployed to Firebase. Record whether each area is **Accept / Revise / Reject**:

| Area | Evaluation |
|---|---|
| Brand character | Clear Lumen identity, no copied product layout/motif |
| Desktop arrival | breathing room, sidebar coherence, greeting and composer balance |
| Conversation | line length, bubble/answer proportion, action discoverability |
| Phone | one-handed ergonomics, top context, composer and safe area |
| Themes | light/dark/black distinction, text and control clarity |
| Motion/material | feels smooth and native, not over-animated or blurred |
| Scope | no existing controls/features were silently hidden in the final intended UI |

## Prototype limitations & decisions before implementation

1. This concept cannot settle the real native zoom contradiction: `src/main.tsx` currently intercepts gestures while `PRODUCT.md` requests native zoom. Perform actual browser/accessibility audit.
2. It uses selected *illustrative* content and simplified small chrome only. The real app also has incognito, project/context ring, voice conversation, privacy, attachments, billing authorization, Canvas, Compare, GitHub and all interaction states. Those controls **must** remain functional in implementation even if this mock does not depict every state.
3. No authentic app screenshots were captured in this initial source-only session. The next step is to collect actual current source-built baselines and map measured differences, not proclaim that current UI is visually defective based on assumptions.
4. No runtime code changed and no new third-party UI dependencies are planned. Concept acceptance comes before a runtime PR.

## Approval gate and next task

Have the user review the desktop/phone concept visuals and give a short direction-specific reaction. If accepted, freeze the principal hierarchy/token treatment as concept v1 and proceed with LN00 rendered baseline. If revised, update this document and prototype first. Then implement one small code milestone (e.g., sidebar + top-bar shell or composer shell) with real app screenshots, typecheck, Chromium and WebKit browser coverage and normal protected PR/deploy review. Keep the existing Model Picker's 98.5% progress unrelated to this new design plan.
