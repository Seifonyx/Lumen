# Blackout reference review — observed evidence

Checkpoint: **20 October 2026, Africa/Cairo**. Links are sources, not permission to redistribute their pixels or proof of live behavior. Machine retrieval timestamps in `REFERENCE_EVIDENCE.json` are explicitly UTC. Research was read-only; no 9Router executable, opaque downloader or real credentials were used.

## What was actually inspected

The original 36-URL inventory is preserved in [REFERENCE_MANIFEST.md](REFERENCE_MANIFEST.md). Fresh HTTPS retrieval obtained **14 genuine images; all 14 were visually opened**. The provider hero is repeated in the Leos image, so this is **13 distinct captures**, not 14 distinct interfaces. All **22 gallery CDN URLs returned HTTP 503**; the gallery HTML timed out after 25 seconds. Two additional images from a pinned official revision were retrieved and visually opened, bringing the inspected 9Router reference total to **16 image files**. Do not label the inaccessible gallery inspected.

Full external pixels remain outside Git at `/workspace/.lumen-verification/blackout-2026-10-20/references/`; links/hashes/dimensions/retrieval failures are committed in `REFERENCE_EVIDENCE.json`. Copyright and redistribution permission are not established. One public CLI screenshot contains credential-looking text: do not republish its pixels or transcribe credentials. No third-party screenshot is used as a Lumen design asset.

## Individual image observations

IDs below resolve to the full exact URLs and hashes in the evidence file and manifest. Visible versions are the versions shown in the captures, not today's running 9Router release.

| Image ID / visible version | Actual visible structure | Useful Lumen principle | What not to infer or copy |
|---|---|---|---|
| official_overview / 0.3.40 | Persistent rail; Providers workspace; OAuth/free/API groups; four-column connection cards; counts and Test All | Scan connection availability separately from model selection | Card grid, orange brand, backend capabilities or security guarantees |
| providers_tothost / 0.4.66 | Grouped providers and custom-provider section; compact connection status | Clear grouped states and ownership | Routing grid decoration or marketing availability |
| provider_detail_tothost / 0.4.66 | OpenCode Free detail; zero connections; no-auth/proxy selection; model rows and add/test/copy/remove | A selected provider deserves an inspectable model list | Broad permission to proxy, evade provider restrictions or copy auth methods |
| combos_list_tothost / 0.4.66 | Combo rows; assigned model chips; +5 more; round-robin toggle; copy/edit/delete | Show a Layout's policy beside its membership | Claim every algorithm is equivalent to Lumen Auto |
| combos_editor_tothost / 0.4.66 | Create Combo form; four ordered models; drag and up/down/remove; clear create/cancel | Visible fallback order and a non-drag reorder alternative | An unnecessarily large modal or automatic fallback outside user policy |
| endpoint_tothost / 0.4.66 | Local endpoint/tunnel/Tailscale; password warning; RTK/Caveman controls | Explain trust boundaries and opt-ins near controls | Compression-savings promises or browser-only gateway equivalence |
| providers_leos / same hero composition | Reduced-resolution copy of the official provider page | Corroborates composition only | Count as a new unique screen |
| usage_medium / 0.4.71 | Request/input/output/estimated-cost counters; period filter; provider chart; recent request rows | Label estimates and time windows honestly | Actual billed cost, quality, quota accuracy or SLA |
| endpoint_xuanyuan / 0.4.55 | Large grouped endpoint/token-saver/API-key sections | Group by user task and progressively disclose advanced setup | Port the entire server settings surface into chat |
| endpoint_idcloudhost / 0.4.6 | Older endpoint dashboard in a browser; insecure HTTP shown | Separate setup from day-to-day work | Reuse insecure transport/security defaults |
| combos_viblo / 0.4.18 | Light-theme grouped combo rows, white planes, orange grid motif | Information hierarchy can survive a theme change | Copy the orange/grid identity |
| endpoint_csdn / 0.4.41 | Chinese endpoint/token-saver/API-key interface; empty API-key area | Empty state should explain the next legitimate action | Infer current localization completeness or endpoint security |
| cli_csdn / 0.4.41 | Claude Code mappings, base URL and credential-looking field values | Connection setup must explain destination and scope | Republish pixels/values, expose secrets, claim browser can edit arbitrary local CLI config |
| login_wpgan / version not established | Login card with default-password warning; insecure HTTP | Make authentication ownership explicit | Adopt default-password or insecure deployment methods |
| official_fusion / pinned source | Two combo rows; explicit Fusion panel/judge versus ordered fallback modes; model and judge chips | Distinguish comparison/synthesis from fallback, show the decision role | Claim image proves orchestration correctness or authorized model access |
| official_saml / pinned source | SAML sign-in card; single SSO action | A focused enterprise sign-in entry point can be clear | Add SAML infrastructure or credentials without an approved need |

Pinned official additions:
- [Fusion combo image](https://raw.githubusercontent.com/decolua/9router/87a74e1bda3677193c6f71a7e2100c90311f0689/images/fusion-combo-ui.png)
- [SAML image](https://raw.githubusercontent.com/decolua/9router/87a74e1bda3677193c6f71a7e2100c90311f0689/docs/images/saml-login-screen.png)

**Coverage gap:** current-version mobile/tablet, dedicated quota/reset and detailed single-request screens were not visually recovered. Source-backed quota/history contracts are examined in [FEATURE_MATRIX.md](FEATURE_MATRIX.md); source inspection does not replace unavailable screenshot evidence. Further gallery retries are not required every session; use a new reliable source when available and retain the gap until resolved.

## Independent current functionality research

[FEATURE_MATRIX.md](FEATURE_MATRIX.md) records **38 stable capability IDs**, native alternatives, architectural/security decisions, effort, priorities and acceptance tests, grounded in **20 pinned primary sources**. Inspected source commit: `87a74e1bda3677193c6f71a7e2100c90311f0689`, package **0.5.104**, dated 15 October 2026. Latest public release observed: **v0.5.35**, 16 July 2026. Screenshots above are mostly older 0.3/0.4 releases; older architecture prose describes JSON files while current source uses SQLite compatibility shims. These are separate evidence generations. Marketing claims such as “lossless,” “zero downtime,” or percentage savings are not verified measurements.

Lumen currently has **32 configured AI providers** (four core, 28 additional); a count does not establish equivalent subscription/model availability. The highest-value native candidates are provider readiness/freshness, bounded redacted route receipts, credential-free Layout recipes and honest usage provenance. No selected identity automatically authorizes a gateway, token vault, unsupported OAuth, new paid service, arbitrary proxy or prompt logging.

## Other primary design references

| Product / source | Evidence actually examined | Adopt as a principle | Avoid |
|---|---|---|---|
| [Linear](https://linear.app/) | Official homepage HTML/content, including embedded issue/triage/planning examples; fetched 200. Two hero assets proved to be decorative frame/glow, and another was an avatar. `/docs/issues` returned 404. **No actual running Linear workspace screenshot was reviewed.** | Compact secondary navigation, task-specific metadata hierarchy, progressive disclosure of complex work | Calling decorative artwork UI proof, cloning its exact sidebar or assuming advertised AI claims |
| [Raycast](https://www.raycast.com/) | Official homepage plus actual Quick Links command-result screenshot: search “scratch”, section label, Figma/Framer result rows, selected-row background and muted destination. An initial Linear-extension card was decorative and excluded. | One strong search entry, clear selection versus hover, efficient keyboard hierarchy | Making Lumen chat into a command launcher or copying the mark |
| [Apple layout HIG](https://developer.apple.com/design/human-interface-guidelines/layout) | Official layout/material pages and readable official tutorial-data JSON, both fetched 200 | Stable content/control layers, aligned semantic groups, safe areas, responsive readable measure and Dynamic Type | Blanket glass across reading content or claiming Linux WebKit proves physical iPhone behavior |
| [Apple materials HIG](https://developer.apple.com/design/human-interface-guidelines/materials) | Official `layout.json` / `materials.json` text inspected | Materials for important controls/navigation; contrast, reduced transparency and content remain primary | Fake blur/refraction metrics, blur as a substitute for visual hierarchy |
| [Things](https://culturedcode.com/things/) | Official homepage and real Mac/iPhone/iPad/Watch product screenshot collage | Same recognizable content hierarchy adapted to each platform; precise spacing, restrained semantic signals | Copying task/checkbox identity into an AI workspace |

[Raycast Quick Links screenshot](https://www.raycast.com/_next/image?url=%2F_next%2Fstatic%2Fimmutable%2Fmedia%2Fquicklinks-showcase.1-5j8fsgp_l5i.png&w=1200&q=70). [Things collage](https://culturedcode.com/things/2024-01-20/images/whatsnew-collage-io60.png). Apple official data: `https://developer.apple.com/tutorials/data/design/human-interface-guidelines/layout.json` and the sibling `materials.json`. No screenshot ownership/redistribution right is inferred.

## Design consequence

Keep conversation and the user's work primary. Make model/provider policy inspectable without turning the workspace into a gateway dashboard. Monochrome character must come from original form, typography, proportion, controls and purposeful motion, with status/focus color retained where meaning or accessibility needs it. Test direction against populated chat, Library, keys and real overlays rather than an empty greeting alone. The actual candidate evidence and limitations are in [IDENTITY_RESEARCH.md](IDENTITY_RESEARCH.md).
