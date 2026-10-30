# From correct to premium: the design changes after the 33 fixes

The 33 fixes make Lumen consistent. They don't make it beautiful. This list is what a design team would change to give
Lumen a distinct, premium look while keeping its identity (the Crease mark, ink and paper, Lamplight, Geist). Items
marked **Owner decision** change something you approved earlier.

## A. Identity and colour

1. **Warm the paper. (Owner decision)** Light paper is a cool gray (#f6f7f9) with pure white cards: the default
   look of a thousand dashboards. Move to a faintly warm paper (around #f7f6f3), warm off-white surfaces and a warm
   near-black ink. It's the one change that most makes it feel crafted rather than generated, and it ties the whole UI
   to the Lamplight idea.
2. **A real Dark palette.** Dark is blue-black (#0c0e11) with one surface step. Use a neutral-warm charcoal and three
   surface levels (page, card, raised), each a little lighter, so depth reads in Dark without borders.
3. **One accent. (Owner decision)** The new-chat moon is lime; the selection and highlight are Lamplight gold. Two
   accents fight. Make the moon Lamplight (or make Lamplight the only accent everywhere) so the brand has one colour.
4. **Lamplight as light, not paint.** Use it as a soft glow rather than flat fills: a faint radial light behind the
   new-chat greeting, the focus ring on the composer, the "you are here" mark. Never on buttons or body text.
5. **Status colours tuned to the palette.** Today's green, amber and red are generic. Pick a softer, warmer set at
   matched lightness, checked for contrast in both themes.

## B. Typography

6. **A real type scale with optical tuning.** Display 32/28/22 with tighter tracking (−0.03 to −0.02 em), titles 17,
   body 15/16, secondary 13, caption 12; line heights tuned per size. Today sizes are right but headings feel heavy and
   flat.
7. **Answer typography as the hero.** Replies are what people read most. Increase the measure's polish: 17 px body on
   desktop, generous paragraph spacing, refined heading hierarchy (h2 20, h3 17), proper list indentation and bullets,
   styled block quotes, and tabular figures in tables.
8. **Numbers that look designed.** Tabular, slightly lighter weight for large figures in Activity and Quotas, with
   units in the secondary colour.
9. **Mono only for code.** Model ids and code only; everything else Geist.

## C. Depth, materials and shape

10. **Elevation tokens.** Three levels (flat, raised, floating) with soft, layered shadows (a tight 1 px contact
    shadow plus a wide, low-opacity ambient one). Cards are raised, the composer and sheets float. Today everything is
    the same flat plane.
11. **Glass where things float.** The phone top bar, the composer and the bottom search bars get a translucent
    material with background blur, so content scrolls visibly under them (the iOS feel).
12. **One radius family.** 8 (chips), 12 (rows, fields), 16 (cards), 24 (sheets, composer), full (pills), applied
    everywhere, with concentric radii for nested shapes.
13. **Hairlines that disappear.** Dividers at about 6 % ink, inset from the left edge to the text, never full width.

## D. Layout and composition

14. **A page header component.** Every destination gets the same header: large title, one-line subtitle, actions
    on the right, collapsing to the compact bar on scroll (iOS large-title behaviour).
15. **Desktop that uses the space.** Settings and Router get a two-pane layout on wide screens (list on the left,
    detail on the right); Library becomes a grid of document cards with previews; the chat column widens a little on
    large screens. Today desktop is a narrow column in a sea of gray.
16. **An 8-point rhythm.** Spacing only in 4/8/12/16/24/32/48, with section gaps a step larger than row gaps, so every
    screen has the same breathing.
17. **Comfortable rows.** 56 px list rows with 40 px leading icons in tinted tiles, a two-line maximum, and a trailing
    affordance aligned on one vertical line across the app.

## E. The chat experience

18. **A designed new-chat screen.** Greeting with the light motif, three to four starter cards (from your prompts and
    recent work), recent chats as a quiet list underneath, and the composer centred.
19. **Composer as the signature object.** Floating card with the glass material, a Lamplight focus glow, a smooth
    height animation as it grows, attachment chips with thumbnails, and a send button that morphs into Stop while a
    reply streams.
20. **Streaming that feels alive.** A soft cursor and a gentle fade-in for new text, a "thinking" shimmer before the
    first words, and a "Jump to latest" pill when you've scrolled up.
21. **Code blocks worth looking at.** A custom syntax theme in the palette, language label, copy button with
    confirmation, line wrap toggle, and a matching Dark theme.
22. **Citations and sources as chips** with site icons, opening a side preview, instead of plain links.
23. **Message actions on hover (desktop) and long-press (phone)** with a compact pill toolbar, not always-visible rows.

## F. Motion and interaction

24. **A motion system.** Two durations (fast 160 ms, standard 280 ms) and one spring for sheets; screens push and pop
    on phones, cross-fade on desktop; respects reduced motion.
25. **Micro-interactions.** Press states that scale to 98 %, switches that spring, list items that settle in with a
    small stagger, numbers that count up in Activity, a checkmark draw on save.
26. **Skeletons, not spinners.** Shaped placeholders with a slow shimmer for lists, models and Activity.
27. **Haptics paired with motion** on send, toggle, delete and pull-to-refresh (already partly there).

## G. Imagery and empty states

28. **A spot-illustration set in the Crease style.** Line drawings with a single Lamplight highlight for every empty
    state (no chats, no files, no tasks, no decks, offline, error), replacing icon tiles and faint preview boxes.
29. **Provider marks in tinted tiles** with consistent optical size, and a subtle colour version on hover/selection.
30. **Document previews.** Library items show a first-page thumbnail (Markdown rendered, PDF first page, image crop)
    instead of a generic file icon.

## H. Components to redesign once, use everywhere

31. **Buttons:** primary (ink), secondary (fill), quiet (text), destructive (red text, red fill in confirmations), in
    three sizes, with consistent icon spacing and loading states.
32. **Fields:** one field with label above, helper below, error state, character count, and a focus glow.
33. **Segmented controls, tabs and chips:** one segmented control (sliding thumb), one tab bar (underline on
    desktop, pills on phone), one chip.
34. **Sheets and dialogs:** grabber, large title, sticky footer actions, swipe to dismiss, consistent widths (480 /
    640 / full).
35. **Menus and popovers:** one menu with icons, section dividers, keyboard hints, and smart positioning that never
    leaves the screen.
36. **Toasts:** a compact pill with icon and one action, stacking from the bottom on desktop and under the bar on
    phones.

## I. Data screens (Activity, Quotas, usage)

37. **Charts with craft:** rounded bars with a subtle gradient, hover/tap tooltips, light gridlines, axis labels,
    and an animated draw-in.
38. **Quota meters as rings or thick rounded bars** with the threshold tick and a colour shift as they fill.

## J. First impressions

39. **Sign-in with presence:** the mark large with its Lamplight glow, a one-line promise, and a soft product preview
    behind it on desktop.
40. **First-run onboarding:** three short screens (what Lumen is, get a free key, pick your first model) instead of
    landing on a provider page.
41. **App icon, splash and favicon refreshed** to the warmed palette (generated by the existing brand script).

## K. Quality bar (how we know it's premium)

- Side-by-side review against two reference apps you like, screen by screen.
- A visual regression set of every screen at four widths, two themes, checked by eye before release.
- Real-device pass on iPhone (VoiceOver, Dynamic Type, keyboard) and a mid-range Android.

## Suggested order

1. Foundation (A1–A5, B6, C10–C13, D16): palette, type, elevation, radii, spacing tokens. Everything else builds on it.
2. Components (H31–H36, F24–F26).
3. Chat (E18–E23).
4. Destinations (D14–D15, D17, G28–G30, I37–I38).
5. First impressions (J39–J41).

Steps 1 and 2 need one owner checkpoint (a few screens rendered in the new palette and type) before rolling out.
