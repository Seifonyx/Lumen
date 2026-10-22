# Lumen — durable project charter (PUBLIC-SAFE)

> **Evergreen principles, not a status report.** Current phase, PR/commit, active agent, work authorization, Gate decisions, test outcome and next action live in [CURRENT_STATUS.md](CURRENT_STATUS.md). Follow the agent workflow in [README.md](README.md). Do not append temporary milestone updates here.

## Product and design philosophy

Lumen is an independent, premium AI workspace for conversation, reading, sustained writing, projects, model selection/routing, providers, usage context and tools. Prioritize **original identity**, clear visual hierarchy, excellent desktop and real-iPhone interaction, accessibility and reliable feature parity.

**Canvas is the owner-selected design foundation** captured in the approved Blackout design records. Use the latest checkpoint for any newer design decision, approval state or superseding direction. Its principles include a unified Projects/conversations tree, compact resting composer, progressive controls, reversible expanded writing sheet, comfortable reading typography and refined phone glass. The conversational list is clean, with pinned entries first and others in recent-first order, not date-section headers, unless the owner changes that design choice.

Other products (including 9Router and ChatGPT) may be used as **functional inspiration**, never as a license to duplicate trademarked layouts, proprietary assets or unique screenshots. Routing Center must be a substantial, integrated workspace, not a decorative replica. Retain Lumen's actual model/provider capabilities.

## Stable engineering guarantees

- Reuse canonical components, state, model/provider routing, policies, permissions and usage sources rather than building conflicting parallel copies. Preserve composer draft/selection/IME/undo, Send/Stop, attachments, nested menus, accessibility, account isolation and data integrity.
- Never claim a provider limit, usage estimate, price, entitlement, test pass, release, security property or deployment is verified without appropriate evidence. Distinguish implementation, test, owner review, acceptance and production status.
- Validate on actual mobile Safari for material keyboard, safe-area, touch, blur, dictation/IME and VoiceOver behavior as required by the relevant acceptance plan. Desktop and simulated WebKit/Chromium tests support, but do not replace, required physical-device results.
- Keep review/proof code and **synthetic test identities/data** isolated from real inference, production Firebase/accounts, secrets and service workers. Preserve privacy/auth boundaries.
- The iPhone QA workflow should be **private, reusable, access-controlled, temporary/revocable and convenient**. Favor the owner's currently authorized solution from the live checkpoint; avoid unnecessary new links, new infrastructure or repetitive setup.
- **Strict $0 incremental spending** for private iPhone QA and its operation. Do not enable billed consumption, payment methods, upgrades, paid seats, checkout, additional paid dependencies or public preview hosting without distinct explicit owner authorization. When free limits, charges or safe access are uncertain, use the existing approved route or pause the risky action; never weaken isolation to save money.

## Authority, approval and agents

- **Owner** exclusively grants design/Gate approvals, new phase authorization when required, production integration, merges, deployments, spending, and consequential network/auth/access changes.
- **Coding agent:** Claude Code, Codex or another owner-selected capable tool. The *active agent* and currently authorized scope are dynamically maintained in [CURRENT_STATUS.md](CURRENT_STATUS.md), never assigned here permanently. Preserve completed work and related WIP during handoffs.
- **ChatGPT:** product/engineering partner, planner, practical design reviewer, agent brief author, connected-tool operator and cross-agent context coordinator.
- A previous Gate approval is a dated historical fact, not permission for other Gates or production release. Never infer authorization from successful tests, positive feedback, an unreviewed proposal or a past phase. Check the current state before consequential operations.

## Working style — capable, proactive and low friction

Work toward meaningful outcomes, not process for its own sake. Prefer a **solution-first recommendation and executable action** over lengthy audits and repeated questions. Use available GitHub, project/file, search, coding, browser/Work and artifact tools when authorized and actually connected; never invent tools or background progress.

Accept coherent coding-agent reports as the routine working basis, clearly labelling provenance. Investigate deeper only when evidence conflicts, a failure is material, the owner requests it or security, privacy, cost, account boundaries, Gate acceptance or production/release is at stake. Coding agents still run proportionate tests. For small fixes within an authorized milestone, proceed without needless new approval pauses and batch testing sensibly.

## Cross-agent continuity and confidentiality

Every agent opening a Lumen work session consults the [live checkpoint](CURRENT_STATUS.md) and [README.md](README.md), compares the latest meaningful owner direction/handoff, **updates missing status itself if it has write access**, and does nothing if another agent has already updated it. Repeat at meaningful milestones. Maintain durable policies here **only when those policies change**. Never require the owner to reupload Markdown for ordinary status changes. This is agent-triggered, not always-on background synchronization.

**Public repository warning:** all files on this branch are publicly readable. Never publish secrets, personal/private Project Source contents, private conversations, identifiers, protected account data, private addresses or confidential security findings. Keep those in authorized restricted stores. Do not merge the docs-only branch into production merely to synchronize context.
