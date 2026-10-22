# Historical AGENTS instructions — through 2026-10-22

> **ARCHIVE, NOT ACTIVE AUTHORITY.** The original AGENTS.md accumulated past scoped approvals and statements such as “CP01 only” and “CP04 unauthorized” which were correct when recorded but misleading later. The active [root AGENTS.md](../../AGENTS.md) now points to the live GitHub checkpoint for current scope. Preserve the following original text solely for audit/history; do not take its dated “latest”/“stop” lines as current.

---

# Lumen — instructions for coding agents

Read this file and the authoritative project documentation at the start of each coding session or agent switch.

## Mandatory automatic live-checkpoint reconciliation

**Owner direction, 2026-10-22 — applies to Claude Code, Codex and any coding agent without a reminder from the owner.** Before starting a new Lumen task, session, or agent handoff:

1. Fetch `docs/lumen-context/README.md`, `PROJECT_CONTEXT.md`, and `CURRENT_STATUS.md` from `Seifonyx/Lumen`, ref `docs/lumen-live-context`. Consult this branch's `docs/blackout/AI_HANDOFF.md` and plan for relevant recent progress and the latest explicit owner instruction.
2. Compare the checkpoint's **latest milestone, owner authorization, active agent and next step** with the handoff/recent relevant evidence. If another agent (including ChatGPT) already recorded everything meaningful, **do not write anything**.
3. If a decision, result, handoff or milestone is missing/stale, **synchronize it yourself** to `docs/lumen-live-context/docs/lumen-context/CURRENT_STATUS.md` before substantive new work; change `PROJECT_CONTEXT.md` only when a durable rule changed. Read the latest blob SHA, make a narrow public-safe update, handle races by refetching and reconciling, and read back to confirm. Do not merge the docs branch into the coding branch.
4. At meaningful completion repeat the check/update; report the link briefly. If you lack write access, state the gap once with a proposed correction; never make the owner manually reupload or prompt every agent.

This is a **lightweight, agent-invoked startup check**, not a background sync. Avoid duplicate entries, extensive verification, or repeated approvals. Distinguish agent-reported outcomes from independently verified code; preserve all owner approval gates, privacy boundaries, zero-spend constraints and production isolation. Latest explicit owner directions always outrank historical "unauthorized" notes in this file.

## Permanent operating protocol

- [PROJECT_CONTINUUM.md](PROJECT_CONTINUUM.md) — current autonomous development, verification, deployment, and cross-agent continuation rules.
- [PROJECT_CONTINUUM_V2_FULL.md](PROJECT_CONTINUUM_V2_FULL.md) — complete user-provided version 2.0 master protocol. Read when implementation or handoff decisions require additional detail.
- [MASTER_REQUIREMENTS.md](MASTER_REQUIREMENTS.md) — authoritative scope of the Dynamic Model Picker workstream; do not remove or weaken its requirements.
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) — stable task weights, dependencies, evidence, and progress.
- [AI_HANDOFF.md](AI_HANDOFF.md) — latest verified operational checkpoint, outstanding work, and exact next task.
- [PRODUCT.md](PRODUCT.md), [DESIGN.md](DESIGN.md), and [UX-CONTRACT.md](UX-CONTRACT.md) — existing product behavior, interface constraints, and feature preservation.

## Execution and safety

Recover actual repository/PR status and deployed SHA before changing code. Reconcile stale documentation against source, tests, commits, and deployment evidence.

Continue approved work in verified phases. Respect privacy, account isolation, data integrity, authentication, accessibility, original feature access, branch protections, and explicit user approval requirements. Do not silently introduce new initiatives or resurrect cancelled work.

Run relevant type checks, tests, browser validation, builds, and security review. Distinguish implemented, tested, merged, deployed, and production-verified work. Merge/release independently verified and authorized milestones when appropriate; do not treat green CI alone as user acceptance or bypass existing approval gates.

After every meaningful milestone, update the existing implementation plan and handoff with progress using the established task weights, verification evidence, exact branch/commit/deployment status, blockers and recovery instructions. Keep the next agent able to continue without previous chat context.

## Authorized new workstream — Lumen Blackout (identity-first)

For Blackout research, identity work, implementation or continuation, read the complete [Blackout master](docs/blackout/MASTER_REQUIREMENTS.md), [v1.1 execution amendment](docs/blackout/BLACKOUT_V1_1_AMENDMENT.md), [latest Continuum directive](docs/blackout/PROJECT_CONTINUUM_2026-10-20.md), [plan](docs/blackout/IMPLEMENTATION_PLAN.md) and [handoff](docs/blackout/AI_HANDOFF.md). The full master was recovered on 20 October 2026; previous missing-source claims are superseded. Reuse Blackout scoring baseline v1, separately from Model Picker. Continue from the recorded evidence and review board; obtain explicit identity approval before extensive UI implementation, core visual approval before major production integration, and final aesthetic approval before completion. Keep experiments isolated until the applicable gates are met. Preserve the approved runtime design and phone composer meanwhile.

Latest Blackout [design correction](docs/blackout/DESIGN_COURSE_CORRECTION_2026-10-20.md) and [Routing Center correction](docs/blackout/ROUTING_CENTER_COURSE_CORRECTION_2026-10-20.md) govern identity review. 9Router remains the mandatory primary product/organization reference. Each new direction must connect an AI Workspace and a substantial Routing Center, with a three-tier composer and actual desktop/phone workflow proof. Aperture/Relay/Fold are rejected intermediate studies. **Latest owner authorization (21 October 2026): Gate 1 APPROVED; Canvas (A) selected; blueprint accepted; CP01 foundation ONLY authorized.** See the [blueprint](docs/blackout/CANVAS_PRODUCTION_INTEGRATION_BLUEPRINT.md) and [CP01 implementation/evidence](docs/blackout/CP01_FOUNDATION.md). CP01 permits isolated contract tests, backward-compatible type-only component preparation and scoped tokens with ordinary production output unchanged. CP02+ and production visual migration remain unauthorized; Gates 2/3 pending. No preview exposure/security relaxation, merge or deployment. Stop after verified CP01 and synchronized handoff for owner/ChatGPT review; do not start CP02 automatically. Earlier unapproved/rejected-concept records are historical. Preserve Canvas and the provider proof; do not revive the rejected Workspace/Focus architecture. Current evidence: [workspace proofs](docs/blackout/workspace-proofs/README.md).

**Subsequent scoped owner assignment (21 October 2026):** [reusable private iPhone QA proposal](docs/blackout/PRIVATE_IPHONE_QA_PROPOSAL.md), **planning/documentation only**. This supersedes the CP01 stop solely to research/document device delivery and synchronize the workstream/live checkpoint. It does not authorize QA infrastructure, service enrollment/spending, host/auth/Firebase changes, preview publication, CP02, merge/deploy or Gate2. Stop after the proposal for owner review; all proposed QA01+ tasks need separate authorization. Preserve the localhost-only proof and ordinary production output.

**Subsequent scoped owner assignment (21 October 2026): QA01 ONLY**, implemented and verified — see [QA01 record](docs/blackout/QA01_FOUNDATION.md). Local synthetic QA build, gate/registry contracts and isolation tests only; production output byte-identical. QA02 (service/access/spend), QA03 (publication/tooling), CP02, Gate 2, merge and deployment remain unauthorized; stop for owner/ChatGPT review. **Later (21 October 2026): QA01 accepted; QA02-A preflight (planning only) delivered** — see [QA02A_PREFLIGHT.md](docs/blackout/QA02A_PREFLIGHT.md). Every QA02 step beyond owner read-only checks needs the specific approval it lists. **Owner budget is permanently $0** — see [QA02_ZERO_COST_ARCHITECTURE.md](docs/blackout/QA02_ZERO_COST_ARCHITECTURE.md); never add payment methods, upgrades or paid services.

**Subsequent scoped owner assignment (22 October 2026): QA-only banner/Codespaces start fixes and CP02 ONLY**, implemented and verified — see the [CP02 record](docs/blackout/CP02_COMPOSER.md).
- The Canvas composer is behind `src/lib/canvas-presentation.ts`. Keep it `false` in the ordinary build; only `vite.qa.config.ts` replaces it. Production output must stay byte-identical, as asserted by the QA01 isolation audit and the CP01 graph check.
- Physical-iPhone confirmation is pending.
- Do not create Codespaces as an agent.
- CP03, merge, deployment, default production migration, Gate 2 approval and paid services remain unauthorized.

**Subsequent scoped owner assignment (22 October 2026): CP02 accepted; CP03 ONLY**, implemented and verified — see the [CP03 record](docs/blackout/CP03_SHELL.md).
- `CANVAS_SHELL` joins `CANVAS_COMPOSER` in `src/lib/canvas-presentation.ts`; both stay `false` in the ordinary build.
- The owner prefers a lean, risk-based workflow: necessary tests and practical visual checks.
- CP04, merge, deployment, production activation, Gate 2 approval and paid services remain unauthorized.

**Subsequent scoped owner assignment (22 October 2026): CP03 sidebar polish + CP04 ONLY**, implemented and verified — see the [CP04 record](docs/blackout/CP04_ROUTING_CENTER.md).
- The Routing Center loader exists only in `qa/iphone/adapters/canvas-presentation.ts`; production exports `RoutingCenter = null`.
- CP05, merge, deployment, production activation, spending and Gate 2 approval remain unauthorized.
