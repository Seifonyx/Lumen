// Canvas performance budget (CI): compares the Canvas build with the ordinary build of the same commit.
// node scripts/canvas-budget.mjs [ordinaryDist=dist] [canvasDist=dist-canvas]
// Startup cost is what index.html loads (entry script, its modulepreloads and stylesheets), gzipped.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const [ordinary = 'dist', canvas = 'dist-canvas'] = process.argv.slice(2);
// Kilobytes, gzipped. Raise one only with a reason in the commit; the point is that growth is a decision.
// startupJs 6 → 8 (2026-10-23): the approved Lumen identity's wordmark and mark ship inline (≈1.5 KB gz of vector art
// plus ≈0.8 KB for the component), so the sidebar head draws with the first frame instead of after a request.
// startupJs 8 → 8.5 (Phase 2 slice 2): the tree's screen-reader state (current chat, pinned), the announced search
// count and the drawer's focus return run before any interaction (≈0.5 KB gz); the arrow keys load lazily.
// startupJs 8.5 → 9 (Phase 2 slice 3): Back for Settings, a project's overview and All chats, and the unsent-draft
// marker in the tree (≈0.3 KB gz); both must work before any interaction, so neither can load later.
// startupCss 14 → 16 (Phase 3 slice 1): the reading styles (canvas-reading.css: headings, quotes, tables, code, sources,
// the reply line, attachments; ≈1.6 KB gz) style the first conversation on screen, so they cannot load later.
// startupJs 9 → 9.5 (Phase 3 slice 3): a wheel, drag or Page Up stops following a streaming reply at once, and Stop
// returns the keyboard to the message box (≈0.2 KB gz); both act on the first interaction, so neither can load later.
// iPhone navigation reset (owner-authorized 2026-10-24): a complete canonical UI history adapter and
// shared phone navigation replace the single surface sentinel. Must run before the first navigation;
// measured about +1.1 KB gz over the previous limit. Shared accessible phone bars/content rows add about0.8KB CSS for phone bars, content rows and anchored actions.
// 11 → 11.5: nested presentation ownership and atomic Back replay add about0.2KB; bounded headroom avoids
// hiding that explicit safety cost. Provider action menus remain lazy; ordinary bytes and the startup CSS / Routing Center limits stay fixed.
// 11.5 → 12: comparison/analysis origin restoration and phone gesture/focus ownership measure about11.6KB total growth.
// Phase 4 iPhone visual refinement (2026-10-24): 17 → 17.5 KB for mobile provider rows,
// shared hub hierarchy and long account details. Measured 17.2 KB gz; other limits remain unchanged.
// Owner-corrected final phone pass: shared glass controls, feature-local Library/Routing sections
// and contained search replace the old directory. CSS source limit17.5→18.5KB records this scoped material/
// layout cost. The reactive phone breakpoint shared by Library/Hub/RC adds ~0.1KB gz;
// startup JS12→12.25KB records that functional resize fix. Startup CSS and lazy RC limits are unchanged.
// Slice3 CP1:19.25KB source CSS includes the new lazy Auto/Layout stylesheet (measured total≈19.1KB).
// It styles the substantive canonical editor/review workflow on demand; startup JS/CSS and RC limits stay fixed.
// Phase5 Slice1 draft review: whole-feature origin traversal/direct-entry fallback and
// ready composer-file retention across temporary source-chat changes add about1KB gz.
// Phone chrome is now lazy; Library/export discovery remains lazy and reuses Markdown.
// Measured startup growth13.2KB; bounded13.5KB. The Library stylesheet is included in
// the source audit too (lazy, about1.5KB), with21KB total; startup CSS/RC caps unchanged.
// This measured cost is an explicit planner-review item, not a speed improvement claim.
// canvasCss 21 → 22 (Phase 5 slice 2): the lazy Tools workspace styles (tools-workspace.css, ≈1.1 KB gz) replace the
// card/rail/browse rules removed from canvas-shell.css and canvas-screens.css (≈0.5 KB); startup CSS shrinks as a result.
// canvasCss 22 → 24 (Activity, 2026-10-30): the lazy Activity stylesheet (activity.css, ≈1.6 KB gz: Overview, Logs,
// Quotas, the event dialog) loads only with Router → Activity; ~0.3 KB of the old Usage/Diagnostics rules were removed.
// Startup CSS and the Router chunk limits are unchanged.
// UI audit fixes (2026-10-30): startupCss 16 → 16.5, canvasCss 24 → 25, startupJs 13.5 → 14. App-wide field, select,
// button, label and chip rules (one style for dialogs and pages), phone table wrapping, the new-chat starters and the
// on-screen menu positioning; measured startup CSS 16.3, Canvas CSS 24.8, startup JS 13.5 KB gz. Router chunk unchanged.
const BUDGET = { startupJs: 14, startupCss: 16.5, routingCenter: 9, canvasCss: 25 };

const gz = (dir, file) => gzipSync(readFileSync(join(dir, file))).length / 1024;
function startup(dir) {
  const html = readFileSync(join(dir, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="\/?(assets\/[^"]+\.(js|css))"/g)];
  const sum = (ext) => refs.filter((m) => m[2] === ext).reduce((n, m) => n + gz(dir, m[1]), 0);
  return { js: sum('js'), css: sum('css')};
}
const a = startup(ordinary), b = startup(canvas);
const rc = readdirSync(join(canvas, 'assets')).filter((f) => /^RoutingCenter-.*\.js$/.test(f));
const rows = [
  ['Startup JS growth', b.js - a.js, BUDGET.startupJs],
  ['Startup CSS growth', b.css - a.css, BUDGET.startupCss],
  ['Routing Center chunk (lazy)', rc.reduce((n, f) => n + gz(canvas, join('assets', f)), 0), BUDGET.routingCenter],
];
// Canvas CSS on its own: the source files, minified roughly by collapsing whitespace and comments.
const css = ['canvas.css', 'canvas-composer.css', 'canvas-shell.css', 'canvas-reading.css', 'canvas-routing.css', 'canvas-screens.css', 'brand-crease.css', 'canvas-routing-experience.css']
  .map((f) => readFileSync(join('src/styles', f), 'utf8')).concat(['canvas-library.css', 'tools-workspace.css', 'settings-index.css', 'activity.css'].map((f) => readFileSync(join('src/components', f), 'utf8'))).join('\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
rows.push(['Canvas CSS source (gz, approx.)', gzipSync(css).length / 1024, BUDGET.canvasCss]);
if (!rc.length) rows.push(['Routing Center must stay a lazy chunk', 1, 0]);

let failed = 0;
for (const [name, kb, max] of rows) {
  const ok = kb <= max;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: ${kb.toFixed(1)} KB gz (budget ${max} KB)`);
}
console.log(`Ordinary startup ${a.js.toFixed(1)} KB JS + ${a.css.toFixed(1)} KB CSS; Canvas ${b.js.toFixed(1)} KB JS + ${b.css.toFixed(1)} KB CSS (gzipped).`);
process.exit(failed ? 1 : 0);
