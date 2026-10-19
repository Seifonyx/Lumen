# Lumen — instructions for every coding and design agent

**Read this first on every new session or agent switch.** This entry point is intentionally short; authoritative directives are versioned elsewhere in the repository.

## Mandatory governing directives

1. **Operations, verification, source recovery, progress and cross-agent handoff:** [PROJECT_CONTINUUM.md](PROJECT_CONTINUUM.md), version 2.0. The user's **complete, supplied reference text** is preserved verbatim in content under [docs/design/PROJECT_CONTINUUM_V2_FULL.md](docs/design/PROJECT_CONTINUUM_V2_FULL.md). Read both where procedural detail matters.
2. **Current visual-overhaul requirements and design quality:** **[docs/design/LUMEN_DESIGN_RENAISSANCE_V1.md](docs/design/LUMEN_DESIGN_RENAISSANCE_V1.md)** — **complete approved amendment**, not a summary. It governs the Lumen Design Renaissance / Adaptive Native initiative. **Read it in full**, not just the title or handoff.
3. **Existing product contracts:** [MASTER_REQUIREMENTS.md](MASTER_REQUIREMENTS.md), [DESIGN.md](DESIGN.md), [PRODUCT.md](PRODUCT.md), [UX-CONTRACT.md](UX-CONTRACT.md). Original Dynamic Model Picker scope and security rules remain intact.
4. **Current progress and exact next steps:** [docs/design/ADAPTIVE_NATIVE_PLAN.md](docs/design/ADAPTIVE_NATIVE_PLAN.md), [docs/design/ADAPTIVE_NATIVE_HANDOFF.md](docs/design/ADAPTIVE_NATIVE_HANDOFF.md), and design baseline/spec. The unrelated Model Picker work continues to use root [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) and [AI_HANDOFF.md](AI_HANDOFF.md).

## Precedence and approval

- **Security, privacy, user data integrity, current approved functionality, accessibility protections, branch protections, and explicit user approvals** take precedence over a creative or procedural instruction that would compromise them. Record the exact disagreement in the design plan and handoff; implement safe independent work while resolving it.
- PROJECT CONTINUUM v2.0 is permanent operational process. DESIGN RENAISSANCE v1.0 is the authoritative **current design scope / quality directive**. They complement rather than replace each other.
- Distinguish the new approved **scope** from approved **visual implementation**. The user rejected PR #28 (generic static mockups) and PR #30 (marginal visual changes); **neither aesthetic was approved**. Do not use them as an approved baseline or merge/deploy them.
- **Do not merge substantial visual changes into production main or deploy them live without the user's explicit aesthetic approval of real redesigned app/screens.** Isolated development branches, verified previews and screenshot evidence are permitted where safe and properly scoped; a preview is not production approval.
- Preserve features: Auto/manual model selection, Layouts, discovery/rerouting, BYOK, privacy, drafts/history, voice/attachments, Study/Compare/Canvas/Tools/Projects/Library, account isolation, accessibility and current gesture/focus ownership.
- Don't replace a genuinely transformed design with small CSS tweaks. Produce distinct iOS/desktop real-component experiences; evaluate full matched before/after actual app captures in multiple modes and complex states.

## Required milestone rhythm

Recover current branch/main/deployed SHA and previous progress; implement in verified, recoverable phases; run relevant checks; inspect real screenshots; update the **existing** design plan and handoff **after every meaningful milestone** (weighted status/evidence, exact commit, tests, acceptance, blockers and next step); then safely commit/push. Preserve Model Picker 98.5% workstream tracking separately until its own verified evidence changes.

No self-asserted design score is equivalent to user approval. If quality regresses, revise rather than ship.
