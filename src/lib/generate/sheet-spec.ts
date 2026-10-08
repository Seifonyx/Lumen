// Turns what a model wrote for an .xlsx file (JSON spec, Markdown tables or CSV) into one normalized shape,
// used both by the Excel writer and by the in-app preview.

import { marked, type Token, type Tokens } from 'marked';
import { isRtl } from '../util';
import { hex, parseLooseJson } from './spec';

export type ColType = 'text' | 'number' | 'integer' | 'currency' | 'percent' | 'date';

export interface ColumnSpec {
  header: string;
  type: ColType;
  width?: number;
  currency?: string;
  align?: 'left' | 'center' | 'right';
  total?: 'sum' | 'average' | 'min' | 'max' | 'count' | 'none';
}

export interface CellSpec {
  value: string | number | boolean | null;
  fill?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  note?: string;
}

export interface ConditionalSpec {
  column: number;
  type: 'colorScale' | 'dataBar' | 'greaterThan' | 'lessThan' | 'equals' | 'between' | 'contains';
  value?: string | number;
  value2?: number;
  fill?: string;
  color?: string;
}

export interface SheetSpec {
  name: string;
  title?: string;
  subtitle?: string;
  columns: ColumnSpec[];
  rows: CellSpec[][];
  zebra: string | null;
  freeze: boolean;
  filter: boolean;
  totals: boolean;
  rtl: boolean;
  headerFill: string;
  headerColor: string;
  conditional: ConditionalSpec[];
}

export interface WorkbookSpec {
  theme: string;
  sheets: SheetSpec[];
}

const TYPES: ColType[] = ['text', 'number', 'integer', 'currency', 'percent', 'date'];

function toCell(raw: any): CellSpec {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return {
      value: raw.value ?? raw.formula ?? null,
      fill: raw.fill ? hex(raw.fill, '') || undefined : undefined,
      color: raw.color ? hex(raw.color, '') || undefined : undefined,
      bold: Boolean(raw.bold) || undefined,
      italic: Boolean(raw.italic) || undefined,
      note: raw.note ? String(raw.note) : undefined,
    };
  }
  return { value: raw === undefined ? null : raw };
}

/** "1,234.5" → 1234.5, "85%" → 0.85; leaves IDs with leading zeros as text. */
export function parseNumber(s: string): { value: number; percent: boolean } | null {
  const t = s.trim().replace(/[٬,]/g, '').replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  const pct = /%$/.test(t);
  const core = t.replace(/%$/, '').replace(/^[$€£¥]|^(EGP|USD|SAR|AED)\s*/i, '');
  if (!/^-?\d+(\.\d+)?$/.test(core) || /^-?0\d/.test(core)) return null;
  return { value: pct ? Number(core) / 100 : Number(core), percent: pct };
}

function inferColumns(header: string[], rows: string[][]): { columns: ColumnSpec[]; cells: CellSpec[][] } {
  const columns: ColumnSpec[] = header.map((h, i) => {
    const vals = rows.map((r) => (r[i] ?? '').trim()).filter(Boolean);
    let type: ColType = 'text';
    if (vals.length && vals.every((v) => /^\d{4}-\d{2}-\d{2}$/.test(v))) type = 'date';
    else if (vals.length && vals.every((v) => parseNumber(v))) {
      const parsed = vals.map((v) => parseNumber(v)!);
      type = parsed.every((p) => p.percent) ? 'percent' : parsed.every((p) => Number.isInteger(p.value)) ? 'integer' : 'number';
    }
    return { header: h, type };
  });
  const cells = rows.map((r) =>
    header.map((_, i) => {
      const v = (r[i] ?? '').trim();
      const col = columns[i];
      if (v && col.type !== 'text' && col.type !== 'date') return { value: parseNumber(v)?.value ?? v };
      return { value: v || null };
    }),
  );
  return { columns, cells };
}

function plain(tokens: Token[] | undefined): string {
  return (tokens || []).map((t: any) => (t.tokens ? plain(t.tokens) : t.text ?? '')).join('');
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row = [''];
  let quoted = false;
  const delim = text.split('\n')[0].includes('\t') && !text.split('\n')[0].includes(',') ? '\t' : ',';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { row[row.length - 1] += '"'; i++; }
      else if (ch === '"') quoted = false;
      else row[row.length - 1] += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) row.push('');
    else if (ch === '\n') { rows.push(row); row = ['']; }
    else if (ch !== '\r') row[row.length - 1] += ch;
  }
  if (row.length > 1 || row[0]) rows.push(row);
  return rows;
}

function defaults(theme: string, name: string, columns: ColumnSpec[], rows: CellSpec[][]): SheetSpec {
  return {
    name,
    columns,
    rows,
    zebra: 'F3F6FA',
    freeze: true,
    filter: rows.length > 3,
    totals: false,
    rtl: isRtl(columns.map((c) => c.header).join(' ')),
    headerFill: theme,
    headerColor: 'FFFFFF',
    conditional: [],
  };
}

function uniqueNames(sheets: SheetSpec[]) {
  const used = new Set<string>();
  sheets.forEach((s, i) => {
    let base = (s.name || `Sheet ${i + 1}`).replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || `Sheet ${i + 1}`;
    let name = base;
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base.slice(0, 26)} (${n})`;
    used.add(name.toLowerCase());
    s.name = name;
  });
}

export function parseWorkbook(content: string): WorkbookSpec | null {
  const trimmed = content.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const json = parseLooseJson<any>(trimmed);
    if (json) {
      const theme = hex(json.theme, '1F4E79');
      const rawSheets: any[] = Array.isArray(json) ? json : Array.isArray(json.sheets) ? json.sheets : [json];
      const sheets: SheetSpec[] = rawSheets
        .filter((s) => s && (Array.isArray(s.columns) || Array.isArray(s.rows)))
        .map((s, i) => {
          const rawCols: any[] = Array.isArray(s.columns) ? s.columns : (s.rows?.[0] || []).map((_: any, j: number) => `Column ${j + 1}`);
          const columns: ColumnSpec[] = rawCols.map((c: any) => {
            const col = typeof c === 'string' ? { header: c } : c || {};
            return {
              header: String(col.header ?? col.name ?? ''),
              type: TYPES.includes(col.type) ? col.type : 'text',
              width: Number(col.width) || undefined,
              currency: col.currency ? String(col.currency) : undefined,
              align: ['left', 'center', 'right'].includes(col.align) ? col.align : undefined,
              total: col.total,
            };
          });
          const rows: CellSpec[][] = (Array.isArray(s.rows) ? s.rows : []).map((r: any) =>
            Array.isArray(r) ? r.map(toCell) : columns.map((c) => toCell(r?.[c.header])),
          );
          // Columns typed as text but holding only numbers become numbers.
          columns.forEach((c, ci) => {
            if (!c.type || c.type === 'text') {
              const vals = rows.map((r) => r[ci]?.value).filter((v) => v !== null && v !== '');
              if (vals.length && vals.every((v) => typeof v === 'number')) c.type = vals.every((v) => Number.isInteger(v)) ? 'integer' : 'number';
            }
          });
          const base = defaults(theme, String(s.name || `Sheet ${i + 1}`), columns, rows);
          const colIndex = (name: any) => (typeof name === 'number' ? name : columns.findIndex((c) => c.header === name));
          return {
            ...base,
            title: s.title ? String(s.title) : undefined,
            subtitle: s.subtitle ? String(s.subtitle) : undefined,
            zebra: s.zebra === false ? null : typeof s.zebra === 'string' ? hex(s.zebra, 'F3F6FA') : base.zebra,
            freeze: s.freeze !== false,
            filter: s.filter ?? base.filter,
            totals: Boolean(s.totals),
            rtl: typeof s.rtl === 'boolean' ? s.rtl : base.rtl || isRtl(String(s.title || '')),
            headerFill: hex(s.headerFill, theme),
            headerColor: hex(s.headerColor, 'FFFFFF'),
            conditional: (Array.isArray(s.conditional) ? s.conditional : [])
              .map((c: any) => ({ ...c, column: colIndex(c.column), fill: c.fill ? hex(c.fill, 'F8CBAD') : undefined, color: c.color ? hex(c.color, '9C0006') : undefined }))
              .filter((c: ConditionalSpec) => c.column >= 0),
          };
        });
      if (sheets.length) {
        uniqueNames(sheets);
        return { theme, sheets };
      }
    }
  }

  // Markdown tables, one sheet each, named after the heading above.
  const theme = '1F4E79';
  const sheets: SheetSpec[] = [];
  let heading = '';
  const walk = (tokens: Token[]) => {
    for (const t of tokens) {
      if (t.type === 'heading') heading = plain((t as Tokens.Heading).tokens);
      else if (t.type === 'table') {
        const tb = t as Tokens.Table;
        const { columns, cells } = inferColumns(tb.header.map((c) => plain(c.tokens)), tb.rows.map((r) => r.map((c) => plain(c.tokens))));
        sheets.push(defaults(theme, heading || `Table ${sheets.length + 1}`, columns, cells));
      } else if ((t as any).tokens && t.type !== 'code') walk((t as any).tokens);
    }
  };
  walk(marked.lexer(content));
  if (!sheets.length) {
    const rows = parseCsv(trimmed);
    if (rows.length >= 1 && rows[0].length >= 2) {
      const { columns, cells } = inferColumns(rows[0], rows.slice(1));
      sheets.push(defaults(theme, 'Sheet 1', columns, cells));
    }
  }
  if (!sheets.length) return null;
  uniqueNames(sheets);
  return { theme, sheets };
}

export function colLetter(i: number): string {
  let s = '';
  for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}

/** Row numbers (1-based) where the header and data sit, given optional title rows. */
export function layout(sheet: SheetSpec) {
  const headerRow = sheet.title ? (sheet.subtitle ? 4 : 3) : 1;
  const first = headerRow + 1;
  const last = headerRow + Math.max(sheet.rows.length, 1);
  return { headerRow, first, last, totalsRow: last + 1 };
}

export const fillFormula = (f: string, row: number, first: number, last: number) =>
  f.replace(/\{row\}/g, String(row)).replace(/\{first\}/g, String(first)).replace(/\{last\}/g, String(last));

export function numFmt(col: ColumnSpec): string | undefined {
  switch (col.type) {
    case 'integer': return '#,##0';
    case 'number': return '#,##0.##';
    case 'percent': return '0.0%';
    case 'date': return 'yyyy-mm-dd';
    case 'currency': {
      const c = (col.currency || '').trim();
      const sym = { USD: '$', EUR: '€', GBP: '£' }[c.toUpperCase()] || c;
      return sym ? `"${sym.replace(/"/g, '')}" #,##0.00` : '#,##0.00';
    }
    default: return undefined;
  }
}
