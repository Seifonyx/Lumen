# Lumen — permanent instructions for coding agents

**This file contains standing rules, never the current phase authorization.** For the currently approved task, progress, agent and next action, read the live GitHub checkpoint. Dated owner decisions and earlier “STOP” boundaries in handoffs or archives are historical unless the latest owner instruction confirms them.

## Start/resume/handoff — automatic, no owner reminder

1. Read the current `Seifonyx/Lumen` docs branch `docs/lumen-live-context` in this order:
   - `docs/lumen-context/README.md`
   - `docs/lumen-context/PROJECT_CONTEXT.md`
   - `docs/lumen-context/CURRENT_STATUS.md`
2. Read the latest applicable owner message and coding-branch `docs/blackout/AI_HANDOFF.md`, `docs/blackout/IMPLEMENTATION_PLAN.md`, and relevant source. Reconcile the latest explicit owner authorization, workstream state, active agent and next action. Prefer current owner decisions and verified repo facts over stale narratives. **Do not reset or reimplement finished WIP on an agent switch.**
3. If the live checkpoint already records the meaningful latest state, **proceed immediately without a write**. If a meaningful milestone, owner decision or handoff is missing, **update `CURRENT_STATUS.md` yourself** using the connected GitHub writer, latest blob SHA, narrowly scoped public-safe content, conflict-aware retries and readback confirmation. Change `PROJECT_CONTEXT.md` only for durable rules. Repeat at substantive milestones and handoffs. If writer is unavailable, state the limitation and provide the correction once, without unnecessary work stoppage.
4. This is a **per-session agent action**, not continuous background sync. Do not burden the owner with copying Markdown, repeated check-in questions or duplicate audits.

## Technical authority and working references

- Root: [PROJECT_CONTINUUM.md](PROJECT_CONTINUUM.md), [PROJECT_CONTINUUM_V2_FULL.md](PROJECT_CONTINUUM_V2_FULL.md), [MASTER_REQUIREMENTS.md](MASTER_REQUIREMENTS.md), [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md), [AI_HANDOFF.md](AI_HANDOFF.md), [PRODUCT.md](PRODUCT.md), [DESIGN.md](DESIGN.md), [UX-CONTRACT.md](UX-CONTRACT.md).
- Blackout: [master](docs/blackout/MASTER_REQUIREMENTS.md), [v1.1 amendment](docs/blackout/BLACKOUT_V1_1_AMENDMENT.md), [Continuum directive](docs/blackout/PROJECT_CONTINUUM_2026-10-20.md), [design correction](docs/blackout/DESIGN_COURSE_CORRECTION_2026-10-20.md), [Routing Center correction](docs/blackout/ROUTING_CENTER_COURSE_CORRECTION_2026-10-20.md), [integration blueprint](docs/blackout/CANVAS_PRODUCTION_INTEGRATION_BLUEPRINT.md), [plan](docs/blackout/IMPLEMENTATION_PLAN.md), [handoff](docs/blackout/AI_HANDOFF.md).
- Read the detailed governing documents **as relevant to the work**, not as a ritual reread of every historical report. Frozen weights and explicit design/technical contracts remain authoritative; the **active scope and Gate status come from the live checkpoint + newer owner decisions**.
- Old staged-authorization details are available in [agent history](docs/blackout/AGENT_INSTRUCTIONS_HISTORY_2026-10-22.md) and workstream records **for provenance only**.

## Delivery habits — capable but lean

- Work within the owner's authorized task. Implement sensible small polish and fixes without extra approval pauses; batch proportionate validations at meaningful milestones rather than retesting the whole world after each cosmetic edit.
- Preserve existing app behavior, provider/model routing, data boundaries, drafts, account isolation, privacy, authentication, accessibility, and production compatibility. Never invent provider usage or claim tests were run when they weren't.
- For the task at hand, run necessary typechecks, unit/browser/security regression checks and isolation builds. Distinguish implementation, agent testing, owner acceptance, merge, deployment and production verification.
- Make reviewable scoped commits, preserve parallel worktrees, update the coding-branch plan/handoff only for meaningful changes, and synchronize the public live checkpoint yourself. Report succinctly with the next step and genuine blockers.
- **Never infer permission for a new Gate, production integration, merge/deployment, new paid service or security-boundary relaxation** from a successful test or praise. Owner-only approvals remain explicit. Preserve the owner’s strict **$0 incremental spending** for private iPhone QA; test on the authorized private, synthetic route rather than exposing real accounts or credentials.
- The repository and live checkpoint are public. Do **not** publish private Project Sources, personal conversations, customer/account data, passwords, tokens, private addresses or confidential findings.

**No current-phase dates, commits, progress percentages, actor names or “CPxx only” text belong in this file.** Maintain those solely in the live CURRENT_STATUS and current coding-branch handoff.
