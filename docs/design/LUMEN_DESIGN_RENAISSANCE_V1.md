# LUMEN DESIGN RENAISSANCE
## Ultimate Visual Transformation, Native-Quality Experience & Product Craft Directive

**Version 1.0 — Master Autonomous Design & Implementation Prompt**

**Project:** Lumen  
**Repository:** https://github.com/Seifonyx/Lumen  
**Governing protocol:** PROJECT CONTINUUM v2.0  
**Mission:** Transform Lumen into an exceptionally crafted, distinctive, premium AI application across iOS, desktop, tablet, and other supported devices.

---

# 0. PRIMARY MISSION — NO MORE SUPERFICIAL REDESIGNS

You are acting as Lumen's principal product designer, senior UX architect, visual design director, interaction designer, and frontend engineering lead.

Your assignment is to deliver the most ambitious, cohesive, beautifully executed visual and experiential transformation that can realistically be achieved within Lumen's existing architecture and product requirements.

**This is not a CSS polish task. This is not a theme refresh. This is not permission to add rounded corners, subtle shadows, and call the application redesigned.**

The user has rejected two previous design directions:

- **PR #28:** Generic, simplified, rushed-looking designs that appeared less sophisticated than the original application.
- **PR #30:** Minor opacity, wrapping, highlight, and shadow adjustments that were too subtle to register as meaningful improvement.

PR #30 was explicitly rejected as insufficiently transformative. Its engineering improvements may be evaluated independently, but its visuals must not be treated as approved.

The user's assessment of the previous work was:

> "It became too basic and the designs themselves looked worse and so vibe coded that it was made in 5 minutes."

And subsequently:

> "uh i dont feel any great differences?"

Treat this feedback as authoritative.

The fundamental failure was not inadequate effort on small details. It was choosing an approach too conservative and visually unambitious for the objective.

**Your responsibility is to solve the design problem at the level of the complete product experience.**

Lumen must become a product whose quality is immediately apparent when someone opens it, interacts with it, navigates its tools, and uses it for real work.

The ultimate objective is to create something that feels thoughtfully designed by an exceptionally skilled product team, with the originality, coherence, utility, and execution quality associated with outstanding commercial software.

Do not claim absolute perfection. Instead, pursue the highest practical level of design craft and verify the result.

---

# 1. PERMANENT CONTINUITY AND EXISTING PROJECT STATE

Before beginning, read and follow:

- `PROJECT_CONTINUUM.md`
- `MASTER_REQUIREMENTS.md`
- `IMPLEMENTATION_PLAN.md`
- `AI_HANDOFF.md`
- `DESIGN.md`
- `PRODUCT.md`
- `UX-CONTRACT.md`
- `docs/design/ADAPTIVE_NATIVE_BASELINE.md`
- `docs/design/ADAPTIVE_NATIVE_SPEC.md`
- `docs/design/ADAPTIVE_NATIVE_PLAN.md`
- `docs/design/ADAPTIVE_NATIVE_HANDOFF.md`
- Any relevant `AGENTS.md`, `CLAUDE.md`, architecture, testing, and deployment documentation.

Recover the current Git status, main branch, existing PRs, verified deployments, active worktrees, and pending changes.

The design initiative already has a documented weighted-progress baseline, previously approximately **7.5%**. Verify that this remains current instead of resetting or inventing a new percentage.

The Dynamic Model Picker is an independent workstream. Do not merge its progress scoring with the design overhaul.

Existing design documentation contains useful direction, but some of it was written before the user's latest dissatisfaction.

Consequently:

1. Preserve existing approved product requirements, security guarantees, design identity, and working features.
2. Preserve the principle of platform-adaptive design.
3. Treat earlier unapproved design details as proposals, not immutable creative restrictions.
4. Correct design assumptions that prevent a substantial improvement, recording the reasoning and any requirement conflicts.
5. Never reinterpret the user's rejection as a request for more subtle polish.
6. Do not reopen, merge, or deploy rejected concepts as approved redesigns.
7. Keep Project Continuum's progress, cross-agent handoff, and verified deployment policies intact.

**This prompt is an explicit amendment to the current Lumen design initiative, not authorization to discard existing product requirements.**

---

# 2. RESEARCH EXCEPTIONAL APPLICATION DESIGN BEFORE IMPLEMENTATION

Do not design exclusively from internal assumptions or familiarity with common AI chat interfaces.

Conduct serious, targeted design research.

Study real, shipped applications and authoritative design guidance across multiple product categories.

Prioritize sources that explain not only what an interface looks like, but why it works.

## 2.1 Required reference research

### Apple — Platform quality and iOS craftsmanship

Study:

- https://developer.apple.com/design/human-interface-guidelines/
- https://developer.apple.com/design/human-interface-guidelines/designing-for-ios/
- https://developer.apple.com/design/human-interface-guidelines/designing-for-macos/
- https://developer.apple.com/design/human-interface-guidelines/materials
- https://developer.apple.com/documentation/TechnologyOverviews/liquid-glass

Investigate:

- iOS navigation systems.
- Typography and optical hierarchy.
- Native-feeling bottom sheets.
- Safe areas and keyboard interactions.
- Dynamic materials and transparency.
- Touch feedback and gestures.
- Contextual toolbars.
- Transition continuity.
- Accessibility and adaptive appearance.
- Platform-appropriate information density.

Understand the difference between genuine native interaction quality and superficial imitation of iOS visual effects.

Do not apply glass everywhere. Use materials to clarify functional hierarchy.

### Linear — Professional interface precision

Study:

- https://linear.app/
- https://linear.app/now/behind-the-latest-design-refresh
- https://linear.app/now/linear-liquid-glass
- https://linear.app/now/design-is-more-than-code

Investigate:

- Workspace composition.
- Sidebar hierarchy.
- Professional information density.
- Restrained but deliberate color.
- Sophisticated navigation.
- Consistent header composition.
- Focused content areas.
- Purpose-built mobile navigation.
- High-quality interactions in complex workspaces.

Learn how sophisticated applications remain visually calm without becoming empty, generic, or feature-poor.

### Raycast — Interaction and desktop excellence

Study:

- https://www.raycast.com/
- https://www.raycast.com/blog/the-new-raycast
- https://www.raycast.com/blog/a-technical-deep-dive-into-the-new-raycast

Investigate:

- Command interfaces.
- Keyboard-first workflows.
- Fast contextual actions.
- Floating panels and menus.
- Interaction states.
- Input precision.
- Smooth, stable transitions.
- Native-feeling web-based interfaces.
- Efficient handling of complex functionality.

### Things — Craft, clarity, and delight

Study:

- https://culturedcode.com/things/
- https://culturedcode.com/things/features/

Investigate how typography, spacing, hierarchy, interaction, animation, and restraint create a genuinely distinctive application.

Pay particular attention to how features can remain powerful without overwhelming the primary task.

### Additional relevant products

Inspect contemporary interfaces from:

- Craft — rich-content layout and editorial typography.
- Arc — navigation and workspace organization.
- Claude and ChatGPT — conversational interaction patterns.
- Cursor and sophisticated development tools — contextual workspace arrangements.
- Other outstanding Apple Design Award recipients.
- Carefully selected examples from Mobbin: https://mobbin.com/

These are reference categories, not instructions to copy their visual identity.

Look beyond AI applications. Sometimes the best solution comes from another product category.

## 2.2 Research deliverable

Create or update a design-reference document under `docs/design/`.

For each meaningful reference, record:

- Product and source link.
- Relevant screen or interaction.
- Specific design principle demonstrated.
- Why it is effective.
- How that principle could benefit Lumen.
- What should not be copied.
- Feasibility within Lumen's web architecture.

Where licensing and tooling permit, include annotated references or links to actual visual examples.

Aim for approximately 10–15 carefully chosen references, prioritizing depth of analysis over quantity.

Do not claim to have inspected anything you could not access.

**Research must influence actual design decisions. It must not become an excuse to spend the session producing documentation without implementing anything.**

---

# 3. DEFINE A DISTINCTIVE LUMEN DESIGN IDENTITY

Lumen must remain unmistakably Lumen.

Its existing Switchboard identity provides a foundation:

- Eclipse moon symbol.
- Cool ink-and-paper neutrals.
- Restrained lime signal color.
- Technical precision.
- Model-routing intelligence.
- A calm but capable AI workspace.
- Light, dark, and true-black themes.

Preserve this identity while elevating its execution substantially.

The application should not become:

- A generic ChatGPT clone.
- A simplified Linear imitation.
- An Apple Settings replica.
- A dashboard assembled from interchangeable rounded cards.
- A decorative glassmorphism experiment.
- A neon AI-themed interface.
- A minimal interface that hides important functionality.
- An interface that appears generated from a generic component-library template.

## 3.1 Develop a real art direction

Define a coherent system covering:

1. Visual personality and brand expression.
2. Spatial composition.
3. Typography and reading rhythm.
4. Surface hierarchy.
5. Color and semantic accents.
6. Form and geometry.
7. Depth, elevation, and material behavior.
8. Icons and optical alignment.
9. Navigation patterns.
10. Interaction feedback.
11. Motion choreography.
12. Accessibility adaptations.
13. Distinctive product moments.
14. Cross-platform consistency.

The result must feel like one carefully designed product, not independently styled screens.

Retain Lumen's lime signal as meaningful interface communication rather than random decoration.

The design should be recognizable without relying on excessive branding.

---

# 4. TWO PURPOSE-BUILT EXPERIENCES, ONE PRODUCT

The user has explicitly chosen to combine two design directions:

**iOS: Apple-quality native tactility and elegance.**

**Desktop: Exceptionally precise, sophisticated professional workspace design.**

Both directions are equally important.

Neither is secondary.

They should share Lumen's identity, core functionality, semantics, and underlying application state while adapting their interaction and presentation to the device.

Do not force desktop conventions onto iPhone.

Do not enlarge a phone interface to create the desktop experience.

Do not assume that responsiveness means simply stacking the same components vertically.

Design both experiences deliberately.

---

# 5. iOS — EXCEPTIONALLY CRAFTED, NATIVE-FEELING EXPERIENCE

Transform the entire iPhone experience.

Your goal is a fluid, beautifully composed application that respects how people interact with iOS.

Its visual quality should be apparent immediately, but its interaction quality must continue rewarding use.

## 5.1 Welcome and new conversation

Reconsider the complete screen composition:

- Eclipse presentation.
- Greeting typography and placement.
- Spacing and visual rhythm.
- Header hierarchy.
- Composer placement.
- Tool discoverability.
- Model-selection visibility.
- Theme-specific materials.
- Keyboard transitions.
- Empty-state balance.

The result should feel intentional and distinctly Lumen.

Do not fill empty space with unnecessary onboarding cards, marketing copy, or decorative features.

Existing welcome behavior and functional controls must survive.

## 5.2 Conversation experience

Design the entire reading and writing experience:

- Beautifully structured assistant responses.
- Recognizable but restrained user messages.
- Comfortable reading measure and rhythm.
- Excellent Markdown and rich-content presentation.
- Code blocks, tables, citations, and attachments.
- Model provenance and routing feedback.
- Streaming and loading indicators.
- Response actions and contextual menus.
- Scrolling and conversation navigation.
- Long-conversation behavior.
- Error, partial-response, and retry states.

A populated, complex conversation must look at least as polished as the welcome screen.

Avoid excessively boxed responses or decorative containers that interrupt reading.

## 5.3 Composer

Treat the composer as one of the application's flagship components.

Refine:

- Its geometry and spatial presence.
- Input typography.
- Attachment controls.
- Active tool states.
- Model selection.
- Voice and dictation.
- Send and Stop states.
- Focus and keyboard behavior.
- Expanded multiline editing.
- Long attachment names.
- Context indicators.
- Safe-area behavior.
- Motion when content changes.

The composer should feel responsive, precise, comfortable, and thoughtfully integrated into the screen.

Do not create unnecessary floating layers or obscure conversation content.

## 5.4 Navigation, sheets, and pickers

Transform:

- Primary navigation.
- Sidebar/drawer interactions.
- Add-to-chat sheet.
- Model picker.
- Layout selection.
- Tool selection.
- Contextual action menus.
- Project navigation.
- Settings and feature hubs.

Use high-quality navigation transitions and purposeful materials.

Sheets must be readable over real underlying content.

Interactions should respond naturally to touch, support cancellation, and preserve the user's place.

Model lists must remain fully reachable at narrow widths.

Do not remove options to make a screenshot cleaner.

## 5.5 Realistic platform expectations

Lumen is currently a React/Vite web application, not a native SwiftUI app.

Aim for excellent native-like quality within the actual supported browser capabilities.

Do not claim that CSS translucency reproduces system-native compositing or that browser testing proves physical-device haptics.

Where browser limitations exist, provide the strongest feasible interaction and record what requires physical-device validation.

---

# 6. DESKTOP — A WORLD-CLASS PROFESSIONAL AI WORKSPACE

The desktop redesign must be substantially more ambitious than adjustments to existing shadows and sidebar highlights.

Reconsider how the entire application is composed.

The goal is a workspace that feels efficient, immersive, sophisticated, and enjoyable during sustained use.

## 6.1 Workspace architecture

Revisit the relationship between:

- Primary sidebar.
- Navigation groups.
- Conversation history.
- Search.
- Main workspace.
- Contextual header.
- Conversation reading area.
- Composer.
- Model controls.
- Side panels.
- Tool surfaces.
- Projects and connected repositories.

Create a stronger sense of spatial hierarchy.

The central task should dominate visually, while secondary controls remain discoverable and convenient.

Do not add redundant navigation rails or extra toolbars merely to look more sophisticated.

## 6.2 Conversation and reading experience

Elevate:

- Main-column proportions.
- Text measure and hierarchy.
- Message differentiation.
- Rich-response formatting.
- Code presentation.
- Attachments and document references.
- Model and routing status.
- Response tools.
- Streaming feedback.
- Scroll navigation.
- Composer integration.

The interface should feel elegant both when empty and when displaying dense, complex work.

## 6.3 Navigation and power-user workflows

Refine:

- Sidebar grouping and density.
- Selected-state treatments.
- Search and command interactions.
- Popover anchoring.
- Keyboard navigation.
- Focus restoration.
- Shortcut affordances.
- Contextual actions.
- Panel resizing and narrow-window adaptation where feasible.
- Hover, active, disabled, loading, and destructive states.

Precision matters.

Small interaction imperfections accumulate into an unpolished desktop experience.

## 6.4 Feature workspaces

Do not treat advanced features as an afterthought.

Develop cohesive yet purpose-built presentation for:

- Model Picker and custom Layouts.
- Auto and routing visibility.
- Study.
- Compare.
- Canvas.
- Projects.
- Library.
- Tools.
- GitHub repository workflows.
- Settings and provider/API-key configuration.
- Search, history, and supporting dialogs.

Each should have the information density and interaction model appropriate to its actual purpose.

A comparison workspace should not look identical to a settings form.

A document workspace should not be presented as a generic dashboard card grid.

A model picker must communicate capabilities, eligibility, selection, and status clearly.

**Lumen's sophisticated functionality is a design opportunity, not clutter to hide.**

---

# 7. MATERIALS, TYPOGRAPHY, COLOR, AND MOTION

Create a genuinely coherent visual system.

## 7.1 Typography

Evaluate the existing Geist and system-font choices.

Develop clear relationships among:

- Display/greeting.
- Page titles.
- Section headings.
- Body copy.
- Interface labels.
- Metadata.
- Technical identifiers.
- Code.

Improve optical spacing, weight distribution, line height, and hierarchy.

Avoid tiny low-contrast labels used merely to achieve visual minimalism.

## 7.2 Materials and depth

Develop meaningful surface layers:

- Canvas/background.
- Primary workspace.
- Navigation surfaces.
- Floating composer.
- Menus and popovers.
- Modal sheets.
- Transient interaction layers.

Desktop should favor precise, disciplined separation.

iOS may employ more expressive dynamic materials when they add value.

Test translucency over actual text, images, and complex conversations.

Respect accessibility and performance settings.

## 7.3 Colors and themes

Support Lumen's existing light, dark, and true-black appearances.

Each theme must be individually crafted, not merely recolored.

Check:

- Contrast.
- Tonal depth.
- Active states.
- Borders.
- Shadows.
- Readability.
- Material separation.
- Semantic status colors.
- Lime accent behavior.

True black should retain meaningful visual hierarchy without destroying the OLED-black appearance.

## 7.4 Motion

Design consistent motion rules for:

- Press and release.
- Menu opening/closing.
- Sheet dragging and dismissal.
- Navigation.
- Response appearance.
- Composer expansion.
- Panel transitions.
- Selection and routing feedback.
- State changes.

Motion must explain relationships and communicate state.

Avoid continuous decorative movement, excessive blur, bouncy transitions everywhere, or effects that make the app slower.

Respect reduced-motion settings.

---

# 8. CREATE CONCEPTS THAT ARE ACTUALLY DIFFERENT

Before locking implementation details, explore more than one genuine composition-level direction.

These should be distinct in layout, spatial rhythm, hierarchy, and interaction design—not merely different accent colors.

Evaluate each direction against:

- Visual distinctiveness.
- Lumen brand compatibility.
- iOS quality.
- Desktop quality.
- Usability.
- Feature preservation.
- Accessibility.
- Technical feasibility.
- Performance implications.
- Long-term maintainability.

Select the strongest direction with documented reasoning.

Do not force an arbitrary choice between conservative and expressive design. Combine the best compatible elements into a coherent result.

Then implement high-fidelity proofs using actual Lumen application components.

Exploratory sketches may help thinking, but **standalone decorative HTML or fictional app mockups are not acceptable as the primary design deliverable**.

The approved candidate must be demonstrated in the running application.

---

# 9. MANDATORY BEFORE-AND-AFTER VISUAL EVIDENCE

This section is critical because previous attempts failed precisely here.

Before changing major surfaces, capture the existing app at reproducible viewport sizes and states.

Then capture the redesigned implementation with identical fixture content, theme, browser, dimensions, and relevant interaction state.

Use existing repository screenshot helpers and Playwright infrastructure where practical.

## 9.1 Minimum flagship review set

### iOS

Capture at least:

1. Welcome screen.
2. Populated conversation.
3. Composer with active controls.
4. Add-to-chat sheet.
5. Model Picker.
6. Navigation drawer.
7. One complete feature hub.
8. At least one complex interaction state.

Prioritize 390px portrait, with 320px and 430px compatibility evidence.

Include relevant light, dark, and true-black appearances.

### Desktop

Capture at least:

1. Complete welcome/workspace.
2. Populated conversation.
3. Sidebar with real navigation content.
4. Model-selection interface.
5. Composer and contextual tools.
6. One complex feature workspace.
7. Settings or another dense control interface.
8. At least one meaningful overlay/panel state.

Prioritize 1280px and 1440px widths, plus appropriate narrow-window checks.

## 9.2 Visual deliverables

Provide:

- Original full-resolution screenshots.
- Redesigned full-resolution screenshots.
- Matched before/after comparisons.
- A concise visual review board.
- Close-ups of important design details.
- Short interaction recordings where tooling supports them.
- A description of important behavioral changes.
- A clear list of visual areas still unfinished.

Do not present only one cropped picker screenshot.

Do not shrink every screenshot into a montage that makes important details impossible to judge.

Do not use fabricated screenshots or generated imagery to represent actual implementation.

## 9.3 First-glance transformation test

Ask:

**Without reading a changelog, is the improvement visible in the complete screen?**

If the answer is no, the design milestone has not met its purpose.

A substantial redesign should demonstrate purposeful changes to composition, hierarchy, readability, coherence, and interaction—not simply a large number of altered pixels.

If a direction performs worse than the original, discard or revise it.

Do not rationalize a disappointing result because implementation took considerable effort.

---

# 10. DESIGN QUALITY ACCEPTANCE GATES

Evaluate the candidate across six dimensions.

### A. Visual transformation — 25%

Is the new application immediately and meaningfully better composed?

Are the changes substantial and intentional?

### B. Craft and coherence — 20%

Does the application have a consistent visual language?

Are typography, spacing, icons, materials, and component states carefully refined?

### C. Interaction quality — 20%

Do navigation, input, transitions, gestures, and state changes feel fluid and predictable?

### D. Usability and functionality — 15%

Is the application at least as understandable and capable as the original?

Are advanced capabilities still accessible?

### E. Platform adaptation — 10%

Does the iPhone experience feel suitable for iPhone?

Does the desktop experience take advantage of a large screen and precise inputs?

### F. Accessibility and performance — 10%

Does the implementation maintain readable contrast, keyboard access, responsiveness, and reduced-effect alternatives?

This rubric is a design-review aid, not a replacement for testing or the existing weighted project-progress methodology.

Scores must be justified by actual inspection.

An agent's self-assigned high score does not constitute user approval.

**User aesthetic approval is mandatory before substantial visual changes are merged into production.**

When presenting the flagship proof, ask the user to evaluate the actual screenshots or safe preview.

If rejected, revise the design direction instead of applying a few cosmetic corrections and asking again.

---

# 11. ENGINEERING QUALITY AND EXISTING ARCHITECTURE

Inspect actual component and stylesheet ownership before modifying the interface.

At the previous checkpoint, Lumen's relevant implementation included:

- React and TypeScript.
- Vite.
- Zustand.
- `src/app.css`.
- `src/glass.css`.
- `src/components/Sidebar.tsx`.
- `ChatView.tsx`.
- `Composer.tsx`.
- `MessageThread.tsx`.
- `ModelPicker.tsx`.
- `AttachSheet.tsx`.
- `HubPage.tsx`.
- Existing Tools, Projects, Library, Settings, Canvas, Study, and Compare components.

Verify the current structure; do not assume filenames are unchanged.

Avoid piling endless conflicting CSS overrides onto an already complex stylesheet.

Where appropriate, consolidate semantic design tokens and establish clearer component styling ownership.

Prefer maintainable architectural changes that support the approved design.

Do not rewrite stable application business logic merely to change appearance.

Do not introduce unnecessary animation libraries, heavy UI dependencies, or duplicated control systems.

Preserve existing accessibility semantics and interaction ownership.

Reconcile contradictory or outdated design documentation against current implementation, tests, and accessibility requirements.

---

# 12. NONNEGOTIABLE FEATURE PRESERVATION

The redesign must not break or diminish:

- Automatic model selection.
- Manual model choice.
- Custom Layouts.
- Model discovery and refresh.
- Routing and rerouting.
- Provider eligibility and consent.
- API-key management.
- Incognito/privacy behavior.
- Conversation history and drafts.
- Attachments.
- Voice and dictation.
- Study and Compare.
- Canvas and document workflows.
- Library and knowledge search.
- Projects.
- Repository coding workflows.
- Existing keyboard shortcuts.
- Offline and error handling.
- Account isolation.
- Data persistence.
- Accessibility settings.
- Existing explicit user controls.

Audit feature parity before and after implementation.

Visual simplicity is not permission to remove capabilities.

If functionality must be presented differently, ensure the replacement preserves discoverability, access, and behavior.

---

# 13. TESTING, ACCESSIBILITY, AND PERFORMANCE

Execute the actual repository's appropriate checks.

These may include:

- `npm run typecheck`
- `npm run build`
- `npm run test:unit`
- Existing targeted end-to-end suites.
- Chromium checks.
- WebKit checks.
- Design and fit tests.
- Gesture and interaction tests.
- Accessibility checks.
- Screenshot comparisons.

Use the current repository's verified commands rather than assuming every example invocation is valid.

Include representative testing at:

- 320, 375, 390, and 430px mobile widths.
- Relevant mobile landscape.
- 768, 899, and 1024px tablet sizes.
- 1280, 1440, and wider desktop layouts.
- Light, dark, and true-black themes.
- Keyboard-visible and keyboard-hidden states.
- Large text and zoom.
- Reduced motion and transparency where supported.
- Touch and pointer interaction.
- Keyboard-only navigation.
- Complex long-form content.
- Long model names and dense menus.
- Loading, failure, offline, and quota states.

Use WCAG 2.2 AA as an appropriate accessibility target, without making unsupported certification claims.

For web-performance guidance, refer to:

- https://web.dev/articles/vitals
- https://web.dev/articles/optimize-inp
- https://playwright.dev/docs/test-snapshots
- https://www.w3.org/TR/WCAG22/

Measure key interactions and visual stability where practicable.

Compare against the original application when evaluating regressions.

Do not claim physical iPhone validation unless conducted on actual hardware.

Do not use live paid AI-provider requests merely to generate design screenshots.

---

# 14. EXECUTION PHASES — RESEARCH, DESIGN, BUILD, VALIDATE

Follow Project Continuum, using independent recoverable checkpoints.

## Phase 0 — Recovery and baseline

- Recover current project and Git state.
- Reconcile rejected design history.
- Verify existing design-progress weights.
- Inspect live application components.
- Capture representative existing screens.
- Identify structural design weaknesses.
- Preserve baseline evidence.

**Deliverable:** Accurate baseline and clear problem definition.

## Phase 1 — Research and art direction

- Study authoritative platform guidance.
- Analyze high-quality shipped applications.
- Build a curated reference dossier.
- Explore distinct visual directions.
- Select a coherent platform-adaptive design direction.
- Define visual principles and flagship component treatments.

**Deliverable:** Research-backed art direction with clear decisions.

Do not spend multiple sessions endlessly expanding references after sufficient evidence exists.

## Phase 2 — Substantial iOS flagship implementation

Implement meaningful changes directly in actual Lumen components.

Prioritize welcome, conversation, composer, navigation, sheets, and model selection.

Produce full-size screenshots and relevant interaction evidence.

**Deliverable:** A visibly transformed, functional iPhone experience suitable for aesthetic review.

## Phase 3 — Substantial desktop flagship implementation

Implement a cohesive desktop workspace transformation.

Prioritize sidebar, workspace composition, conversation, composer, controls, and one complex feature surface.

Produce full-size screenshots and relevant interaction evidence.

**Deliverable:** A visibly transformed, functional desktop experience suitable for aesthetic review.

## Phase 4 — Visual evaluation and revision

Compare both implementations against their original states.

Review quality, hierarchy, functionality, and interaction.

Revise weak elements.

Present the complete matched visual evidence to the user.

**Gate:** Obtain explicit user aesthetic approval before merging the major redesign.

Do not treat the completion of Phase 2 or 3 as visual acceptance.

## Phase 5 — Design-system integration

After approval:

- Establish maintainable shared tokens.
- Consolidate component appearance.
- Remove abandoned prototype code.
- Integrate approved platform treatments.
- Reconcile CSS architecture.
- Ensure light/dark/true-black quality.
- Preserve complete feature parity.

## Phase 6 — Remaining product surfaces

Extend the design to:

- Settings.
- Projects.
- Tools.
- Library.
- Canvas.
- Study.
- Compare.
- Model management.
- GitHub workflows.
- All important dialogs and application states.

Avoid a polished home screen surrounded by unfinished older interfaces.

## Phase 7 — Verification, preview, and release

- Run relevant complete checks.
- Perform visual regression review.
- Conduct independent design/code review where possible.
- Prepare a safe isolated preview.
- Provide the user with an accessible preview link where infrastructure permits.
- Verify that the preview represents the exact reviewed commit.
- Resolve remaining defects.
- Obtain any required final approval.
- Merge through authorized workflow.
- Verify actual deployment and live behavior.
- Synchronize documentation.
- Continue remaining approved work.

Preview deployment must be verified as isolated from production and must not overwrite another shared environment unexpectedly.

If safe preview deployment is unavailable, explain the specific limitation and supply actual-app screenshot and interaction evidence instead.

**Never deploy an unapproved substantial redesign to production.**

---

# 15. USE PROJECT CONTINUUM FOR EVERY CHECKPOINT

All work must remain recoverable by another agent.

Maintain the existing authoritative design documents and weighted task methodology.

Update progress after meaningful milestones, including:

- Verified accomplishments.
- Exact source branch and commit.
- Current percentage and confidence.
- Remaining design tasks.
- Acceptance evidence.
- Tests run.
- Screenshot artifacts.
- Outstanding aesthetic approvals.
- Open regressions.
- Preview and production status.
- Exact next action.

When the existing weighted plan lacks detail, improve task acceptance criteria without arbitrarily resetting weights.

Before agent switching or usage-limit boundaries:

1. Review changes.
2. Complete or safely checkpoint the current work.
3. Run appropriate checks.
4. Update documentation.
5. Commit verified progress.
6. Push safely.
7. Verify remote synchronization.
8. Preserve screenshot locations and relevant artifacts.
9. Clearly record what remains unfinished.
10. Ensure the next agent can continue without chat history.

Do not merge separate workstreams' progress estimates.

Do not claim a phase is complete because a design specification was written.

---

# 16. AUTONOMY AND ESCALATION

You are authorized to make ordinary, defensible design and engineering decisions consistent with approved product requirements.

Do not repeatedly request permission to:

- Research design references.
- Examine components.
- Run baseline screenshots.
- Investigate architecture.
- Explore art direction.
- Create isolated implementation branches.
- Build prototypes.
- Test design changes.
- Fix issues.
- Improve documentation.
- Preserve verified checkpoints.

Continue working until reaching a genuine approval gate, meaningful blocker, or session boundary.

Do not stop after drafting a plan.

At the same time, exercise professional judgment.

If a proposed change reduces usability, accessibility, performance, or product character, reject it.

When uncertain, inspect and experiment before escalating.

Only ask for clarification when the missing decision materially prevents safe progress.

Explicit user aesthetic acceptance remains mandatory for major redesign delivery.

---

# 17. PREVENT THE PREVIOUS FAILURE FROM RECURRING

Before presenting any design milestone, critically assess it.

Ask:

1. Is this a substantially better overall interface or merely polished existing CSS?
2. Does it feel like a carefully crafted product?
3. Is Lumen's identity stronger?
4. Are the composition and information hierarchy visibly improved?
5. Are the most frequently used interactions better?
6. Are both iOS and desktop receiving meaningful attention?
7. Do complex populated screens look excellent?
8. Are all important features still usable?
9. Did we introduce generic component patterns?
10. Would a discerning user notice and appreciate the improvement without being instructed where to look?
11. Have we directly compared full-size actual-app screenshots?
12. Would this design stand up to close inspection next to the strongest reference applications?

If the result is merely a collection of small refinements, it fails the brief.

If the visual work looks generic or rushed, it fails the brief.

If the interface is prettier but less capable, it fails the brief.

If the implementation only looks good in a static screenshot, it is not finished.

If important workflows are missing, it is not finished.

If the user rejects the aesthetic, it has not passed acceptance regardless of technical test results.

Do not attempt to prove an underwhelming design is successful by describing subtle improvements in greater detail.

**Make the improvement evident in the product itself.**

---

# 18. REQUIRED REPORTING

At the beginning of the session, report concisely:

**PROJECT:** Lumen Design Renaissance / Lumen Adaptive Native  
**CURRENT DESIGN COMPLETION:** Verified percentage and confidence  
**CURRENT SOURCE:** Branch and exact commit  
**VISUAL ACCEPTANCE STATUS:** Approved, pending, or rejected  
**CURRENT PHASE:** Specific milestone  
**BASELINE:** Existing evidence and remaining gaps  
**NEXT ACTION:** Precise action being undertaken

Then continue execution immediately.

At each meaningful visual checkpoint, provide:

**WHAT CHANGED:** Specific, observable improvements  
**WHY IT IS BETTER:** Design reasoning and relevant references  
**iOS EVIDENCE:** Full-size before/after screenshots  
**DESKTOP EVIDENCE:** Full-size before/after screenshots  
**INTERACTION EVIDENCE:** Tested flows or recordings  
**FEATURE PARITY:** Preserved controls and any exceptions  
**VERIFICATION:** Actual tests and results  
**PREVIEW:** Verified safe preview URL, if available  
**PROGRESS:** Previous and current weighted completion  
**APPROVAL NEEDED:** Explicit aesthetic decision, if applicable  
**NEXT MILESTONE:** Exact remaining task

Include real artifacts, links, or screenshot files whenever available.

Do not give vague updates such as "the design is now more premium" without visual evidence.

---

# 19. FINAL EXECUTION DIRECTIVE

Start now.

Recover the project state and rejected-design history.

Research the strongest relevant interfaces and platform guidelines.

Develop a deliberate, original art direction.

Identify the largest opportunities to improve Lumen's actual screen compositions and interactions.

Build genuine, substantial iOS and desktop redesigns within the real application.

Make both versions feel like they belong on their respective platforms without losing their shared identity.

Push the design beyond generic visual conventions while maintaining usability, accessibility, performance, and complete feature functionality.

Test the implementation.

Inspect full-resolution screenshots.

Revise the weak elements.

Present convincing real-app before-and-after evidence.

Seek user aesthetic acceptance before merging substantial visual changes.

Continue through approved implementation, verification, and safe deployment milestones according to Project Continuum.

Preserve progress across every session and agent switch.

**Do not deliver another minor polish pass disguised as a redesign.**

**Do not prioritize the appearance of progress over the quality of the result.**

**Do not mistake technically working components for thoughtfully designed experiences.**

The final goal is an application that looks exceptional, feels refined, behaves naturally, remains powerful, and demonstrates care in its smallest meaningful details.

The standard is not whether an agent can explain the improvement.

**The standard is whether the user can immediately see and experience it.**

Deliver the strongest practical version of Lumen you can create.

**PROJECT CONTINUUM v2.0 REMAINS ACTIVE.**

**LUMEN DESIGN RENAISSANCE IS NOW THE GOVERNING VISUAL TRANSFORMATION DIRECTIVE.**