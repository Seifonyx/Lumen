# Model Router

A private, free-tier AI workspace for chat, documents, data analysis and GitHub coding. Users supply their own provider and GitHub keys. The product serves phone and desktop use; preserve drafts, account isolation, privacy review and explicit actions for external writes.

## Product direction

Keep the interface clean, professional and compact, consistent with the current app. Existing light, dark and true-black themes are authoritative. Extend the palette and component conventions in `src/design.css`; functional responsive layouts remain in `styles.css`. App controls should explain useful decisions without exposing unnecessary implementation details.

## Repository plan flow

1. Connect a repository and enable **Plan** beside its composer controls.
2. Send the task. The model inspects files and proposes ordered steps with affected paths.
3. Review, revise or reject the plan. **Approve plan** prepares an editable implementation draft; sending it passes through normal privacy checks and starts the work.
4. Review proposed edits, accept/reject individual changed blocks locally, and use the explicit commit/PR flow for GitHub writes. Rejected blocks stay rejected during Apply all.
5. Check each plan step after reviewing its changes and verification, then finish the review. Checkboxes record the user's review; they do not execute tests or certify that tests passed.

Planning replies cannot authorize edits. Approval belongs to a particular plan, repository/branch, conversation, local workspace snapshot and device. Reloading an approved but unsent plan requires renewed approval. Incomplete, failed or stopped plans require a fresh proposal. Earlier plans and plans from another device remain readable without transferring approval.

## Scope

The repository panel can preview and undo the latest non-merge commit with an explicit Undo and push action. It creates a revert commit restoring the previous tree; history is preserved. Uncommitted work blocks undo, and branch/account/key changes require a fresh preview. Merge, first and empty commits are not supported. Separate chat folders are excluded at the user's request.

`ROADMAP.md` tracks implemented features and remaining phases. Arabic interface support is excluded at the user's request. Deliver coding improvements in separately tested and verified deployments; keep existing free-only operation and account privacy intact. `HANDOFF.md` records operational context and the latest verified release.
