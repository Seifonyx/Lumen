# Lumen — live, PUBLIC-SAFE project charter

> **Canonical ref:** `Seifonyx/Lumen` branch `docs/lumen-live-context`. This public-safe charter is a **working summary**, not a publication of the owner's full private ChatGPT Project Sources. Follow [README.md](README.md) for update rules.

## Product and visual direction

Lumen is an independent, premium AI workspace for conversation, reading, sustained writing, projects, model selection/routing, providers, usage context and tools. It should have a **recognizable original identity**, clear information hierarchy and excellent desktop and iPhone usability.

**Canvas (A)** is the owner-selected design foundation, and **Gate 1 was explicitly approved by the owner on 2026-10-21 following the final sidebar-spacing review, with further polish acknowledged as remaining work**. It uses a unified Projects/conversations tree, a compact single-row resting composer, progressive writing controls, a reversible expanded writing sheet, comfortable response reading and existing iPhone glass materials. **Preserve the approved Canvas direction** unless the owner directs otherwise; approval does not imply perfection, physical-device readiness or release acceptance.

Other applications, including 9Router and ChatGPT, may inspire general UI/interaction principles, but **Lumen is not a clone**: original branding, implementation, hierarchy and code are required. Inspiration is not permission to copy proprietary assets or exact screens. Do not assert comparative security without an evidence-based audit.

## Engineering requirements

- Reuse canonical store/Composer/ModelPicker/UsageMeter/routing/providers/permissions, preserving Send/Stop, attachments, drafts, selection, accessibility and existing account boundaries.
- Never misrepresent estimates, live provider usage, availability, tests, invoices, readiness or privacy/security behavior.
- Support usable mobile keyboards/safe areas, native-feeling gestures, reduced motion/transparency and actual device verification before release.
- Separate mock/proof evidence, code implementation, test pass, owner acceptance, merge, deployment and production verification.
- **Reusable iPhone Safari verification (owner direction, 2026-10-21):** plan a repeatable private, device-accessible synthetic preview workflow for present and future mobile updates, usable without Mac/USB developer access. Favor a stable *testing procedure* and optional controlled entry point with commit-pinned, access-controlled, short-lived test builds rather than permanent public exposure. Maintain strict separation from production accounts, credentials, data and provider inference, and retain real-device keyboard/touch/glass/VoiceOver evidence as required. Hosting/access mechanisms, services/costs, network exposure and any preview-origin/auth/security changes require a separate explicit owner approval; a preference for this testing capability is **not** authorization to create or deploy it.

- **Zero-spend constraint (owner direction, 2026-10-21):** Lumen's reusable iPhone QA and its setup/operation must incur **US$0 incremental charges**, not a free-tier target that permits optional paid fallback. Do not authorize paid plans or upgrades, service purchases, billed usage, domains, additional paid seats, or paid dependencies. A nominally free service requiring enrollment/checkout/payment-method activation or exposing uncapped charges must not be enabled without a separately explicit owner decision, and should not be presumed acceptable. If the current Access/Worker/R2 design cannot safely meet strict zero-cost terms, research free alternatives or pause the hosted step; never weaken authentication, private asset isolation or production boundaries just to meet the budget. No infrastructure activation is authorized by this cost rule.

## Approval boundaries and roles

- **Owner:** solely decides product direction, Gate approvals, production integration authorization, merging and deployment.
- **ChatGPT:** planner, product reviewer, evidence verifier, agent brief author and cross-thread checkpoint maintainer.
- **Claude Code:** primary coding agent. **Codex:** handoff/secondary implementation agent when Claude approaches usage limits. Track the **currently active agent in CURRENT_STATUS.md**; no agent switch occurs merely because one is planned.
- **Gate 1 approval is explicit and recorded:** the owner approved Canvas's overall design direction on 2026-10-21 despite acknowledging remaining polish. This closes the Gate 1 design-selection decision **only**. Green tests or agent reports must never be mistaken for approval of other gates or authorization to integrate, merge or deploy.
- **After Gate 1:** commission a staged production-integration **blueprint for owner review first**, mapping component ownership, feature/security parity, rollout/rollback, test gates and early physical-iPhone checks. Writing and reviewing that plan is permitted; executing it in production requires separate owner authorization. Gate 2 and Gate 3 remain pending.
- Blackout work remains isolated in draft preview PR #34 pending further authorization. No merge/deploy without appropriate explicit permission.

## Context governance

The dated operational checkpoint belongs in [CURRENT_STATUS.md](CURRENT_STATUS.md), NOT this charter. At a meaningful milestone, update that live file proactively and identify what was verified, owner-decided, only agent-reported or unknown. Update this charter only for **durable** decisions. Consult the actual coding branch's `AGENTS.md`, workstream handoff and plan for detailed technical specifications, tests, release rules and official milestone weights.

**Security:** This repository is public. Never paste full private Project Sources, sensitive user conversations, credential details, access tokens, private addresses or confidential security data into these files. Private Project Sources may contain additional details and must not be publicly copied.
