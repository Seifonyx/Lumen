# Lumen — instructions for coding agents

Read this file and the authoritative project documentation at the start of each coding session or agent switch.

## Scope-aware progress (owner clarification, 2026-10-24)

The current seven-phase Lumen design/UX program is distinct from the historical Blackout and Dynamic Model Picker weighted baselines. **Do not report an old scoped percentage as overall Lumen completion.** Unless an approved, current scope-matching weighted baseline exists, give phase/slice states, verified delivery, owner acceptance and remaining work; label overall completion percentage **not defined for this program**. Preserve historical weighted ledgers and evidence without recomputing them as a new scope. The [live checkpoint](docs/lumen-context/CURRENT_STATUS.md) is on the separate `docs/lumen-live-context` branch, not necessarily present on this code branch.

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
