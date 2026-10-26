// Language labels used by Markdown discovery without loading the executable runner.
export type RunLang = 'js' | 'ts' | 'python' | 'html';
const LANGS: Record<string, RunLang> = {
  js: 'js', javascript: 'js', mjs: 'js', cjs: 'js', node: 'js',
  ts: 'ts', typescript: 'ts', py: 'python', python: 'python', python3: 'python',
  html: 'html', htm: 'html',
};
export const runLang = (lang: string): RunLang | null => LANGS[lang.trim().toLowerCase()] ?? null;
export const LANG_NAMES: Record<RunLang, string> = { js: 'JavaScript', ts: 'TypeScript', python: 'Python', html: 'HTML' };
