// Checks uncommitted changes before they go to GitHub: leftover edit/conflict markers, JavaScript and
// TypeScript that doesn't parse, and broken JSON. Catches the mistakes that would make the build fail,
// right in the app, so the model can fix them before a commit.

import type { FileChange } from '../types';

export interface Problem {
  path: string;
  line?: number;
  message: string;
}

const CODE = /\.(m?[jt]sx?|c[jt]s)$/;

export async function checkChanges(changes: Record<string, FileChange>): Promise<Problem[]> {
  const problems: Problem[] = [];
  for (const [path, c] of Object.entries(changes)) {
    const text = c.content;
    if (text === null) continue;
    const lines = text.split('\n');
    const markers = lines.flatMap((l, i) => (/^\s*(<{7}|>{7})( |$)/.test(l) ? [i + 1] : []));
    if (markers.length) {
      problems.push({ path, line: markers[0], message: `Leftover edit or merge marker (${lines[markers[0] - 1].trim()}) on line ${markers.join(', ')}` });
      continue;
    }
    if (/\.json$/.test(path) && !/tsconfig|jsconfig|\.vscode\//.test(path)) {
      try {
        JSON.parse(text);
      } catch (e) {
        problems.push({ path, message: `Not valid JSON: ${(e as Error).message}` });
      }
      continue;
    }
    if (CODE.test(path)) {
      const ts = /\.(m?tsx?|cts)$/.test(path);
      const jsx = /x$/.test(path) || (!ts && /<[A-Za-z][\w.]*[\s>/]/.test(text));
      try {
        const { transform } = await import('sucrase');
        transform(text, { transforms: [...(ts ? (['typescript'] as const) : []), ...(jsx ? (['jsx'] as const) : [])], filePath: path, disableESTransforms: true });
      } catch (e) {
        const msg = (e as Error).message.replace(/^Error transforming [^:]+:\s*/, '');
        const m = /\((\d+):(\d+)\)/.exec(msg);
        problems.push({ path, line: m ? Number(m[1]) : undefined, message: `Syntax error: ${msg}` });
      }
    }
  }
  return problems;
}

/** What to tell the model so it fixes the problems. */
export function problemsMessage(problems: Problem[]): string {
  return [
    'Before committing, the app checked the changed files and found problems that would break the build:',
    ...problems.map((p) => `- ${p.path}${p.line ? ` (line ${p.line})` : ''}: ${p.message}`),
    'Read the files and fix every problem with SEARCH/REPLACE edit blocks.',
  ].join('\n');
}
