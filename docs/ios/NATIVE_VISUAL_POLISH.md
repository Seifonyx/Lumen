# Native Lumen — visual-polish gate before Phase 3

**Status:** Design/implementation plan only. No visual change or SideStore release is claimed by this document.

## Decision (2026-11-10)

The owner wants the *existing* native iPhone app polished to the same standard as its Phase 0–2 functionality **before** Phase 3 begins. From that point on, every new feature must ship with its own complete visual and interaction polish; visual completion is not deferred to Phase 7.

Lumen must have its **own identity** without abandoning the AI-chat patterns people expect. Preserve the conversation-first design, bottom composer, readable assistant/user exchanges, a familiar model selector, attachments, discoverable chat history, and native iOS navigation and gestures. Do not mimic ChatGPT's exact styling or replace familiar workflows just to look different.

## Visual direction to refine with owner

- Calm, premium, uncluttered, light-inspired character appropriate to the name *Lumen*; recognizable but never neon-heavy or ornamental.
- Define shared design tokens for typography hierarchy, spacing, corner radii, surfaces, borders, accent, elevation, and SF Symbol sizing. Use meaningful contrast in Light and Dark mode.
- Keep conversation content, composer, and important actions immediately legible; use visual emphasis sparingly.
- Native behavior first: native sheets/menus, ergonomic touch targets, gestures, keyboard/safe-area handling, haptics used sparingly, and reduced-motion fallbacks.
- Never trade away data safety, API-key privacy, chat persistence, search, accessibility, or performance for visual effects.
- Treat the owner's existing sidebar screenshot as the first UX reference: preserve all destinations, but improve grouping, header, active conversation affordance, drafts, actions, account footer, and dense history readability.
- Review actual compact/regular iPhone screenshots with the owner before treating the aesthetic direction as final.

## Scope: polish all already-delivered features

1. **App shell and identity:** launch/empty state, navigation controls, sidebar overlay/close behavior, consistent typography, iconography and motion.
2. **Chat surface:** user/assistant message rhythm, long replies, loading/streaming/Stop, error/retry/status, keyboard-safe composer, send/model/attachment buttons.
3. **History and versions:** sidebar conversation list, pinned/archived states, search, rename/delete confirmation, edit/regenerate/version selectors, copy/share actions.
4. **Drafts, temporary chats and restoration:** visibly distinct temporary state and privacy messaging; account-scoped drafts, preserved text/attachments, interrupted-response recovery.
5. **Attachments:** photo/file selection, previews, removal, progress/failure/retry and accessible layout at large text sizes.
6. **Account, providers and settings:** signed-in/out states, Google sign-in, secure key/provider forms, model selection, appearance controls and error feedback; clearly distinguish incomplete future destinations such as Projects/Library.

## Delivery slices

- **A — Visual foundation + sidebar:** reusable tokens/components, custom but restrained identity, navigation/history/drafts/account polish; preserve all accessibility identifiers and actions.
- **B — Conversation + composer:** messages, model picker, Stop/send, empty/stream/error states, keyboard and long-chat ergonomics.
- **C — Remaining Phase 2 surfaces:** history/search/archived lists, editing/versions/actions, drafts/temporary mode, attachments and previews.
- **D — Settings, provider connections and final consistency:** unified forms and feedback, Light/Dark, Dynamic Type, VoiceOver, reduced motion, touch areas and real-device review.

Changes should be reviewable in draft PRs with before/after screenshots. No release/merge solely on an aesthetic assertion: require actual iOS CI and owner review.

## Phase 2 polish exit gate

- Every existing feature above is visually coherent and usable in both Light and Dark on compact and regular iPhones.
- No loss of text, selections, attachments, drafts or active streams when navigating, dismissing sheets or switching accounts.
- Existing accessibility IDs and journeys still pass; no removal of assertions or test methods. Check Dynamic Type, VoiceOver labels/focus, 44pt targets and Reduce Motion; inspect keyboard/safe-area behavior.
- Collect simulator screenshots and verify on a physical SideStore-installed iPhone for real input, haptics and touch behavior.
- Owner approves the visual direction and delivered device build. Only then start Phase 3.

## Permanent definition of done for Phase 3 and later

Every feature proposal must define its **states and interactions** together with its functionality: entry, empty/loading/success/error, recovery, Light/Dark, Dynamic Type, VoiceOver, motion, keyboard/gestures and responsiveness. Submit polished UI and functionality together, with screenshot-based review and automated regression coverage where practicable. An unstyled functional placeholder is *not* a finished feature.

Do not publish to SideStore or deploy the web app from this plan. New feature development remains native-first; web changes are fixes only.

## 2026-11-10 implementation scope, owner-authorized

- Replace the sidebar's top-right X with a search icon; remove search, archive and temporary-chat rows. Gesture/edge-handle + outside tap close remain available, including accessibility escape.
- Place Archived chats under Search → Archived, with a second entry in Settings → Chats & data.
- Move Temporary chat beside New chat in the chat toolbar, retaining its memory-only privacy behavior and leave confirmation.
- Rename the provider hub from Models & providers to Router without changing secure API keys or the separate model picker.
- Complete 2.2–2.6 native UI polish with no lost features or test coverage. Planned version 0.3.5 after full CI and real device review.
