# Lumen live context — continuity entrypoint

**Repository:** `Seifonyx/Lumen` (PUBLIC). **Canonical context branch:** `docs/lumen-live-context`.

This is a **docs-only branch**, deliberately independent from `main` and the draft Blackout feature branch. Do not merge this branch into production merely to keep it current. A new thread must explicitly read this branch; ChatGPT Project Source uploads **are not automatically synchronized**.

## Read order for ChatGPT, Claude Code and Codex

1. Read this `README.md`, then `PROJECT_CONTEXT.md` and `CURRENT_STATUS.md` **from branch `docs/lumen-live-context`**, not the default `main` branch.
2. Treat the live files as a dated checkpoint, not proof of current code state. Read the latest direct owner direction and new agent reports. Verify actual PR/branch/commit evidence when needed for a material decision; do not expand every routine report into a full re-audit.
3. Check existing `AGENTS.md`, `PROJECT_CONTINUUM.md`, and the relevant workstream `AI_HANDOFF.md` / implementation plan on the **actual coding branch**. Preserve existing technical authority and weights.
4. Owner-only authority: design sign-off, Gate 1 and other gates, production integration, merging and deployment require separate explicit owner permission.

## Automatic checkpoint reconciliation on agent entry

**Standing owner rule (2026-10-22), for ChatGPT, Claude Code, Codex and successor agents:** At the beginning of each Lumen work session or agent handoff, fetch the live README, PROJECT_CONTEXT and CURRENT_STATUS from this branch. Compare the checkpoint's latest milestone, latest owner decision/authorization, active agent and next task with the latest relevant agent handoff and available workstream evidence. This is a **targeted freshness check**, not an exhaustive code/CI audit.

If current, continue immediately **without writing or asking the owner**. If a meaningful result or owner decision is missing, the agent with GitHub write access must update CURRENT_STATUS itself before starting the next substantial task; update PROJECT_CONTEXT only for durable changes. Use the latest blob SHA, write only public-safe facts to this docs branch, reconcile any concurrent changes, and read back to confirm. Do not duplicate entries already written by ChatGPT or another agent, and do not claim verification beyond the evidence available. Repeat at the end of meaningful milestones or handoffs.

If the agent lacks write access or encounters a conflict it cannot resolve, report that once with the proposed safe correction; continue otherwise-authorized work when safe. **No user reminder, upload, or approval is required for routine synchronization.** This is an agent-invoked startup protocol, not a background timer or an automatic GitHub sync service. It preserves approval gates and the lean, risk-based review preference.

## Efficient continuity and risk-based review (owner direction, 2026-10-22)

Keep the required start-of-thread checkpoint read and milestone status synchronization **lightweight**. For ordinary progress, use the current agent's report and checkpoint as the working account, labelled as reported where appropriate. **Do not automatically run an exhaustive independent code/PR/CI/screenshot audit for every report.** Verify the few material facts needed for the next decision, or investigate deeper when evidence conflicts, a regression matters, the owner asks, or security/privacy, auth/account boundaries, spending, external exposure, release/merge/deployment or a mandatory acceptance gate is at stake. Make responses concise and action-oriented. Technical agents still perform the tests required for their work; this is a reduction in duplicated oversight, **not** a waiver of meaningful safety checks or explicit owner authority.

## Update contract — do not wait for the owner to request documentation

After a **meaningful** completion report, verified code milestone, owner design choice/approval, agent switch, material blocker or significant change to next task:
- **Update `CURRENT_STATUS.md`** on this docs branch with source, date, verified exact SHA, active agent, owner decisions, work/report/test provenance, current risks and one correct next action.
- Update `PROJECT_CONTEXT.md` only when durable vision, identity, governance, scope, security or handoff rules change.
- Never call status "approved" merely because a proof passes or an agent reports success.
- Never overwrite a newer revision without re-reading and reconciling it. Use read-before-write, exact blob SHA / commit CAS where supported, sequential writes and no force pushes.
- If tool access is missing, say the live checkpoint was **not synchronized**, and provide a ready-to-apply update instead. No invisible background or automatic GitHub action exists in this setup.
- The ChatGPT owner should not have to manually replace uploaded Markdown after each milestone; the shared GitHub files are maintained using connected agent/editor tools.

## How a ChatGPT thread updates these files

Use the connected GitHub tools to fetch `docs/lumen-context/CURRENT_STATUS.md` on `ref="docs/lumen-live-context"`, review it and fetch the current PR evidence, then use a scoped **GitHub update-file action** passing the existing blob SHA and `branch="docs/lumen-live-context"`. Confirm the resulting commit and read it back. Repeat separately for `PROJECT_CONTEXT.md` only if durable rules changed.

Only update the **documentation branch**; do not change product code, `main`, release branches or PR merge state as part of a context update.

## How Claude Code / Codex updates these files

When a meaningful milestone is finished, first checkpoint the **coding branch** using the normal authorized process. Then update this docs branch separately, ideally in an isolated worktree. Example:

```bash
git fetch origin docs/lumen-live-context
git worktree add -b lumen-context-edit ../lumen-context-edit origin/docs/lumen-live-context
# Edit docs/lumen-context/CURRENT_STATUS.md there; charter only if necessary.
git -C ../lumen-context-edit add docs/lumen-context/
git -C ../lumen-context-edit commit -m "docs(context): sync verified Lumen checkpoint"
git -C ../lumen-context-edit push origin HEAD:docs/lumen-live-context
git worktree remove ../lumen-context-edit
```

Use a fresh unique worktree/branch name if `lumen-context-edit` already exists. Never force push or overwrite a concurrent update; fetch, reconcile and retry if a push is rejected. A clean checkout of the coding branch and its tests is independent from this status commit.

## Privacy boundary (IMPORTANT)

**The Lumen repository is public, including this docs branch.** These documents intentionally contain only project-safe context already appropriate for public repository documentation. **Never copy entire private ChatGPT Project Sources, private conversations, customer/account information, keys, tokens, credentials, private URLs or internal security findings to this branch.** Keep such context inside appropriately restricted sources or approved private storage. A future change in repo visibility does not remove already-published history.

## One-time Project setup

Copy the text from [CHATGPT_PROJECT_INSTRUCTIONS.md](CHATGPT_PROJECT_INSTRUCTIONS.md) into the Lumen ChatGPT Project's instructions. This is a **one-time manual UI step**; there is no tool here to edit Project instructions. Existing static Project Source uploads may remain background reference, but the live GitHub checkpoint must win for time-sensitive status.

This workflow is **agent-assisted synchronization**, not an unconditional real-time mirror. GitHub updates require an authorized connected writer at the milestone.
