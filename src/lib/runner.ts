// Runs code from replies in the browser, away from the app: JavaScript/TypeScript in a module worker
// (npm imports load from esm.sh), Python in a worker with Pyodide (from jsDelivr, cached by the
// browser after the first time), and HTML in a sandboxed frame (see RunPanel). Nothing runs on a server.

import type { AnalysisInput } from './analysis';
import type { RunLang } from './run-language';
export type { RunLang } from './run-language';
export { runLang, LANG_NAMES } from './run-language';
export interface RunArtifact { name: string; data: Uint8Array }
export interface PythonOptions { files?: AnalysisInput[]; analysis?: boolean; onArtifact?: (file: RunArtifact) => void }
export interface OutLine {
  kind: 'log' | 'info' | 'warn' | 'error' | 'result' | 'system';
  text: string;
}


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
const PY_WORKER = String.raw`
let py = null, excel = false;
const clearDir = (path) => {
  if (!py.FS.analyzePath(path).exists) return;
  if (!py.FS.isDir(py.FS.lstat(path).mode)) { py.FS.unlink(path); return; }
  for (const name of py.FS.readdir(path)) {
    if (name === '.' || name === '..') continue;
    const child = path + '/' + name;
    if (py.FS.isDir(py.FS.lstat(child).mode)) clearDir(child);
    else py.FS.unlink(child);
  }
  py.FS.rmdir(path);
};
self.onmessage = async (e) => {
  const { id, code, files = [], analysis, origin } = e.data;
  const send = (kind, text, extra = {}) => postMessage({ id, kind, text, ...extra });
  let scope;
  try {
    if (!py) {
      send('system', 'Loading Python (the first time takes a few seconds)…');
      importScripts('${PYODIDE}pyodide.js');
      py = await loadPyodide({ indexURL: '${PYODIDE}', env: { MPLBACKEND: 'Agg' } });
    }
    py.setStdout({ batched: (text) => send('log', text) });
    // Python warnings use stderr too. Exceptions are reported separately by the catch below.
    py.setStderr({ batched: (text) => send('warn', text) });
    const callbacks = { messageCallback: (m) => /Loading|Loaded/.test(m) && send('system', m) };
    if (analysis) {
      await py.loadPackage(['pandas', 'matplotlib', 'micropip'], callbacks);
      if (!excel) {
        send('system', 'Preparing Excel support…');
        const wheels = ['et_xmlfile-2.0.0-py3-none-any.whl', 'openpyxl-3.1.5-py2.py3-none-any.whl', 'xlrd-2.0.1-py2.py3-none-any.whl'].map(name => origin + '/python/' + name);
        await py.runPythonAsync('import micropip\nawait micropip.install(' + JSON.stringify(wheels) + ', deps=False)');
        excel = true;
      }
    }
    await py.loadPackagesFromImports(code, callbacks);
    py.FS.chdir('/');
    for (const path of ['/input', '/output']) { clearDir(path); py.FS.mkdir(path); }
    for (const file of files) py.FS.writeFile('/input/' + file.name, file.data);
    scope = py.toPy({ __name__: '__main__', input_files: files.map(file => '/input/' + file.name), output_dir: '/output' });
    if (analysis) await py.runPythonAsync('import matplotlib.pyplot as plt\nplt.close("all")\nplt.show = lambda *args, **kwargs: None', { globals: scope });
    const result = await py.runPythonAsync(code, { globals: scope });
    if (result !== undefined && result !== null) { send('result', String(result)); result.destroy?.(); }
    if (analysis) {
      await py.runPythonAsync('for _number in plt.get_fignums():\n    plt.figure(_number).savefig("/output/figure-%s.png" % _number, dpi=150)\nplt.close("all")', { globals: scope });
      const exports = []; let bytes = 0;
      const collect = (path, depth = 0) => {
        if (depth > 5) throw new Error('Output folders are too deeply nested.');
        for (const name of py.FS.readdir(path)) {
          if (name === '.' || name === '..') continue;
          const child = path + '/' + name, stat = py.FS.lstat(child);
          if (py.FS.isDir(stat.mode)) collect(child, depth + 1);
          else if (py.FS.isFile(stat.mode)) {
            bytes += stat.size;
            if (bytes > 20 * 1024 * 1024 || exports.length >= 20) throw new Error('Downloads are limited to 20 files and 20 MB per run.');
            exports.push({ name: child.slice(8), data: py.FS.readFile(child).slice() });
          }
        }
      };
      collect('/output');
      for (const file of exports) postMessage({ id, kind: 'artifact', ...file }, [file.data.buffer]);
    }
    send('done');
  } catch (err) {
    send('error', String(err && err.message || err).trim());
    send('done', '', { failed: true });
  } finally {
    scope?.destroy();
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
let activePython: (() => void) | null = null;

/** Release temporary uploads and the large Python runtime when its data workspace closes. */
export function releasePythonRunner(): void {
  activePython?.();
  pyWorker?.terminate();
  pyWorker = null;
}

/** Runs JavaScript, TypeScript or Python; each output line goes to `onOut`. Stops after `timeout` ms. */
export function runCode(lang: Exclude<RunLang, 'html'>, code: string, onOut: (l: OutLine) => void, timeout = lang === 'python' ? 120_000 : 15_000, options: PythonOptions = {}): Run {
  if (lang === 'python') activePython?.();
  const id = crypto.randomUUID();
  const t0 = performance.now();
  let worker: Worker;
  let finish: (r: { failed: boolean; ms: number }) => void = () => {};
  const done = new Promise<{ failed: boolean; ms: number }>((res) => (finish = res));
  let over = false;
  const end = (failed: boolean) => {
    if (over) return;
    over = true;
    clearTimeout(timer);
    if (activePython === stop) activePython = null;
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

  const stop = () => kill('Stopped.');
  const start = (w: Worker, payload: unknown) => {
    if (over) { w.terminate(); return; }
    worker = w;
    w.onmessage = (e) => {
      if (over || (lang === 'python' && e.data.id !== id)) return;
      if (e.data.kind === 'artifact') options.onArtifact?.({ name: e.data.name, data: e.data.data });
      else if (e.data.kind === 'done') end(Boolean(e.data.failed));
      else onOut(e.data);
    };
    w.onerror = (e) => {
      e.preventDefault();
      onOut({ kind: 'error', text: e.message || 'The code crashed.' });
      w.terminate();
      if (w === pyWorker) pyWorker = null;
      end(true);
    };
    w.postMessage(payload);
  };

  if (lang === 'python') {
    activePython = stop;
    if (!pyWorker) {
      const url = URL.createObjectURL(new Blob([PY_WORKER], { type: 'text/javascript' }));
      pyWorker = new Worker(url);
      URL.revokeObjectURL(url);
    }
    start(pyWorker, { id, code, files: options.files, analysis: options.analysis, origin: location.origin });
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
  return { stop, done };
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
