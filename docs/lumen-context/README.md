# Lumen — live continuity entrypoint

**Public repository:** `Seifonyx/Lumen`. **Canonical context ref:** `docs/lumen-live-context`. This is a **docs-only branch**; do not merge it into production to keep context synchronized. Static Project Source uploads and older chats are background, not a live operational feed.

## Three files, three jobs

1. [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) — **evergreen product vision, working style, security and approval rules**. Modify only when a durable owner rule changes. **Never store current phase or next task here.**
2. [CURRENT_STATUS.md](CURRENT_STATUS.md) — **the only live execution snapshot**: current owner authorizations, active agent, workstream/PR, actual milestone, Gate state, progress and next action. **Replace its current-state fields as reality changes**, rather than appending new “Latest” sections while leaving stale summaries intact.
3. [CHATGPT_PROJECT_INSTRUCTIONS.md](CHATGPT_PROJECT_INSTRUCTIONS.md) — stable one-time ChatGPT Project settings template. The owner pastes it into the private Project settings once; **future milestones should not require another paste**.

[STATUS_HISTORY_THROUGH_2026-10-22.md](STATUS_HISTORY_THROUGH_2026-10-22.md) preserves earlier dated context and evidence **for reference only**. Old “current”, “only authorized”, “next” and “STOP” statements in historical documents are not live authority.

## Universal agent startup (ChatGPT, Claude Code, Codex, successors)

- At the **beginning of each new Lumen work session or agent handoff**, fetch README, PROJECT_CONTEXT and CURRENT_STATUS from this exact branch. The current conversation's latest explicit owner instructions outrank older checkpoint claims; directly relevant actual code/PR evidence outranks contradictory status text.
- When doing coding/planning, consult current coding-branch `AGENTS.md`, `CLAUDE.md` if applicable, `docs/blackout/AI_HANDOFF.md`, `docs/blackout/IMPLEMENTATION_PLAN.md` and other task-specific sources **as needed**. Current status/authorizations come from the live checkpoint plus newer owner messages, **not** the headers or bottom-of-file STOP notes in dated historical records.
- Check whether CURRENT_STATUS already covers the latest meaningful owner decision, active agent, coding milestone, Gate position and next step. **If yes: proceed with no write or extra question. If missing: update it yourself** with the connected GitHub writer and continue. Repeat at meaningful milestones/decisions/handoffs.
- For a write: fetch the latest live document and blob SHA; change only the current snapshot/next-action fields, label agent-reported versus independently verified claims, keep all content **public-safe**, and read back to confirm. On a concurrent edit, refetch and reconcile; never force overwrite another agent's newer work. Change PROJECT_CONTEXT only for durable policy changes. No duplicate update if another agent already synchronized it.
- If a necessary connector/write is unavailable, say so once and provide the missing public-safe text; **do not claim success** or request file reuploads. Continue independently authorized tasks if safe. This is **agent-invoked on entry/completion**, not a timer, daemon or unconditional background service.

## App-first recommendation gate (mandatory for planners)

Before suggesting a new Lumen feature, visual/UX correction or coding quality task, **inspect the latest app itself in the relevant screen, interaction and platform state**. Code, docs, past audits, tests and agent reports establish context but do **not** replace an actual application check. Use authorized browser/device access or private synthetic QA with **$0 incremental cost**, no secrets/real account data or real inference. Distinguish simulator/WebKit evidence from physical iPhone results; use the owner's recent physical-device checks when pertinent.

In the recommendation, briefly state what app behavior was observed and what remains unverified. Require an evidence-based root cause or owner-confirmed need before directing implementation; don't convert an unverified hypothesis into a bug-fix prompt. If app inspection cannot be performed from this session, say so and make the next task **inspection and evidence gathering first**, not speculative implementation. Keep inspections narrow; do not reopen accepted work or repeat broad audits needlessly.

## Shipping-first product execution

When the owner explicitly directs a working native or production rollout, treat it as the active delivery objective instead of extending isolated previews indefinitely. Build on the existing Canvas application and canonical routing/account systems; preserve safety and test proportionately, then improve the installed app incrementally. Consult `CURRENT_STATUS.md` for the latest specific release scope and authority. Do not conflate an IPA build, private iPhone install, PR merge and production website deployment, or claim any occurred without evidence. Preserve $0 incremental spending and protected account, identity and privacy boundaries.

## Lean execution, full capability

Be a proactive project partner. Use connected tools when they actually exist and are authorized; complete routine actions rather than asking the owner to handle them manually. Reuse previous milestones and avoid re-reviewing whole codebases or full CI just to acknowledge routine agent reports. Verify narrowly where failure, conflicting evidence, real-world exposure, costs, privacy/auth/account boundaries, material regression or a mandatory Gate/release decision justifies it. Coding agents still run necessary scoped tests and protect existing functionality.

Within approved quality/design scope, prioritize the best outcome: **already implemented or previously approved UI may be materially redesigned, simplified, removed or replaced when an evidenced improvement warrants it**. Do not impose a 'cosmetic polish only' rule or treat sunk implementation work as untouchable. Protect functionality and proportionate verification, sequence improvements without unnecessary pauses, and keep the active checkpoint's scope in view. **Consult the current owner authorizations in PROJECT_CONTEXT and CURRENT_STATUS: the owner has granted standing approval for scoped merges and deployments, subject to release checks. New unapproved phases, formal Gate acceptance, spending, auth/security changes and new public network exposure still require separate explicit authority**. The strict $0 incremental spending requirement for private iPhone QA is permanent until the owner changes it.

## Coding-branch documentation maintenance

After a meaningful coding milestone, update coding-branch `docs/blackout/AI_HANDOFF.md` and `IMPLEMENTATION_PLAN.md` as appropriate while preserving weights and historical evidence. Keep their **active header** current or clearly refer to CURRENT_STATUS; label historical phases and former instructions as archive. Prefer scoped reviewable commits, avoid editing unrelated worktrees, and maintain the independent live checkpoint. GitHub's contents API with current SHA is acceptable; from a local coding workspace an isolated worktree on the docs branch avoids branch pollution. Never force-push to resolve a race.

## Public vs private safety

This GitHub repo and this branch are **public**. Do not write private Project Source contents, customer/user account details, credentials, tokens, unpublished sensitive links, private conversations or confidential security details here. The currently authorized testing workflow must preserve private access, synthetic data, strict $0 spend and production separation.

## One-time ChatGPT Project setting

Open Lumen's Project settings and copy the text **between the separators** in [CHATGPT_PROJECT_INSTRUCTIONS.md](CHATGPT_PROJECT_INSTRUCTIONS.md) into Project instructions. ChatGPT does not have a connected control that automatically edits that private setting. Routine status and milestone updates belong in CURRENT_STATUS thereafter—not in the Project Instructions text.
