// Decides what one Tests run needs and writes it as job outputs (GITHUB_OUTPUT), so the other jobs start right away
// with only their share. Pushes to main and manual runs test everything (Deploy waits for that run). A pull request
// runs only what its change can affect (scripts/affected.mjs), unless it touches build/test machinery or shared app
// state, or affects more than half the suites: then everything, as on main.
//   node scripts/ci-plan.mjs              (CI)   PLAN_BASE=<ref> overrides the comparison base
import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { affected, lists } from './affected.mjs';

const event = process.env.GITHUB_EVENT_NAME || 'local';
const baseRef = process.env.PLAN_BASE || (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : 'origin/main');
const { canvasCore, canvasPhone, webkit } = lists();
const GROUPS = [
  { group: 'screens-wide', contracts: 'canvas-screens', viewports: '1440x960,430x932' },
  { group: 'screens-narrow', contracts: 'canvas-screens', viewports: '390x844,320x568' },
  { group: 'composer-routing', contracts: 'canvas-composer routing-center' },
  { group: 'shell-browser', contracts: 'canvas-shell browser' },
];

let full = event !== 'pull_request', why = full ? `${event}: everything` : '';
let a = null;
if (!full) {
  const base = execFileSync('git', ['merge-base', 'HEAD', baseRef], { encoding: 'utf8' }).trim();
  a = affected({ base });
  if (a.broad.length) { full = true; why = `touches ${a.broad.slice(0, 4).join(', ')}${a.broad.length > 4 ? '…' : ''}`; }
  else if (a.e2e.length > a.total / 2) { full = true; why = `affects ${a.e2e.length} of ${a.total} suites`; }
  else why = `${a.changed.length} changed files: ${a.e2e.length} suites, ${a.contracts.length} contracts`;
}
const pick = (list) => full ? list : list.filter((s) => a.e2e.includes(s));
const shards = (count, per, max) => Array.from({ length: count ? (full ? max : Math.min(max, Math.ceil(count / per))) : 0 }, (_, i) => i + 1);

const inapp = full ? [] : a.e2e;                       // [] with full = every suite
const inappShards = shards(full ? 1 : inapp.length, 5, 6);
const canvas = pick(canvasCore);
const canvasShards = shards(canvas.length, 5, 6);
const welcome = pick(['welcome', 'layout']);
const wk = pick(webkit);
const wkParts = shards(wk.length + welcome.length, 8, 2);
const phone = pick(canvasPhone);
const phoneParts = shards(phone.length, 6, 2);
const engines = ['Chromium', 'WebKit'];
const engine = GROUPS.filter((g) => full || g.contracts.split(' ').some((c) => a.contracts.includes(c))).flatMap((g) => engines.map((e) => ({ engine: e, ...g })));
const phoneMatrix = phoneParts.flatMap((part) => engines.map((e) => ({ engine: e, part, of: phoneParts.length })));

const out = {
  mode: full ? 'full' : 'affected', why,
  inapp: inapp.join(' '), inapp_matrix: JSON.stringify(inappShards), inapp_n: String(inappShards.length),
  canvas: canvas.join(' '), canvas_matrix: JSON.stringify(canvasShards), canvas_n: String(canvasShards.length),
  webkit: wk.join(' '), webkit_welcome: welcome.join(' '), webkit_tabbar: String(full), webkit_matrix: JSON.stringify(wkParts), webkit_n: String(wkParts.length),
  phone: phone.join(' '), phone_matrix: JSON.stringify(phoneMatrix),
  engine_matrix: JSON.stringify(engine),
};
const lines = Object.entries(out).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, lines); else process.stdout.write(lines);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Test plan: ${out.mode}\n${why}\n\n`
  + (full ? 'Every suite and contract runs.\n' : `- In-app (ordinary): ${inapp.join(', ') || 'none'}\n- In-app (Canvas): ${canvas.join(', ') || 'none'}\n- WebKit: ${[...welcome, ...wk].join(', ') || 'none'}\n- Canvas phone: ${phone.join(', ') || 'none'}\n- Contracts: ${a.contracts.join(', ') || 'none'}\n`));
console.log(`Test plan: ${out.mode} (${why})`);
