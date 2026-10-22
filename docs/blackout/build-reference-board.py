#!/usr/bin/env python3
"""Build a sourced reference board; never execute downloaded software."""
from pathlib import Path
from html import escape
import json

root = Path(__file__).resolve().parent
evidence = json.loads((root / 'REFERENCE_EVIDENCE.json').read_text())
items = {x['id']: x for x in evidence['manifestImages'] + evidence['additionalPinnedImages']}
selected = {
    'official_overview': ('Shell and provider overview', 'Persistent navigation separates endpoint, providers, combinations and usage. Provider groups communicate connection state. Older 0.3.40 UI.'),
    'providers_tothost': ('Provider organization', 'Grouped inventory, custom connections and compact status; useful density without making chat a settings dashboard. 0.4.66.'),
    'provider_detail_tothost': ('Provider detail and model inventory', 'A selected provider exposes its model list and actions. No proof of authentication safety or actual provider capacity. 0.4.66.'),
    'combos_list_tothost': ('Combinations and routing policies', 'Membership, ordering mode and overflow count are visible before editing. Adapt this to Lumen Layouts, not a duplicate abstraction. 0.4.66.'),
    'combos_editor_tothost': ('Ordered fallback editing', 'A concrete ordered list with up/down alternatives to drag. Preserve Lumen permissions and manual/fixed choices. 0.4.66.'),
    'official_fusion': ('Fallback versus panel/judge', 'Pinned official image distinguishes fusion/judge from ordered fallback. Image alone does not validate the algorithms.'),
    'usage_medium': ('Usage and request history', 'Period selection, counters, graph and request rows. Cost is labelled estimated; do not invent balances or savings. 0.4.71.'),
    'endpoint_tothost': ('Endpoint and efficiency settings', 'Gateway, tunnels and compression controls belong to a different trust architecture. Useful grouping; not browser Lumen capability. 0.4.66.'),
    'combos_viblo': ('Light-theme continuity', 'Grouped rows retain hierarchy in a light theme. Do not copy orange branding or decorative grids. 0.4.18.'),
    'official_saml': ('Account entry point', 'Focused SAML entry; adding enterprise identity infrastructure is a separate approved decision.'),
}
cards = []
for key, (title, note) in selected.items():
    x = items[key]
    cards.append(f'''<article><h2>{escape(title)}</h2><a href="{escape(x['url'],quote=True)}" target="_blank" rel="noopener"><img src="/reference-assets/{key}.image" alt="Actual 9Router: {escape(title,quote=True)}"></a><p>{escape(note)}</p><a class="source" href="{escape(x['url'],quote=True)}" target="_blank" rel="noopener">Original screenshot source ↗</a><code>SHA-256 {escape(x['sha256'])}</code></article>''')
html = '''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>9Router — verified visual reference board</title><style>*{box-sizing:border-box}body{margin:0;background:#111;color:#f5f5f5;font:15px/1.6 system-ui,sans-serif}main{max-width:1400px;margin:auto;padding:35px}h1{font-size:38px;letter-spacing:-1px;line-height:1.1}h2{font-size:20px}p{color:#ccc;max-width:85ch}a{color:#eee;text-underline-offset:4px}a:focus-visible{outline:3px solid #a6caff;outline-offset:4px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:26px}article{background:#1a1a1c;border:1px solid #444;border-radius:12px;padding:22px}img{display:block;width:100%;height:360px;object-fit:contain;background:#080808;margin:18px 0}code{display:block;overflow-wrap:anywhere;color:#aaa;font-size:10px;margin-top:15px}.source{font-size:12px}.notice{padding:18px;border:1px solid #555;margin:25px 0;font-size:13px}@media(max-width:800px){main{padding:22px}.grid{grid-template-columns:1fr}img{height:auto;max-height:500px}}</style></head><body><main><h1>9Router, examined.</h1><p>Actual retrieved and visually inspected application screenshots. Primary product reference for Lumen Blackout's provider, routing and management architecture. Sources, versions and gaps remain explicit. Checkpoint: 20 October 2026, Africa/Cairo.</p><div class="notice">16 image files were inspected (one repeated hero). This board selects ten relevant views. All 22 gallery CDN entries returned 503; dedicated quota/reset, detailed request and current mobile screens remain unavailable. The public CLI image is deliberately omitted because it contains credential-looking text. Screenshots establish visible structure, not working integrations or performance.</div><div class="grid">''' + ''.join(cards) + '''</div><p>Source version inspected separately: 87a74e1bda3677193c6f71a7e2100c90311f0689, package 0.5.104; public release observed v0.5.35. Many screenshots are older 0.3/0.4 captures. Do not combine them into one supposedly tested release.</p><p><a href="REFERENCE_REVIEW.md">All observations and limitations</a> · <a href="FEATURE_MATRIX.md">38-feature native/security comparison</a></p></main></body></html>'''
(root / 'reference-board.html').write_text(html)
print('Built reference-board.html with ten individually sourced screenshots')
