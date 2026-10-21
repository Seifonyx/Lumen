# Lumen — live, PUBLIC-SAFE project charter

> **Canonical ref:** `Seifonyx/Lumen` branch `docs/lumen-live-context`. This public-safe charter is a **working summary**, not a publication of the owner's full private ChatGPT Project Sources. Follow [README.md](README.md) for update rules.

## Product and visual direction

Lumen is an independent, premium AI workspace for conversation, reading, sustained writing, projects, model selection/routing, providers, usage context and tools. It should have a **recognizable original identity**, clear information hierarchy and excellent desktop and iPhone usability.

**Canvas (A)** is the selected **design foundation**, not an automatic Gate 1 approval. It uses a unified Projects/conversations tree, a compact single-row resting composer, progressive writing controls, a reversible expanded writing sheet, comfortable response reading and existing iPhone glass materials. Preserve the chosen structure unless the owner directs otherwise.

Other applications, including 9Router and ChatGPT, may inspire general UI/interaction principles, but **Lumen is not a clone**: original branding, implementation, hierarchy and code are required. Inspiration is not permission to copy proprietary assets or exact screens. Do not assert comparative security without an evidence-based audit.

## Engineering requirements

- Reuse canonical store/Composer/ModelPicker/UsageMeter/routing/providers/permissions, preserving Send/Stop, attachments, drafts, selection, accessibility and existing account boundaries.
- Never misrepresent estimates, live provider usage, availability, tests, invoices, readiness or privacy/security behavior.
- Support usable mobile keyboards/safe areas, native-feeling gestures, reduced motion/transparency and actual device verification before release.
- Separate mock/proof evidence, code implementation, test pass, owner acceptance, merge, deployment and production verification.

## Approval boundaries and roles

- **Owner:** solely decides product direction, Gate approvals, production integration authorization, merging and deployment.
- **ChatGPT:** planner, product reviewer, evidence verifier, agent brief author and cross-thread checkpoint maintainer.
- **Claude Code:** primary coding agent. **Codex:** handoff/secondary implementation agent when Claude approaches usage limits. Track the **currently active agent in CURRENT_STATUS.md**; no agent switch occurs merely because one is planned.
- **Gate 1 is not automatic.** Canvas preference, successful screenshots, CI passes, a clean PR or an agent report never equals explicit Gate approval.
- Blackout work is currently isolated in draft preview PR #34. Do not integrate it into production until the owner separately authorizes staged work. No merge/deploy without appropriate explicit permission.

## Context governance

The dated operational checkpoint belongs in [CURRENT_STATUS.md](CURRENT_STATUS.md), NOT this charter. At a meaningful milestone, update that live file proactively and identify what was verified, owner-decided, only agent-reported or unknown. Update this charter only for **durable** decisions. Consult the actual coding branch's `AGENTS.md`, workstream handoff and plan for detailed technical specifications, tests, release rules and official milestone weights.

**Security:** This repository is public. Never paste full private Project Sources, sensitive user conversations, credential details, access tokens, private addresses or confidential security data into these files. Private Project Sources may contain additional details and must not be publicly copied.
