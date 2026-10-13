# Workspace redesign

Mode: Operate. Task 2 only; retain the full product and explicit external-action controls. User pinned ChatGPT/Claude as the professional reference and authorized the redesign, phone audit, tests and deployment.

## Direction contract

THESIS: A conversation workspace with a clear writing column and a separate, useful project context. Replace repetitive boxes, uppercase noise and duplicate settings with predictable navigation.

OWN-WORLD: Geist throughout; neutral white, charcoal and true-black appearances. Tonal sidebar, crisp text, subtle separators, restrained green for meaning. Generous main spacing, compact supporting navigation, 12–16px panels.

STORY: Pick a project, see its purpose and recent conversations, start writing. Files and instructions remain adjacent on desktop and in an expandable context section on phone. Settings stay easy to scan.

FIRST VIEWPORT: Desktop has 260px navigation, a generous project heading and composer, and a 300px context column. Phone has one writing column, wrapping header actions and a context disclosure; no tiny side column. Conversation titles are real keyboard-accessible controls.

FORM: User-pinned category reference takes precedence. Concept launcher could not install its engine in the restricted cache; no seed or generated comp exists. Code-native layout builds on existing components; no raster assets ship. Signature interaction is the phone context disclosure; existing swipe navigation keeps its native gesture grammar. Reduced motion remains supported.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Finish record

Fresh independent review: **ship**, subject to regression verification. Initial findings were narrow chat-header allocation and project-editor controls constrained to 58%; both were fixed and scored resolved using 320/390px Chromium/WebKit recaptures. Reviewer also sampled populated project lists, Models/Privacy settings, Knowledge, Canvas and repository views without further material findings. This is a sample visual review plus a verdict on two fixes, not physical-device certification.

Evidence: `.impeccable/review/{chromium,webkit}-{width}-{theme}-{state}.png`; 1280×844 light, 320×740 light, 390×844 dark, 430×932 black, 844×390 dark. Full-app samples are `full-{width}-{theme}-{surface}.png`. Captures are development-only and ignored by Git. `workspace-design.cjs` verifies creation, files/instructions, normal and direct project chat starts, keyboard reopening, model-label/color containment, overflow and accessibility. Existing accessibility suite verifies 150 scans across three appearances and desktop/phone.

Documentation completed by a fresh documenter: token-bearing `DESIGN.md` and `.impeccable/design.json`. Final presentation imports are styles → design → feature-surfaces → workspace. The feature stylesheet preserves secondary surface layouts after a concurrent base stylesheet revert on main. No generated/shipping raster assets or detector output. Browser-engine fixtures use synthetic data and mocked AI; physical iPhone and assistive-technology checks remain outside this evidence. Task 3 is excluded.
