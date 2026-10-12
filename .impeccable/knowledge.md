# Knowledge in Library

Operate surface, extending the existing Library and theme tokens. Users import PDF/text references, search across them, inspect physical PDF pages and add reviewed sources to a chat draft. Keep documents and vectors local to the signed-in account. Explicit semantic indexing sends extracted text to Google through the existing privacy controls; quota failures preserve progress. No new main-chat toolbar or welcome cards.

## Direction contract

THESIS: A searchable reading shelf with source evidence adjacent to each result.

OWN-WORLD: Inherit Geist, existing surfaces, text colors, compact buttons, borders and three appearances. Use document rows rather than another card grid.

STORY: Import locally, search immediately, optionally index meaning, inspect a page, then prepare a chat draft.

FIRST VIEWPORT: Library tabs above one question field and search action; a compact import action and document rows follow. Results identify document and page, excerpt, and source action. On phones controls wrap naturally and navigation scrolls horizontally.

FORM: Ordinary Library extension; existing surface structure, no new visual identity or generated raster assets.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Finish record — 2026-10-12

Disposition: **ship** after two material review fixes: `AssistantLibrary.tsx` uses a layout effect to scroll the selected tab into view on selection and initial opening; `design.css` keeps **View source** underlined at rest, making the source action discoverable without hover.

Incumbent-system evidence: `PRODUCT.md` authorizes a compact extension of the existing light, dark and true-black appearances. `src/design.css`, `KnowledgeLibrary.tsx`, `KnowledgeSourceView.tsx` and `AssistantLibrary.tsx` preserve the Library modal, theme variables, inherited Geist typography, compact buttons and restrained borders. The supplied `tests/e2e/out/knowledge-1280.png`, `knowledge-390.png`, `knowledge-390-black.png` and `knowledge-source-390-light.png` show that inherited presentation and the source-reading flow. The persistent underline is evidenced by the final CSS; earlier phone captures do not establish that treatment.

Surface conventions: reuse `--bg`, `--surface`, `--text`, `--text-2`, `--border` and `--accent`; keep document and result rows separated by borders rather than promoting this shelf into a card grid. Titles wrap, passage excerpts use readable body text, and source pages retain whitespace in a scrollable reading surface. At the existing 600px phone breakpoint, question controls and document actions wrap, Library tab icons disappear and the tab strip scrolls horizontally with the active tab visible. These are inherited or surface-local rules, not a new global visual system.

Verification supplied by the implementation/review pass: seven Knowledge workflows passed at 1280px and 390px in light/dark/black plus 320px light; privacy and key-change cancellation passed. Earlier automated accessibility coverage passed across 150 views. This documentation pass inspected source and the four supplied captures; it ran no additional tests or browser sessions. Physical devices, assistive technology and live provider keys were not tested.

Documentation boundary: this is an ordinary Library extension with no approved global system change. `DESIGN.md` and `.impeccable/design.json` were absent beforehand; that pre-existing documentation gap is recorded without repair. The earlier FINISH sentence is scoped here to this finish record and reviewer disposition; it does not authorize creating a replacement design world. No generated or shipping raster assets were introduced, so raster provenance work is unnecessary; review screenshots are evidence, not product assets. Global design files remain untouched, and no unrelated incumbent defect is canonized as a rule.
