// Runs code from replies in the browser, away from the app: JavaScript/TypeScript in a module worker
// (npm imports load from esm.sh), Python in a worker with Pyodide (from jsDelivr, cached by the
// browser after the first time), and HTML in a sandboxed frame (see RunPanel). Nothing runs on a server.

export type RunLang = 'js' | 'ts' | 'python' | 'html';
export interface OutLine {
  kind: 'log' | 'info' | 'warn' | 'error' | 'result' | 'system';
  text: string;
}

const LANGS: Record<string, RunLang> = {
  js: 'js', javascript: 'js', mjs: 'js', cjs: 'js', node: 'js',
  ts: 'ts', typescript: 'ts',
  py: 'python', python: 'python', python3: 'python',
  html: 'html', htm: 'html',
};
export const runLang = (lang: string): RunLang | null => LANGS[lang.trim().toLowerCase()] ?? null;
export const LANG_NAMES: Record<RunLang, string> = { js: 'JavaScript', ts: 'TypeScript', python: 'Python', html: 'HTML' };

/** Turns any value into readable text, like a console would. */
const FORMAT = `
const fmt = (v, depth = 0) => {
  if (typeof v === 'string') return depth ? JSON.stringify(v) : v;
  if (v instanceof Error) return (v.stack || v.name + ': ' + v.message);
  if (typeof v === 'function') return '[Function ' + (v.name || 'anonymous') + ']';
  if (typeof v === 'bigint') return v + 'n';
  if (typeof v === 'symbol' || v === undefined || v === null || typeof v !== 'object') return String(v);
  if (depth > 3) return Array.isArray(v) ? '[Array]' : '[Object]';
  try {
    if (v instanceof Map) return 'Map(' + v.size + ') {' + [...v].map(([k, x]) => fmt(k, depth + 1) + ' => ' + fmt(x, depth + 1)).join(', ') + '}';
    if (v instanceof Set) return 'Set(' + v.size + ') {' + [...v].map((x) => fmt(x, depth + 1)).join(', ') + '}';
    if (Array.isArray(v)) return '[' + v.map((x) => fmt(x, depth + 1)).join(', ') + ']';
    return '{ ' + Object.entries(v).map(([k, x]) => k + ': ' + fmt(x, depth + 1)).join(', ') + ' }';
  } catch (e) { return String(v); }
};
`;

const JS_WORKER = `${FORMAT}
const send = (kind, args) => postMessage({ kind, text: args.map((a) => fmt(a)).join(' ') });
for (const [name, kind] of [['log', 'log'], ['info', 'info'], ['debug', 'log'], ['warn', 'warn'], ['error', 'error'], ['table', 'log'], ['dir', 'log']]) console[name] = (...a) => send(kind, a);
self.addEventListener('unhandledrejection', (e) => send('error', [e.reason]));
self.onmessage = async (e) => {
  const url = URL.createObjectURL(new Blob([e.data], { type: 'text/javascript' }));
  try { await import(url); postMessage({ kind: 'done' }); }
  catch (err) { send('error', [err]); postMessage({ kind: 'done', failed: true }); }
};
`;

const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
const PY_WORKER = `
let py = null;
const out = (kind) => (text) => postMessage({ kind, text });
self.onmessage = async (e) => {
  try {
    if (!py) {
      postMessage({ kind: 'system', text: 'Loading Python (the first time takes a few seconds)…' });
      importScripts('${PYODIDE}pyodide.js');
      py = await loadPyodide({ indexURL: '${PYODIDE}' });
    }
    py.setStdout({ batched: out('log') });
    py.setStderr({ batched: out('error') });
    await py.loadPackagesFromImports(e.data, { messageCallback: (m) => /Loading|Loaded/.test(m) && postMessage({ kind: 'system', text: m }) });
    const result = await py.runPythonAsync(e.data);
    if (result !== undefined && result !== null) postMessage({ kind: 'result', text: String(result) });
    postMessage({ kind: 'done' });
  } catch (err) {
    postMessage({ kind: 'error', text: String(err && err.message || err).trim() });
    postMessage({ kind: 'done', failed: true });
  }
};
`;

/** npm package names in imports → esm.sh URLs; Node-only modules get a clear error. */
export function prepareJs(code: string): string {
  return code.replace(/(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"./][^'"]*)\2/g, (all, pre, q, spec: string) => {
    if (/^(https?:|data:|blob:)/.test(spec)) return all;
    const name = spec.replace(/^node:/, '');
    if (/^(fs|path|os|child_process|http|https|net|crypto|stream|util|events|url|zlib|readline|process|buffer|worker_threads)(\/|$)/.test(name)) {
      return `${pre}${q}data:text/javascript,throw new Error("'${name}' is a Node.js module and can't run in the browser")${q}`;
    }
    return `${pre}${q}https://esm.sh/${spec}${q}`;
  });
}

async function compileTs(code: string): Promise<string> {
  const { transform } = await import('sucrase');
  return transform(code, { transforms: ['typescript'], disableESTransforms: true }).code;
}

export interface Run {
  stop(): void;
  done: Promise<{ failed: boolean; ms: number }>;
}

let pyWorker: Worker | null = null;

/** Runs JavaScript, TypeScript or Python; each output line goes to `onOut`. Stops after `timeout` ms. */
export function runCode(lang: Exclude<RunLang, 'html'>, code: string, onOut: (l: OutLine) => void, timeout = lang === 'python' ? 120_000 : 15_000): Run {
  const t0 = performance.now();
  let worker: Worker;
  let finish: (r: { failed: boolean; ms: number }) => void = () => {};
  const done = new Promise<{ failed: boolean; ms: number }>((res) => (finish = res));
  let over = false;
  const end = (failed: boolean) => {
    if (over) return;
    over = true;
    clearTimeout(timer);
    finish({ failed, ms: Math.round(performance.now() - t0) });
  };
  const kill = (why: string) => {
    if (over) return;
    worker?.terminate();
    if (worker === pyWorker) pyWorker = null;
    onOut({ kind: 'system', text: why });
    end(true);
  };
  const timer = setTimeout(() => kill(`Stopped after ${timeout / 1000} seconds (an endless loop?).`), timeout);

  const start = (w: Worker, payload: string) => {
    worker = w;
    w.onmessage = (e) => {
      if (e.data.kind === 'done') end(Boolean(e.data.failed));
      else onOut(e.data);
    };
    w.onerror = (e) => {
      e.preventDefault();
      onOut({ kind: 'error', text: e.message || 'The code crashed.' });
      end(true);
    };
    w.postMessage(payload);
  };

  if (lang === 'python') {
    pyWorker ||= new Worker(URL.createObjectURL(new Blob([PY_WORKER], { type: 'text/javascript' })));
    start(pyWorker, code);
  } else {
    const w = new Worker(URL.createObjectURL(new Blob([JS_WORKER], { type: 'text/javascript' })), { type: 'module' });
    (lang === 'ts' ? compileTs(code) : Promise.resolve(code)).then(
      (js) => start(w, prepareJs(js)),
      (e) => {
        worker = w;
        onOut({ kind: 'error', text: `TypeScript error: ${(e as Error).message}` });
        w.terminate();
        end(true);
      },
    );
    // JS workers are single-use: stop them when the run ends.
    void done.then(() => w.terminate());
  }
  return { stop: () => kill('Stopped.'), done };
}

/** Console bridge put at the top of an HTML preview: logs and errors go to the app. */
export const HTML_BRIDGE = `<script>${FORMAT}
(() => {
  const send = (kind, a) => parent.postMessage({ __runner: true, kind, text: a.map((x) => fmt(x)).join(' ') }, '*');
  for (const [n, k] of [['log', 'log'], ['info', 'info'], ['warn', 'warn'], ['error', 'error']]) { const o = console[n]; console[n] = (...a) => { send(k, a); o.apply(console, a); }; }
  addEventListener('error', (e) => send('error', [e.message + (e.lineno ? ' (line ' + e.lineno + ')' : '')]));
  addEventListener('unhandledrejection', (e) => send('error', [e.reason]));
})();
</script>`;

export function htmlDocument(code: string): string {
  if (/<head[^>]*>/i.test(code)) return code.replace(/<head[^>]*>/i, (h) => `${h}${HTML_BRIDGE}`);
  if (/<html[^>]*>/i.test(code)) return code.replace(/<html[^>]*>/i, (h) => `${h}<head>${HTML_BRIDGE}</head>`);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${HTML_BRIDGE}</head><body>${code}</body></html>`;
}
