# PROJECT CONTINUUM — permanent continuation protocol

Version2.0, approved by the user on2026-10-19. This is a permanent amendment to the execution protocol. It supplements the complete original MASTER_REQUIREMENTS.md and the Progressive Verified Deployment Policy; neither is replaced or weakened. It remains active across Codex, Claude Code and future agents unless the user changes it. Actual project: Lumen's complete Dynamic Model Picker overhaul, not a new/restarted initiative.

## Recover before continuing

Read MASTER_REQUIREMENTS.md completely, IMPLEMENTATION_PLAN.md, AI_HANDOFF.md, this protocol, applicable AGENTS.md/CLAUDE.md, architecture/decision records, product/design guidance, tests, CI/deployment configuration and Git/remote state. Reconcile documentation with actual source, tests, history and deployment evidence. Use equivalent existing documents instead of duplicating them. Correct stale claims; reconstruct missing context without inventing history. Preserve user choices, product constraints, authorization and completed work.

Identify approved scope, architecture, dependencies, verified/partial/unverified work, known defects, exact current/local/pushed/main/production commits and the next unfinished task. Source/test/deployment evidence outranks unsupported handoff claims. Continue without asking the user to resend preserved requirements.

## Stable, evidence-based progress

IMPLEMENTATION_PLAN.md owns stable task IDs, scope, dependencies, weights totaling100, acceptance criteria, verification, partial-credit rules, earned weighted work and percentage. AI_HANDOFF.md records previous/current estimates, change, confidence, supporting evidence, phase, remaining weighted work and explanations of material changes.

Reuse the established baseline and calculation across agents: overall percentage =100 × sum(weight × earned fraction) / sum(weights). Assign weights by complexity/effort/integration/testing/security/operational risk, including regression, documentation and production verification; do not count shared work twice or weight by checklist length. No full credit for an unintegrated module, merely implemented code, unit tests alone, a merge without deployment or deferred required work. Credit only evidenced sub-deliverables. Exclude not-applicable scope only with explicit justified applicability decisions. Version the baseline only for approved scope change or a calculation defect; distinguish progress from scope expansion and explain every material recalculation. Never inflate or arbitrarily lower progress when agents change. Give a qualified range if evidence is incomplete.

## Autonomous implementation and requirements coverage

Continue the existing approved roadmap, adapting execution order only where dependencies/evidence justify it. For each task understand acceptance, inspect source, diagnose root cause, implement a maintainable solution, add meaningful tests, validate, repair regressions, review the complete diff, update documents, synchronize a coherent verified checkpoint and continue. Complete features end to end rather than disconnected modules. Do not repeat completed audits without new evidence, speculate beyond scope, duplicate features or add unnecessary dependencies, inference calls, complexity or cost.

Map every approved requirement to implementation and evidence. Use Not started, In progress, Implemented but unverified, Verified, Blocked, Deferred with justification, or Not applicable with documented reasoning. Never silently remove/weaken/reinterpret requirements. Investigate alternatives to impossible/unsupported/conflicting requirements, document exact constraints and affected acceptance, use equivalent safe solutions where feasible, continue independent work and escalate only essential decisions.

## Persistent documentation and recoverable checkpoints

Preserve MASTER_REQUIREMENTS.md in full. Record new approved instructions as explicit amendments with context/history. Update plan/handoff after each meaningful milestone with status/weights/evidence, dependencies, risks, scope/deployment changes, architecture decisions, relevant files, actual commands/results, exact commits and precise next action. Future agents must not need chat history.

Keep checkpoints reasonably sized and recoverable. Preserve verified progress, record incomplete/uncommitted/unverified work and pending tests. Do not assume uncommitted work survives another environment. Avoid large risky refactors near limits. If interrupted, recover from Git/tree/remote/docs safely. If tools prevent synchronization, state the specific blocker rather than claiming success.

## Uncertainty, concurrency and conflict recovery

Before escalation re-read requirements/roadmap/handoff, inspect Git/tree/source/tests/architecture/incomplete integrations, run safe diagnostics and reconstruct the lowest-risk defensible next task. Work on independent approved tasks when blocked. Only after reasonable investigation is exhausted and no safe meaningful work remains, ask one focused question identifying the missing decision, investigation, blocker and preserved progress. Never fake certainty or make unsafe speculative changes to avoid admitting uncertainty.

Inspect recent remote changes before major operations. Prefer separate branches or isolated worktrees for concurrent work, coordinate shared files, preserve unfamiliar edits and reconcile upstream. Resolve conflicts according to behavior/requirements, not blind preference. Never force-push, automatically discard/reset unfamiliar work or overwrite another contributor. Verify exact intended release commits before merging and document unresolved concurrent work.

## Verification and independent review

Use supported repository scripts/tools and checks appropriate to the change: type/unit/integration/browser/build/security/accessibility/performance/compatibility/deployment smoke tests. Confirm tests actually ran and preserve exit/results. Investigate flakes; do not skip failures, weaken assertions, hide failures with retries, fabricate benchmarks or claim unrun checks. Distinguish provider mocks and CPU measurements from real-provider behavior/answer quality and physical-device testing. Respect authorized workload/budgets/privacy.

Before major checkpoints/final release review missing requirements, security, architecture, integration, races/state, performance, errors, compatibility, complexity and regression coverage. Use independent/specialized review when useful and independently validate conclusions; an agent's approval is not product verification.

## Progressive release and safeguards

Follow actual repository authorization. Existing explicit Lumen authorization permits autonomous normal merges/deployment of independently verified safe milestones. This generic protocol alone does not grant deployment permission to other projects.

For each coherent milestone inspect exact diff, independent readiness/dependencies, backward compatibility/migrations, tests/build/full required CI, security/operations and rollback. Merge through authorized normal workflow; verify main's merge, successful deployment and important actual live workflows. Record exact production commit/evidence, then continue unfinished phases. Do not postpone safe milestones for unrelated work, or ship unfinished work to increase progress. Isolate verified subsets when practical and never accidentally include WIP.

Track local implementation, local commit, remote push, main merge, deployment success and production verification separately. If deployment fails investigate and apply authorized safe rollback/recovery; record it. Never bypass branch protections, disable checks, force-push or overwrite unrelated changes.

Never reveal/commit/log secrets, expose cross-account data, bypass auth/security checks, send credentials/private data to unauthorized services, add arbitrary unsafe remote execution, perform unapproved destructive data changes or incur unexpected paid usage. Review touched input/endpoint/dependency/permission/privacy risks. Preserve user data/settings and use least-privilege reversible procedures.

## Completion and mandatory session handoff

100% means the approved defined scope is implemented, integrated and verified, with significant defects fixed, all required checks passing, security/compatibility/performance addressed, authorized deployment and actual live verification complete, final documents synchronized, limitations honest, and no known feasible high-value in-scope defect unnecessarily left unfinished. It never means software cannot improve. Mandatory blocked/unverified work prevents100%; avoid endless speculative new scope.

Before session/usage/agent boundaries inspect Git, safely finish/checkpoint, update plan/handoff/master amendments, recalculate using the existing weights, record evidence, run applicable checks, commit/push coherent verified work, verify remote SHA and record local/pushed/main/deployed revisions separately. Document all WIP, blockers, pending tests and exact next task/files. After hard cutoff the next agent must inspect/recover; never invent synchronization/deployment success.

At beginning and end report concisely: PROJECT; OVERALL COMPLETION (approximate %, confidence); CHANGE THIS SESSION (previous→current or justified baseline change); CURRENT PHASE; COMPLETED; VERIFIED (actual checks); REMAINING; GIT STATUS (branch/exact source/push/merge); PRODUCTION STATUS (exact verified commit/blocker); NEXT ACTION. At start change may be none yet. Use a range instead of unsupported precision. Continue autonomous implementation after the report, not just planning/recommendations.
