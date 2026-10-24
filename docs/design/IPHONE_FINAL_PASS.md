# Phase 4 final iPhone navigation pass — 24 October 2026

Current owner brief: preserve original sidebar; shared tactile glass Back/actions, feature-local Library/Routing horizontal sections and bottom Search. Continue draft PR52 from ad78d2f; no merge/deployment or new phase. Existing dirty navigation worktree is preserved; this clean checkout tracks the verified remote.

## Owner scope correction (supersedes the original drawer proposal)

The owner explicitly restored the original Canvas sidebar. SidebarCanvas is identical to ad78d2f: upper Search, established destinations, unified tree and bottom New chat/account. The rejected sidebar proposal was local and never pushed.

Library receives the top content-type tabs and page-contained bottom Search. Routing Center receives top section navigation and existing provider/model searches at the bottom; provider details hide section navigation. Layouts uses the existing policies section ID and preserves every policy/fallback/editor function. Desktop remains on its existing selector and tabs. Shared Back and contextual ellipsis keep the new glass material.

## Owners and plan

1. PhoneSections is the small reusable horizontal presentation; Library uses manual-activation accessible tabs with a linked panel, Routing uses navigation buttons and canonical history. No pointer capture; browser momentum and existing swipe-back exclusion for horizontal scrollers remain owners.
2. HubPage accepts additive phone section/footer slots. Collection uses its existing query, type and project state. Existing Knowledge Library content search remains distinct from file-name filtering.
3. Routing Center adds a phone-only content scroller and footer slot. Portals relocate each existing provider/model search without cloning inputs or creating global routing search. The scroll snapshot owner includes the new content scroller.
4. Verify restored drawer, top/scrolled strips, bottom Search/virtual viewport, nested provider→Settings→Back, model filters, menus, drafts, desktop and account/isolation in Chromium/WebKit. Capture actual Light/Dark evidence and run exact-head CI. Stop for design review; no merge/deploy.

## Review focus

No sidebar visual drift; active tab/keyboard semantics; nested provider hides section shortcuts; footer search never escapes its feature; portal focus and viewport safety; desktop/ordinary feature parity. Hardware iPhone/PWA/VoiceOver remain unverified.

Program percentage not defined. Phases1–3 shipped; this is Phase4 review only.

## Local verification before source checkpoint

`npm test`: typecheck +92 unit files pass. Ordinary and Canvas builds pass. `iphone-glass-navigation.cjs`:8/8 Chromium and8/8 Linux WebKit across320×568,390×844,430×932,1440×960, Light/Dark. Library breakpoint390→1000→390 now preserves query and usable controls (regression failed before the reactive hook). Main navigation journey passed4 sizes before the final breakpoint adjustment; required broader/gated/exact-head checks follow the committed QA build.

Measured startup growth12.0KB JS gz (budget12.25),15.4KB CSS (16), lazy RC8.8KB (9), Canvas CSS source18.5KB (18.5), versus parent source11.9/14.3/8.7/17.3KB respectively. The small breakpoint subscription and scoped material/layout costs are explicit; no speed improvement is claimed. Ordinary build remains supported and isolated; shared component preparation changes its generated hashes, so byte identity with ad78 is not claimed.

Independent review found and prompted the breakpoint regression fix and two stale test selectors; no new auth/network/provider-selection defect found. Static premium audit has25 findings, same identities as ad78, zero new findings. Historical form/textarea findings remain outside this pass. Physical Safari keyboard, PWA, VoiceOver, real edge gestures/Reduce Transparency remain owner/device checks.
