# Calm pass: Router and the phone Settings index

**Draft for owner review, on [PR #63](https://github.com/Seifonyx/Lumen/pull/63). Not merged or deployed.** The owner
asked (2026-10-30) to apply the cleanup proposal to these screens now and to take the rest of the app in a later
phase. Captures use the same synthetic profile as the Router checkpoint, with every non-local request blocked: no
inference, $0. "Before" is [`../switchboard-checkpoint/after/`](../switchboard-checkpoint/after/) and
[`../settings-checkpoint/after/`](../settings-checkpoint/after/); "after" is [`after/`](after/).

The rules themselves are in [DESIGN_FOUNDATION.md](../../brand/DESIGN_FOUNDATION.md#surfaces-depth-radii).

## What changed

| Screen | Before | After |
|---|---|---|
| Router sections | Six (Usage and Diagnostics apart); Diagnostics off-screen on phones | Five: **Activity** holds Usage, then Diagnostics. Links to Diagnostics open Activity at that part |
| Models | Bordered "next message" card, filter, ↗ Manage button, a card per model with a filled "Use model ↗" pill, and a search bar for one model | The current choice as plain text; the list; a text "Use"; a Lamplight "Selected" chip. Search appears past eight models. Manage lives in the Routing tab |
| Providers | "Not connected" on every row; outlined Refresh; "Uses your provider credits" | Name only for unconnected rows; "Needs attention" when listing failed; text Refresh; "Pay as you go" |
| A provider | Name, verdict and a long fact line; a tinted banner; the key in its own collapsible card with a pill; a full-width Save keys bar and a "Saved on this device…" line; an expanded Key safety card | Icon, name and one status line; the problem as one line with a red rule; the key field flat on the page, **Save key** appears once edited; Key safety (this provider only), facts and usage under **Advanced** |
| Routing | Three-line intro; browser dropdowns; two-to-three-line hints | One-line intro; priority as four segments; **Preferred provider** as a row; one-line hints |
| Settings (phone) | Two lines under Router and Privacy; a "Privacy & data" heading over its own row; ↗ on Router | One line per row (the second line stays for screen readers); no heading over a single row; one chevron |
| Everywhere above | Outlined cards; seven-ish type sizes; content up to 1,080 px wide; toasts over the phone title | Tone instead of outlines; 28/17/15/13; a 760 px column; toasts below the phone bar; the active section in Lamplight |

## Unchanged

Saving keys (still only the page's own provider), drafts surviving Back/Forward, routing behaviour, model eligibility,
what requests are made (Key safety now checks only the page's own provider's key instead of both), history and Exit,
the ordinary build's Settings, and every route into Router.

## Verification (agent-reported)

See the PR for the exact-head CI run. Locally on the Canvas build: the Router and phone-navigation suites in Chromium
and WebKit, CP04 and CP05 at 1440, 430, 390 and 320, QA01, CP01, unit tests and the budget (Canvas CSS 21.8 of 22 KB).
Not verified: a physical iPhone, VoiceOver and Dynamic Type.
