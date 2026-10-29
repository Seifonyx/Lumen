# Phase 5 Slice 2 — Tools experience (Canvas presentation)

Branch `feat/phase5-tools-experience` from released main `2df3d60af43e4ed6686b501803e6662ba592b80f`. The owner approved the direction after the 390px iPhone Light checkpoint (2026-10-29) and asked for expansion without further routine approval pauses. Merge, deployment and the next slice remain owner decisions.

## Baseline shortcomings (main `2df3d60`)

- iPhone: one ~2,500px flat list of 16 identical rows; a collapsed "Browse capabilities" disclosure was the only navigation.
- Readiness was hard to read: key state was a 12px grey line under search; only missing keys appeared on rows, in orange.
- Web search was an on/off setting presented as a launch row with an "Off" label.
- Writing tools looked like the other rows but did nothing when pressed.
- No row said where it takes you (new chat, a sheet over this chat, Study, chat search, the analysis runner).
- Built-in and custom assistants looked alike; each row's accessible name was its whole text.
- Desktop: uniform two-column cards with a separate scroll-spy rail.

## Information architecture

One workspace, filtered rather than scrolled:

1. **Search** across every tool and assistant.
2. **Area filter** — All · Research · Create · Analyze · Learn · Assistants, each with its count. The choice is screen memory, so Back/Forward restore it. On phones it is a scrolling pill row; on desktop it is a quiet sticky list in a left column.
3. **Tool readiness** — each key the tools depend on, stated in words ("Ready · powers 5 tools" / "Not set up · needed for Create an image") with one **Set up** action that opens Settings → Keys. It is shown under All; on phones it hides while an area or search narrows the list.
4. **Grouped lists** per area. Every row: icon, name, one-line purpose, and a meta line with any missing key ("Needs Cloudflare key") and where it lands. Ready tools carry no badge, so only exceptions draw attention.
5. **Row kinds** are distinct: launch rows end in a chevron; Web search is a real `role="switch"`; Writing tools is a non-interactive row tagged "In replies".
6. **Assistants** split into *Yours* (with a New assistant row and Edit) and *From Lumen* (Customize makes your own copy). Edit/Customize is a separate 52px target.
7. **Empty search** explains the scope and offers "Search all areas" and "Clear search".

The language follows the approved sidebar: ink on paper, hairline rims, restrained counts, no colour-only state, no hue-per-category.

## Preserved behaviour

Launch, toggle and editor actions are ToolsPage's existing closures, wrapped in the same `navigateScreen` history step as before. No tool, provider, key, assistant or storage semantics changed. Whole-feature Exit, drafts and account scoping are unchanged. The ordinary presentation keeps its existing page; the workspace is lazily loaded through `canvas-presentation` and is excluded from the ordinary graph by the isolation audits.

## Known limitations

- Study partner appears under Learn and under Assistants → From Lumen, as before.
- Physical iPhone, VoiceOver, Dynamic Type and edge-swipe on real Safari are not verified; WebKit and Chromium runs are synthetic.
