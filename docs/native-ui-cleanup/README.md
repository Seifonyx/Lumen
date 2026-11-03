# Canvas copy and density review

These are actual loopback Canvas renders from baseline `f3b2f00` and application commit `c6712b7`. Desktop captures use Chromium. Phone captures use WebKit with synthetic accounts and iPhone viewport settings. External traffic was blocked except synthetic fixture responses. No production accounts, API keys or inference were used.

| Surface | Before | After | Change |
| --- | --- | --- | --- |
| Routing, desktop Light | [Before](before/1440-light-router.png) | [After](after/1440-light-router.png) | Preferences start beneath the section rail. The desktop header supplies the title once, and the context column retains eligibility, recovery and recorded evidence. |
| Knowledge, desktop Light | [Before](before/1440-light-knowledge.png) | [After](after/1440-light-knowledge.png) | Import sits beside a plain empty state. File limits, device-only storage and the indexing disclosure remain visible. |
| Library, 390 px Dark | [Before](before/390-dark-library.png) | [After](after/390-dark-library.png) | A single empty-state label and the existing Add control replace an explanation and a second link to Knowledge. |
| Projects, 390 px Dark | [Before](before/390-dark-all-projects.png) | [After](after/390-dark-all-projects.png) | The empty state presents one creation action. Populated phone lists use the top-bar action. |
| General settings, 390 px Dark | [Before](before/390-dark-settings.png) | [After](after/390-dark-settings.png) | The account and appearance controls move up after the intro and its container disappear. |
| Browse all tools, 320 px Light | [Before](before/320-light-tools.png) | [After](after/320-light-tools.png) | The Create group loses its slogan and the image row leads with its key requirement. Search and specialized tool descriptions remain available. |

The model picker omits duplicate fallback names while retaining model metadata and unavailable states. Router keeps its five destinations, current-chat context, provider consent and status facts. Activity keeps unknown-limit and source guidance in Quotas, alongside the counters and exports it qualifies. Layouts, Study, assistant browsing and document Canvas use shorter empty and entry states. Project instructions, destructive confirmations, AI and privacy notices, indexing consent and provider recovery guidance remain available where users act on them.

The comparison captures cover 1440, 390 and 320 px with no horizontal page overflow or page errors on the captured states. Browser contracts exercise interaction and accessibility beyond these screenshots. Physical iPhone Safari, VoiceOver, keyboard and PWA behavior require device verification.

The subsequent accessibility follow-up gives the empty Library scroll region a visible keyboard focus target. The landscape accessibility scan and single Projects creation action both pass focused regressions.
