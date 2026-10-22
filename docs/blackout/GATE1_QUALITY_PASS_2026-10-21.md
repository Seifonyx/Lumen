# Gate1 flagship quality pass — scoped user amendment

21 October 2026. Continue draft PR #34 after the Workspace + Focus consolidation (implementation `5c9ff0f3e20e0127afb45d48eca4f8fe2dc4b696`, branch head `41bae00`). Preserve that architecture and make one focused visual/UX quality pass. **Not another redesign.**

1. **Identity:** improve typography, proportions, spacing, hierarchy and composition within the existing direction. No generic dashboard styling, arbitrary logo, decoration or large restyle. Do not declare the brand final.
2. **Desktop intelligence:** improve the right rail's legibility, density and spacing; reading and writing stay the visual priorities.
3. **Mobile navigation:** make important actions understandable without more chrome; Workspace and Focus need clear, accurate mode identity.
4. **Usage:** small nonzero percentages must not appear as zero. Preserve canonical UsageMeter data, estimate semantics, unknown-allowance handling and routing contracts.

Preserve: first-screen phone answer visibility; the compact three-layer composer; draft/cursor/selection continuity; independent desktop Focus scrolling; attachments, tools, navigation and Send/Stop; canonical picker/provider/usage logic; accessibility and responsiveness.

Scope: only the isolated Blackout preview and directly related verification artifacts. No provider engineering. Verify 1440×960, 390×844, 320px, short-height and simulated-keyboard conditions; run existing regression and accessibility checks; never treat simulated browsers as physical-iPhone verification. Provide before/after captures (mobile Workspace, desktop Workspace, desktop Focus, changed controls).

**Stop conditions: no merge, deployment, production integration or Gate1 approval.** Finish this pass and stop for owner review. Record: [workspace-proofs/QUALITY_PASS.md](workspace-proofs/QUALITY_PASS.md).
