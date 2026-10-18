# MASTER DIRECTIVE — Build the Ultimate Dynamic AI Model Picker and Routing System

## Mission

Perform a complete architectural audit, implementation, integration, optimization, and production validation of my AI router application's entire Model Picker ecosystem.

My application is a dynamic AI router. Users can connect providers, add and replace API keys, configure custom endpoints, add new models, build custom model layouts, choose models manually, use Auto routing, and reroute between compatible models.

**The objective is to deliver the strongest practically achievable, production-grade Model Picker, with every major subsystem operating at the highest defensible engineering standard.**

This must be actual implementation, not merely an audit, proposal, prototype, or collection of cosmetic improvements.

Every major subsystem has equal importance:

1. Dynamic model discovery and registration.
2. Automatic model refreshing and synchronization.
3. Unified model registry and capability intelligence.
4. Auto model selection.
5. Custom Layout Building.
6. Universal intelligent rerouting.
7. Manual model selection.
8. Multi-model execution and orchestration.
9. Model Picker UI, UX, and responsiveness.
10. Security, reliability, performance, cost efficiency, and extensibility.

Do not perfect one mode while leaving another incomplete.

Preserve existing product functionality and intentional user controls.

Inspect the actual repository before deciding how to implement these requirements. Adapt implementation details to the existing architecture while preserving the intended product capabilities.

## 1. Complete Codebase Audit

Examine every relevant frontend component, backend service, provider integration, API endpoint, hook, state store, database model, configuration, utility, and test.

Trace the full lifecycle:

API key or provider configuration → Model discovery → Registry update → Capability validation → Picker synchronization → Model selection → Execution → Recovery/rerouting → Streaming → State persistence.

Identify:

- Architectural weaknesses.
- Duplicate or contradictory logic.
- Hardcoded model assumptions.
- Model registry inconsistencies.
- Stale metadata.
- Broken refresh behavior.
- Routing inaccuracies.
- Unsupported model selections.
- Layout configuration limitations.
- Rerouting failures.
- Race conditions.
- State synchronization problems.
- Streaming bugs.
- Provider incompatibilities.
- Security vulnerabilities.
- Performance bottlenecks.
- Missing tests.
- UI and accessibility weaknesses.

Fix root causes rather than symptoms.

Do not rewrite stable components without a clear architectural or practical benefit.

## 2. Fully Dynamic Model Discovery

The Model Picker must support a changing model ecosystem without requiring source-code edits or redeployment whenever an already-supported provider exposes new compatible models.

Automatically trigger the appropriate model discovery, validation, and synchronization workflow when a user:

- Adds an API key.
- Replaces an API key.
- Removes an API key.
- Connects or disconnects a provider.
- Changes provider settings.
- Adds or removes a custom model.
- Changes a custom endpoint.
- Changes model configuration.
- Gains or loses model permissions, when detectable.

For supported providers, discover accessible models through their actual APIs.

Normalize discovered models into a unified registry.

Detect new models, metadata changes, unavailable models, and relevant capability changes.

Automatically propagate model changes to all applicable selection surfaces without requiring a page refresh or application restart.

Never assume all providers expose the same model-list or capability endpoints.

For providers without discovery APIs, support appropriate user-supplied declarations and trusted metadata with clear uncertainty indicators.

## 3. Intelligent Automatic Refresh

Implement a complete refresh strategy using suitable combinations of:

- Immediate event-driven refresh after configuration changes.
- Refresh on relevant application lifecycle events.
- Refresh when cached model metadata expires.
- Periodic refresh while appropriate runtimes are active.
- Server-side scheduled refresh where infrastructure supports it.
- Refresh after model-not-found or relevant capability errors.
- Explicit manual refresh.
- Stale-while-revalidate where useful.
- Provider-specific refresh policies.

Use bounded retries, backoff, jitter, deduplication, and concurrency limits.

Avoid unnecessary polling, excessive network traffic, and provider rate-limit violations.

Never claim continuous background refresh in environments where the runtime cannot execute it.

Handle slow discovery, failed requests, changing credentials, concurrent refreshes, and out-of-order responses safely.

A response from an old credential configuration must never overwrite newer registry state.

## 4. Authoritative Model Registry

Create or improve a unified model registry that tracks, where reliably available:

- Provider and endpoint.
- Stable model identity.
- Display name.
- Credential/account scope.
- Model availability.
- Model version and lifecycle.
- Supported input/output modalities.
- Context limits.
- Output limits.
- Reasoning capabilities.
- Tool and function calling.
- Structured output.
- Streaming.
- Vision and audio capabilities.
- Pricing.
- Latency information.
- Compatibility constraints.
- Metadata provenance.
- Confidence or verification state.
- Last refresh attempt.
- Last successful refresh.
- Catalog freshness.

Separate model identity, capabilities, availability, and performance estimates.

Different providers or endpoints may expose models with identical names. Do not merge unrelated models.

Use a well-defined metadata precedence policy.

Distinguish verified capabilities from inferred, documented, or user-declared capabilities.

Never fabricate model specifications or benchmarks.

A model being listed by a provider does not prove it supports every operation.

Preserve last-known-good metadata appropriately during transient failures.

Handle removal, deprecation, permission changes, and unavailable models without corrupting existing layouts.

## 5. Unified Intelligent Model Picker

Build a consistent, reusable model-selection architecture serving:

- Auto.
- Manual selection.
- Custom layouts.
- Layout model slots.
- Layout rerouting.
- General fallback selection.
- Multi-model execution.
- Any other existing selection surface.

Every picker must consume appropriate shared model registry data and consistent capability rules.

Avoid disconnected model lists or independent hardcoded catalogs.

Implement excellent model search, filtering, grouping, descriptions, compatibility feedback, selection indicators, and state persistence.

Preserve context-specific controls instead of forcing every selection surface into an identical interface.

## 6. Best Possible Auto Routing

Make Auto intelligently select the strongest appropriate eligible model for each request.

Evaluate:

- Task type.
- User intent.
- Complexity.
- Required reasoning.
- Coding and debugging requirements.
- Mathematical requirements.
- Research and tool usage.
- Multimodal inputs.
- Context length.
- Quality expectations.
- User preferences.
- Latency.
- Cost.
- Reliability.
- Provider health.
- Actual model capabilities.

Separate strict eligibility filtering from candidate ranking.

Incompatible models must never be selected merely because they score highly.

Use efficient deterministic routing where sufficient.

Avoid unnecessary LLM-based classification for straightforward requests.

For difficult tasks, use more sophisticated decisions when justified.

Allow configurable preferences such as quality, speed, cost, and balanced routing.

Newly discovered models should become eligible automatically when their capabilities and applicable constraints permit it.

Do not assume unfamiliar models are better simply because they are newer.

Use evidence-driven ranking and maintain uncertainty where model performance is unknown.

## 7. Complete Custom Layout Builder

Improve every existing layout-building capability.

Where appropriate to the product architecture, support:

- Layout creation.
- Editing.
- Deletion.
- Duplication.
- Saving and loading.
- Templates and presets.
- Fixed model assignments.
- Dynamic model assignments.
- Auto-enabled slots.
- Specialized model roles.
- Multi-model layouts.
- Sequential execution.
- Parallel execution.
- Conditional execution.
- Stage dependencies.
- Model comparisons.
- Synthesis stages.
- Per-stage preferences.
- Fallback configuration.
- Validation.
- Persistence and migrations.

Every layout must use the shared model registry.

Newly discovered eligible models must become available to Layout Builder automatically.

Auto-enabled layout slots must have access to the same routing intelligence as standalone Auto.

Fixed assignments and explicit constraints must remain authoritative.

A new model appearing in the registry must not silently change a fixed layout's behavior.

When models disappear or become unavailable, show accurate compatibility information and appropriate recovery options.

Preserve existing saved layouts using tested migrations when required.

## 8. Universal Intelligent Rerouting

**Rerouting must be a first-class, shared capability across every applicable model execution path.**

This includes Auto, layouts, manual selection, multi-model workflows, tool calls, streaming, and future routing modes.

Implement one coherent recovery infrastructure with mode-specific policies.

### Failure detection and classification

Recognize and appropriately handle:

- Provider outages.
- Rate limits.
- Network failures.
- Timeouts.
- Model-not-found errors.
- Context-limit failures.
- Unsupported modalities.
- Missing capabilities.
- Authentication failures.
- Authorization failures.
- Quota exhaustion.
- Malformed responses.
- Structured-output failures.
- Tool-calling failures.
- Streaming interruptions.
- Cancellation.
- Terminal and non-retryable errors.

Determine when to retry the same model, refresh metadata, adjust safe request parameters, switch to an eligible alternative, recover an individual execution stage, or fail clearly.

Do not reroute blindly on every error.

### Intelligent fallback selection

When permitted, evaluate alternative candidates using:

- Required capabilities.
- Original task.
- Model role.
- Context compatibility.
- Provider health.
- Expected reliability.
- Quality.
- Latency.
- Cost.
- User constraints.
- Previous failures.
- Remaining retry budget.

Prevent infinite loops, repeated ineffective candidates, uncontrolled costs, and unsupported substitutions.

### Mode-specific guarantees

**Auto:** Reroute among eligible models according to Auto's configured policy.

**Custom layouts:** Reroute only within permitted layout candidates and fallback rules.

**Manual selection:** Keep the explicitly selected model unless an authorized fallback policy permits substitution.

**Multi-model workflows:** Recover failed stages where safe rather than automatically restarting successful work.

**Tool-dependent execution:** Preserve permissions, capabilities, and side-effect safety.

### Recovery engineering

Implement appropriate:

- Typed errors.
- Bounded retry budgets.
- Exponential backoff and jitter.
- Request deadlines.
- Provider-aware circuit breakers.
- Health-aware fallback filtering.
- Safe cancellation.
- Idempotency safeguards.
- Concurrency controls.
- Execution-state preservation.
- Safe streaming recovery.
- Protection against duplicate tool execution.
- Useful diagnostics.

Rerouting must integrate with model discovery without producing recursive refresh/retry loops.

## 9. Reliable Manual Model Selection

Manual selection must remain predictable and robust.

Improve model discovery, selection, switching, persistence, compatibility validation, availability indicators, and failure handling.

A user's explicit model selection must not be silently overridden by Auto.

Newly discovered models must become selectable when eligible without unexpectedly replacing an existing choice.

## 10. Advanced Multi-Model Orchestration

Improve the actual multi-model execution features of the application.

Where supported and useful, implement:

- Parallel execution.
- Sequential stages.
- Specialist roles.
- Conditional execution.
- Stage dependencies.
- Result aggregation.
- Model comparison.
- Final synthesis.
- Per-stage routing.
- Per-stage recovery.
- Partial-result handling.
- Context transfer.
- Cancellation.
- Resource limits.

Minimize unnecessary model calls.

Avoid forcing multi-model workflows on requests that need only one model.

Respect the original layout semantics and user configuration.

## 11. Streaming and State Reliability

Ensure that routing and rerouting remain correct during streaming.

Prevent:

- Duplicate output.
- Contradictory continuations.
- Orphaned requests.
- Broken cancellation.
- Repeated tool calls.
- Corrupted conversation history.
- Stale completion states.
- Loading indicators that never resolve.
- Race conditions between original and fallback execution.

Distinguish failures before user-visible streaming begins from failures occurring after partial output.

Never falsely present output from a replacement model as a seamless continuation when that cannot be guaranteed.

## 12. Outstanding UI and UX

Make the entire Model Picker intuitive, responsive, consistent, and accessible.

Improve:

- Opening and closing the picker.
- Navigating modes.
- Searching and filtering models.
- Configuring Auto.
- Creating and editing layouts.
- Assigning models.
- Configuring rerouting.
- Displaying active selections.
- Provider/API key workflows.
- Dynamic catalog updates.
- Loading and error feedback.
- Mobile responsiveness.
- Touch interaction.
- Keyboard interaction.
- Scroll containment.
- Focus management.
- Accessibility.
- Rendering efficiency.

Prevent flickering, unwanted scrolling, disappearing controls, unstable rendering, state resets, duplicate model entries, and stale lists.

Model catalog refreshes must not unnecessarily remount the interface or discard edits.

Preserve the application's established visual design unless changes are justified.

## 13. Security and Privacy

Treat credentials and provider connections as security-critical.

Protect API keys and other secrets.

Never expose or log raw credentials.

Scope discovery results and caches correctly to users, accounts, providers, endpoints, and relevant permissions.

Prevent cross-user information leakage.

Secure custom endpoint access and protect against SSRF in server-side network requests.

Respect tool permissions, provider privacy boundaries, and explicit user constraints.

Do not send private credentials to unauthorized discovery or benchmarking services.

## 14. Performance and Cost Optimization

Optimize:

- Model discovery latency.
- Refresh efficiency.
- Picker responsiveness.
- Routing overhead.
- Time to first response.
- Token usage.
- Provider request counts.
- Cache behavior.
- Memory consumption.
- Concurrent execution.
- Rerouting costs.
- Multi-model orchestration.
- UI rendering.

Avoid speculative optimizations that increase complexity without measurable benefit.

Establish baseline metrics where practical and verify improvements.

## 15. Extensibility and Future Compatibility

Build an architecture that adapts to changing model ecosystems.

Adding a newly released model from an already-supported discovery-capable provider should generally not require application source-code changes.

Adding a new provider should require only a clear, localized adapter implementation and relevant configuration rather than extensive routing rewrites.

Support future model capabilities, modalities, provider changes, and layout strategies through extensible contracts.

Do not promise automatic support for unknown provider protocols or capabilities that cannot be reliably discovered.

## 16. Comprehensive Testing

Implement and execute meaningful tests for:

- API key changes.
- Provider connection changes.
- Model discovery.
- Catalog reconciliation.
- Metadata updates.
- Model removal and deprecation.
- Cache expiration and invalidation.
- Out-of-order refresh responses.
- Simultaneous discovery.
- User/account isolation.
- Auto routing.
- Manual selection.
- Layout creation and persistence.
- Layout model eligibility.
- Dynamic layout updates.
- Universal rerouting.
- Provider failures.
- Retry exhaustion.
- Circuit breakers.
- Streaming failures.
- Cancellation.
- Duplicate side-effect protection.
- Multi-model execution.
- State synchronization.
- Mobile and desktop UI.
- Keyboard and scrolling.
- Security boundaries.
- Backward compatibility.
- Regression behavior.
- Performance.

Use deterministic provider mocks where possible and authorized real-provider tests where appropriate.

Never fabricate test results, benchmarks, or success claims.

## 17. Production Readiness

Before considering the overhaul complete:

- Review the full architecture.
- Verify all modes and major workflows.
- Run available tests, linting, type checking, and builds.
- Validate compatibility and migrations.
- Review credential handling and security.
- Evaluate performance and operational risks.
- Confirm routing and rerouting policies respect user constraints.
- Verify model discovery and automatic propagation.
- Fix introduced regressions.
- Document unavoidable limitations.

Create meaningful commits.

You have authorization to push verified changes to `main` after satisfying required repository checks and protections.

Do not force-push, bypass branch protections, overwrite unrelated changes, or push known-broken code to `main`.

## 18. Definition of Completion

The project is complete when:

- All required Model Picker modes are fully implemented and integrated.
- Model discovery and refresh behave correctly.
- Newly eligible models propagate automatically.
- Auto routing is capability-aware and efficient.
- Custom layouts are powerful and reliable.
- Universal rerouting works correctly across applicable execution paths.
- Manual selection preserves user intent.
- Multi-model execution is reliable and efficient.
- Streaming and state handling are safe.
- UI interactions are polished and stable.
- Security and performance requirements are addressed.
- All feasible, meaningful, identified deficiencies have been resolved or explicitly justified.
- Required tests and production validation succeed.
- Final code and documentation are synchronized.

Do not claim mathematical perfection or the impossibility of future improvements.

Instead, aim for an architecture that requires no foreseeable major foundational redesign under current product requirements and can evolve as providers and models change.

**Ultimate objective: Deliver the most complete, intelligent, dynamic, reliable, efficient, flexible, and production-ready AI Model Picker practically achievable within this application's architecture.**

Implement the complete system, not merely a subset of its features.

# MANDATORY EXECUTION PROTOCOL — Phases, Persistent Requirements, Checkpoints, GitHub Synchronization, and Cross-Agent Handoffs

Apply these instructions to the complete Model Picker overhaul described in the Master Directive.

This project must be executable across multiple sessions and AI coding agents, including Codex, Claude Code, and other compatible coding tools, without losing requirements, decisions, implementation progress, or verification history.

**This protocol is mandatory throughout the entire project.**

## 1. Persist the Complete Master Requirements

Before beginning substantial implementation, create these three repository-tracked files:

### `MASTER_REQUIREMENTS.md`

Save the complete original Master Directive from Prompt 1, preserving every substantive requirement, constraint, success criterion, and authorization.

Do not silently shorten, reinterpret, weaken, or discard the original requirements.

This file is the authoritative project specification.

If future improvements or clarifications are agreed upon, document them separately with clear change history rather than silently rewriting the original scope.

### `IMPLEMENTATION_PLAN.md`

Create a comprehensive phased implementation roadmap derived from `MASTER_REQUIREMENTS.md` and the actual codebase.

Include:

- All project phases.
- Detailed tasks.
- Dependencies.
- Acceptance criteria.
- Required tests.
- Risks.
- Current progress.
- Remaining work.
- Completion status.

Use stable task identifiers so future agents can reliably track work.

Map important master requirements to implementation tasks and verification criteria.

Ensure no major requirement is omitted.

### `AI_HANDOFF.md`

Create the authoritative operational handoff document.

It must contain:

- Overall project status.
- Current phase.
- Exact task currently being worked on.
- Completed tasks.
- In-progress tasks.
- Blocked tasks.
- Remaining tasks.
- Files changed.
- Architectural decisions.
- Tests executed and results.
- Known issues.
- Risks.
- Relevant commands.
- Branch information.
- Latest commit hash.
- Remote push status.
- Exact next action.
- Necessary context for another AI agent to continue.

All three files must be committed to the repository and remain accessible to future coding agents.

## 2. Divide Implementation into Resumable Phases

Organize the complete overhaul into practical phases based on the real repository architecture.

Suggested areas include:

- Initial audit and baseline verification.
- Dynamic model registry and provider discovery.
- Automatic refresh and synchronization.
- Unified model eligibility and capability intelligence.
- Auto routing improvements.
- Layout Builder improvements.
- Universal rerouting and recovery.
- Manual selection improvements.
- Multi-model orchestration.
- Streaming and state integrity.
- UI and accessibility.
- Security and performance optimization.
- Comprehensive regression testing.
- Final production validation.

These are suggested work areas, not permission to omit or downgrade any requirement.

Determine the best implementation order from actual dependencies.

Each phase must have explicit deliverables and objective completion criteria.

Make phases small enough to complete, verify, document, and checkpoint within realistic agent usage limits.

## 3. Continuous Handoff Updates

**Do not wait until the end of a session to update documentation.**

After every meaningful completed task, implementation milestone, architectural decision, test cycle, or phase:

1. Update `IMPLEMENTATION_PLAN.md`.
2. Update `AI_HANDOFF.md`.
3. Record actual completed work.
4. Record verification performed.
5. Document remaining work.
6. Identify the precise next task.
7. Commit the changes when the milestone is coherent and sufficiently verified.

Keep documentation consistent with the actual codebase.

Never mark a task complete merely because code was written.

Use clear statuses:

- Not started.
- In progress.
- Implemented but unverified.
- Verified.
- Blocked.
- Deferred with justification.

Do not hide failures, incomplete functionality, or unverified assumptions.

## 4. Cross-Agent Continuity

Assume the next coding agent has:

- No access to earlier chat conversations.
- No memory of previous implementation decisions.
- No knowledge of the project's history beyond the repository.
- Access only to the current repository, its documentation, Git history, and available development tools.

The documentation must allow that agent to continue accurately without rediscovering the entire project.

At the start of every session, the agent must:

1. Read `MASTER_REQUIREMENTS.md`.
2. Read `IMPLEMENTATION_PLAN.md`.
3. Read `AI_HANDOFF.md`.
4. Inspect Git status and recent commits.
5. Verify the documented state against actual source code.
6. Determine the next unfinished task.
7. Continue implementation without repeating completed work unnecessarily.

The source code and Git state are the authoritative evidence of what has actually been implemented.

If documentation conflicts with code, investigate and correct the inconsistency.

## 5. Usage-Limit and Interruption Management

Design execution around finite context windows, usage limits, and unexpected interruptions.

- Work through phases autonomously while capacity remains.
- Keep verified, recoverable checkpoints.
- Commit coherent milestones.
- Avoid large undocumented changes.
- Preserve partial progress when safely possible.
- Record incomplete or unverified work explicitly.
- Avoid starting a risky large refactor when a checkpoint cannot realistically be reached.
- Never assume a final handoff message will be possible before a hard session cutoff.

A future agent must be able to resume even if the previous agent stopped unexpectedly.

## 6. Mandatory GitHub Synchronization

Keep requirements, roadmap, handoff, and implementation code version-controlled.

After each coherent verified milestone:

- Review the diff.
- Run relevant checks.
- Update documentation.
- Commit the verified milestone.
- Push to the authorized branch when safe.
- Record the commit identifier and synchronization status.

For partially completed work, prefer a dedicated working branch when appropriate.

Push to `main` only when the change satisfies required validation and repository protections.

Do not force-push, bypass required checks, or overwrite unrelated changes.

If the agent cannot safely push, record the exact reason and identify which changes remain local.

**Important:** A Git commit does not by itself make progress available to another machine or agent. Verify that the relevant commits have actually reached the expected remote branch.

## 7. Mandatory Pre-Handoff Synchronization

Before an anticipated session end, model switch, usage-limit boundary, or handoff to another coding agent:

1. Update `AI_HANDOFF.md` with the exact current state.
2. Update `IMPLEMENTATION_PLAN.md`.
3. Confirm that `MASTER_REQUIREMENTS.md` remains intact and accounted for.
4. Run appropriate validation for completed milestones.
5. Commit all coherent, verified work.
6. Push those commits to the authorized remote branch when safe.
7. Record branch, commit hash, and verified push status.
8. Record all uncommitted, unverified, or unpushed changes.
9. Record known failures and blockers.
10. Record the exact next implementation task and relevant files.
11. Provide a concise summary suitable for the next agent.

If a hard cutoff prevents these steps, the next agent must inspect Git status, working-tree changes, and handoff documentation to recover safely.

## 8. Completion Must Be Evidence-Based

Never declare the overall project complete simply because the planned phases have been visited.

Require:

- All mandatory requirements mapped to implementation evidence.
- All relevant phases completed or explicitly justified.
- Appropriate automated tests passing.
- Production builds and applicable checks passing.
- Security and compatibility reviewed.
- Significant identified defects resolved.
- Handoff and requirements documents current.
- Final code successfully synchronized.
- Verified GitHub commit and push/merge status.

Any limitations must be accurately documented.

## 9. Continue Autonomously

Do not stop after planning the phases.

Begin implementing the actual Model Picker improvements immediately after establishing the initial documentation and reviewing repository dependencies.

Continue through as many complete, safely verifiable phases as possible within the current session.

Do not request approval for routine engineering decisions that are already authorized by the Master Directive.

Do not shorten project scope because of usage limits. Divide the remaining work into additional sessions instead.

## 10. Required End-of-Session Report

At the end of each session, report:

- Current phase.
- Tasks completed.
- Tasks verified.
- Tests run and results.
- Remaining work.
- Blockers.
- Current Git branch.
- Latest commit hash.
- Whether changes were successfully pushed.
- Exact next task.

## Final Instruction

**Treat `MASTER_REQUIREMENTS.md`, `IMPLEMENTATION_PLAN.md`, and `AI_HANDOFF.md` as essential project infrastructure.**

Keep them complete, accurate, synchronized, and committed throughout development.

The goal is to let any competent AI coding agent continue this extensive Model Picker project across any number of sessions without losing original requirements or repeating substantial completed work.

Begin by inspecting the repository, creating the three required documents, defining the implementation phases, and executing the first phase.

Continue automatically while safely possible.