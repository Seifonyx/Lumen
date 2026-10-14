// Edit lists for existing Word or Excel files (applied in place by edit.ts), so its fonts, tables, headers, logos and styles stay as
// they were. Models describe changes as JSON in a ```office-edit:Name.docx``` block:
//   Word:  {"edits":[{"find":"[Patient name]","replace":"Mona Adel"},
//                    {"after":"Findings","insert":["First new paragraph","Second"]},
//                    {"delete":"Draft – do not circulate"}]}
//   Excel: {"edits":[{"sheet":"Summary","cell":"B4","value":12},{"cell":"C2","value":"Done"}]}
// "find" matches text inside one paragraph (across differently formatted pieces); add "all":true to
// replace every match. Paragraph edits ("after"/"before"/"delete") find the paragraph containing the text.
export type WordEdit =
  | { find: string; replace: string; all?: boolean }
  | { after: string; insert: string | string[] }
  | { before: string; insert: string | string[] }
  | { delete: string };
export type CellEdit = { sheet?: string; cell: string; value: string | number | boolean | null };
export type OfficeEdit = WordEdit | CellEdit;
export type EditResult = { label: string; ok: boolean; note?: string };

export const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
export const S = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const MAX_EDITS = 200;

/** Reads the JSON a model wrote. Throws a readable error for anything unusable. */
export function parseOfficeEdits(raw: string): { edits: OfficeEdit[]; name?: string } {
  let data: unknown;
  try { data = JSON.parse(raw.trim().replace(/^```\w*\n?|```$/g, '')); } catch { throw new Error('The edit list isn’t valid JSON.'); }
  const obj = (Array.isArray(data) ? { edits: data } : data) as { edits?: unknown; name?: unknown };
  if (!obj || !Array.isArray(obj.edits) || !obj.edits.length) throw new Error('No edits were listed.');
  const edits = obj.edits.slice(0, MAX_EDITS).filter((e): e is OfficeEdit => {
    if (!e || typeof e !== 'object') return false;
    const x = e as Record<string, unknown>;
    if (typeof x.find === 'string' && typeof x.replace === 'string') return x.find.trim().length > 0;
    if ((typeof x.after === 'string' || typeof x.before === 'string') && (typeof x.insert === 'string' || Array.isArray(x.insert))) return true;
    if (typeof x.delete === 'string') return x.delete.trim().length > 0;
    if (typeof x.cell === 'string') return /^[A-Z]{1,3}[1-9]\d{0,6}$/i.test(x.cell.trim());
    return false;
  });
  if (!edits.length) throw new Error('None of the edits could be understood.');
  return { edits, name: typeof obj.name === 'string' ? obj.name : undefined };
}

export const describeEdit = (e: OfficeEdit): string =>
  'cell' in e ? `${e.sheet ? `${e.sheet}!` : ''}${e.cell.toUpperCase()} → ${e.value === null ? '(empty)' : String(e.value)}`
  : 'find' in e ? `“${e.find}” → “${e.replace}”${e.all ? ' (everywhere)' : ''}`
  : 'delete' in e ? `Remove the paragraph with “${e.delete}”`
  : `${'after' in e ? 'After' : 'Before'} “${'after' in e ? e.after : e.before}”: add ${[e.insert].flat().length} paragraph${[e.insert].flat().length === 1 ? '' : 's'}`;

// Models quote text from a Markdown rendering of the file, so ignore Markdown marks and spacing differences.
export const clean = (s: string) => s.replace(/\\([\\`*_{}[\]()#+\-.!|>])/g, '$1').replace(/\*\*|__/g, '').replace(/\s+/g, ' ').trim();

