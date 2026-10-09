// A small Excel formula engine. It works out formula results so the in-app preview shows values
// (not "=IF(…)") and the saved .xlsx carries cached results for viewers that don't recalculate
// (e.g. the iPhone Files preview). Covers the formulas models usually write: arithmetic,
// comparisons, & joins, ranges, other-sheet references and ~40 common functions.

import { fillFormula, layout, type SheetSpec } from './sheet-spec';

export type Scalar = number | string | boolean | null;
export class FormulaError {
  constructor(public code: string) {}
  toString() {
    return this.code;
  }
}
export type Value = Scalar | FormulaError;
interface Range {
  rows: Value[][];
}
type Any = Value | Range;

/** Thrown for things this engine doesn't do; the preview then leaves the cell to Excel. */
export class Unsupported extends Error {}

const isRange = (v: Any): v is Range => typeof v === 'object' && v !== null && 'rows' in v;
const err = (code: string) => new FormulaError(code);

// ---------------------------------------------------------------- Tokens

type Tok =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'bool'; v: boolean }
  | { t: 'ref'; sheet?: string; col: number; row: number }
  | { t: 'fn'; v: string }
  | { t: 'op'; v: string };

const colIndex = (letters: string) => letters.toUpperCase().split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const ref = /^(?:'((?:[^']|'')+)'!|([A-Za-z_][\w.]*)!)?\$?([A-Za-z]{1,3})\$?(\d+)(?![\w(])/;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const rest = src.slice(i);
    let m: RegExpExecArray | null;
    if ((m = /^\d+(\.\d+)?([eE][+-]?\d+)?|^\.\d+/.exec(rest))) {
      out.push({ t: 'num', v: Number(m[0]) });
      i += m[0].length;
    } else if (ch === '"') {
      let s = '';
      i++;
      for (;;) {
        if (i >= src.length) throw new Unsupported('unclosed text');
        if (src[i] === '"') {
          if (src[i + 1] === '"') {
            s += '"';
            i += 2;
            continue;
          }
          i++;
          break;
        }
        s += src[i++];
      }
      out.push({ t: 'str', v: s });
    } else if ((m = ref.exec(rest))) {
      out.push({ t: 'ref', sheet: m[1]?.replace(/''/g, "'") ?? m[2], col: colIndex(m[3]), row: Number(m[4]) });
      i += m[0].length;
    } else if ((m = /^(TRUE|FALSE)(?![\w(])/i.exec(rest))) {
      out.push({ t: 'bool', v: m[1].toUpperCase() === 'TRUE' });
      i += m[0].length;
    } else if ((m = /^([A-Za-z_][\w.]*)\s*\(/.exec(rest))) {
      out.push({ t: 'fn', v: m[1].toUpperCase().replace(/^_XLFN\./, '') });
      i += m[0].length;
    } else if ((m = /^(<=|>=|<>|[-+*/^&=<>%(),;:])/.exec(rest))) {
      out.push({ t: 'op', v: m[1] === ';' ? ',' : m[1] });
      i += m[0].length;
    } else {
      throw new Unsupported(`can't read "${rest.slice(0, 10)}"`);
    }
  }
  return out;
}

// ---------------------------------------------------------------- Parser → AST

type Node =
  | { k: 'lit'; v: Scalar }
  | { k: 'ref'; sheet?: string; col: number; row: number }
  | { k: 'range'; sheet?: string; c1: number; r1: number; c2: number; r2: number }
  | { k: 'un'; op: string; a: Node }
  | { k: 'bin'; op: string; a: Node; b: Node }
  | { k: 'call'; name: string; args: Node[] };

const PREC: Record<string, number> = { '=': 1, '<>': 1, '<': 1, '>': 1, '<=': 1, '>=': 1, '&': 2, '+': 3, '-': 3, '*': 4, '/': 4, '^': 5 };

function parse(tokens: Tok[]): Node {
  let p = 0;
  const peek = () => tokens[p];
  const isOp = (v: string) => peek()?.t === 'op' && (peek() as { v: string }).v === v;
  const expect = (v: string) => {
    if (!isOp(v)) throw new Unsupported(`expected ${v}`);
    p++;
  };

  const primary = (): Node => {
    const tok = tokens[p++];
    if (!tok) throw new Unsupported('unexpected end');
    switch (tok.t) {
      case 'num':
        return { k: 'lit', v: tok.v };
      case 'str':
        return { k: 'lit', v: tok.v };
      case 'bool':
        return { k: 'lit', v: tok.v };
      case 'ref': {
        if (isOp(':') && tokens[p + 1]?.t === 'ref') {
          p++;
          const b = tokens[p++] as Extract<Tok, { t: 'ref' }>;
          return { k: 'range', sheet: tok.sheet, c1: Math.min(tok.col, b.col), r1: Math.min(tok.row, b.row), c2: Math.max(tok.col, b.col), r2: Math.max(tok.row, b.row) };
        }
        return { k: 'ref', sheet: tok.sheet, col: tok.col, row: tok.row };
      }
      case 'fn': {
        const args: Node[] = [];
        if (!isOp(')')) {
          for (;;) {
            // Empty argument, e.g. VLOOKUP(a,b,2,)
            if (isOp(',') || isOp(')')) args.push({ k: 'lit', v: null });
            else args.push(expr(0));
            if (isOp(',')) {
              p++;
              continue;
            }
            break;
          }
        }
        expect(')');
        return { k: 'call', name: tok.v, args };
      }
      case 'op':
        if (tok.v === '(') {
          const e = expr(0);
          expect(')');
          return e;
        }
        if (tok.v === '-' || tok.v === '+') return { k: 'un', op: tok.v, a: unary() };
        throw new Unsupported(`unexpected ${tok.v}`);
    }
  };

  // Unary minus binds tighter than ^ in Excel (-2^2 = 4).
  const unary = (): Node => {
    let n = primary();
    while (isOp('%')) {
      p++;
      n = { k: 'un', op: '%', a: n };
    }
    return n;
  };

  const expr = (min: number): Node => {
    let left = unary();
    for (;;) {
      const tok = peek();
      if (tok?.t !== 'op' || !(tok.v in PREC) || PREC[tok.v] < min) break;
      p++;
      const prec = PREC[tok.v];
      const right = expr(tok.v === '^' ? prec : prec + 1);
      left = { k: 'bin', op: tok.v, a: left, b: right };
    }
    return left;
  };

  const node = expr(0);
  if (p < tokens.length) throw new Unsupported('extra text');
  return node;
}

// ---------------------------------------------------------------- Coercion

function num(v: Value): number | FormulaError {
  if (v instanceof FormulaError) return v;
  if (v === null || v === '') return 0;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number') return v;
  const s = v.trim().replace(/,/g, '');
  const pct = /%$/.test(s);
  const n = Number(pct ? s.slice(0, -1) : s);
  return s && Number.isFinite(n) ? (pct ? n / 100 : n) : err('#VALUE!');
}
const text = (v: Value): string => (v === null ? '' : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : typeof v === 'number' ? String(Math.round(v * 1e10) / 1e10) : String(v));
function bool(v: Value): boolean | FormulaError {
  if (v instanceof FormulaError) return v;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    if (/^true$/i.test(v)) return true;
    if (/^false$/i.test(v)) return false;
    return err('#VALUE!');
  }
  return Boolean(v);
}
function compare(a: Value, b: Value): number {
  const rank = (v: Value) => (typeof v === 'number' || v === null ? 0 : typeof v === 'string' ? 1 : 2);
  if (a === null && typeof b === 'string') a = '';
  if (b === null && typeof a === 'string') b = '';
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b, undefined, { sensitivity: 'accent' });
  const x = Number(a ?? 0);
  const y = Number(b ?? 0);
  return x === y ? 0 : x < y ? -1 : 1;
}
const flat = (vals: Any[]): Value[] => vals.flatMap((v) => (isRange(v) ? v.rows.flat() : [v]));
/** Numbers from arguments: numbers in ranges count; text and blanks in ranges are skipped. */
function numbers(args: Any[]): number[] | FormulaError {
  const out: number[] = [];
  for (const a of args) {
    if (isRange(a)) {
      for (const v of a.rows.flat()) {
        if (v instanceof FormulaError) return v;
        if (typeof v === 'number') out.push(v);
      }
    } else {
      const n = num(a);
      if (n instanceof FormulaError) return n;
      out.push(n);
    }
  }
  return out;
}

/** COUNTIF-style criteria: 60, ">=60", "<>Done", "PASS", "A*". */
function criteria(c: Value): (v: Value) => boolean {
  if (typeof c === 'number' || typeof c === 'boolean') return (v) => compare(v, c) === 0;
  const m = /^(<=|>=|<>|=|<|>)?(.*)$/s.exec(text(c))!;
  const op = m[1] || '=';
  const rhsText = m[2];
  const rhsNum = rhsText.trim() !== '' && Number.isFinite(Number(rhsText)) ? Number(rhsText) : null;
  const wild = /[*?]/.test(rhsText) ? new RegExp(`^${rhsText.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`, 'i') : null;
  return (v) => {
    if (v instanceof FormulaError) return false;
    if (wild && (op === '=' || op === '<>')) return wild.test(text(v)) === (op === '=');
    const rhs: Value = rhsNum !== null && typeof v === 'number' ? rhsNum : rhsNum !== null && v === null ? rhsNum : rhsText;
    if (rhsNum !== null && typeof v === 'string' && op !== '=' && op !== '<>') return false;
    const d = compare(v === null && rhs === '' ? '' : v, rhs);
    switch (op) {
      case '=': return d === 0;
      case '<>': return d !== 0;
      case '<': return d < 0;
      case '>': return d > 0;
      case '<=': return d <= 0;
      default: return d >= 0;
    }
  };
}

const round = (n: number, digits: number, mode: 'near' | 'up' | 'down' = 'near') => {
  const f = 10 ** digits;
  const x = Math.abs(n) * f;
  const r = mode === 'up' ? Math.ceil(x - 1e-9) : mode === 'down' ? Math.floor(x + 1e-9) : Math.round(x + 1e-9);
  return (Math.sign(n) * r) / f;
};

// ---------------------------------------------------------------- Evaluation

export class Workbook {
  private sheets = new Map<string, SheetSpec>();
  private cache = new Map<string, Value>();
  private busy = new Set<string>();

  constructor(sheets: SheetSpec[]) {
    for (const s of sheets) this.sheets.set(s.name.toLowerCase(), s);
  }

  private sheet(name: string | undefined, current: SheetSpec): SheetSpec {
    if (!name) return current;
    const s = this.sheets.get(name.toLowerCase());
    if (!s) throw new Unsupported(`no sheet ${name}`);
    return s;
  }

  /** Value of a cell (1-based row as Excel numbers it). */
  cell(sheet: SheetSpec, col: number, row: number): Value {
    const key = `${sheet.name}!${col}:${row}`;
    if (this.cache.has(key)) return this.cache.get(key)!;
    const { headerRow, first, last, totalsRow } = layout(sheet);
    let v: Value = null;
    if (row === headerRow) v = sheet.columns[col]?.header ?? null;
    else if (row === 1 && sheet.title) v = col === 0 ? sheet.title : null;
    else if (row === 2 && sheet.subtitle && sheet.title) v = col === 0 ? sheet.subtitle : null;
    else if (row >= first && row <= last) {
      const raw = sheet.rows[row - first]?.[col]?.value ?? null;
      if (typeof raw === 'string' && raw.trim().startsWith('=')) {
        if (this.busy.has(key)) return err('#REF!'); // circular
        this.busy.add(key);
        try {
          v = this.formula(sheet, raw.trim(), row);
        } finally {
          this.busy.delete(key);
        }
      } else if (typeof raw === 'string' && sheet.columns[col] && sheet.columns[col].type !== 'text' && sheet.columns[col].type !== 'date') {
        const n = num(raw);
        v = n instanceof FormulaError ? raw : n;
      } else v = raw;
    } else if (row === totalsRow && sheet.totals) {
      // Same totals the Excel file gets (see xlsx.ts).
      const c = sheet.columns[col];
      const numeric = c && ['number', 'integer', 'currency', 'percent'].includes(c.type);
      const fn = c?.total && c.total !== 'none' ? c.total : numeric ? (c.type === 'percent' ? 'average' : 'sum') : null;
      const name = fn ? { sum: 'SUM', average: 'AVERAGE', min: 'MIN', max: 'MAX', count: 'COUNTA' }[fn] : null;
      if (name) v = this.formula(sheet, `=${name}(${colLetter(col)}${first}:${colLetter(col)}${last})`, row);
    }
    this.cache.set(key, v);
    return v;
  }

  /** Works out a formula ("=…") written for `row` of `sheet`. Throws Unsupported if it can't. */
  formula(sheet: SheetSpec, formula: string, row: number): Value {
    const { first, last } = layout(sheet);
    const src = fillFormula(formula.replace(/^=/, ''), row, first, last);
    const v = this.eval(parse(tokenize(src)), sheet);
    return isRange(v) ? (v.rows[0]?.[0] ?? null) : v;
  }

  private range(n: Extract<Node, { k: 'range' }>, current: SheetSpec): Range {
    const s = this.sheet(n.sheet, current);
    const { last, totalsRow } = layout(s);
    // Whole-column style ranges (A2:A1000) only need the rows that exist.
    const r2 = Math.min(n.r2, s.totals ? totalsRow : last);
    if ((n.c2 - n.c1 + 1) * Math.max(0, r2 - n.r1 + 1) > 100_000) throw new Unsupported('range too big');
    const rows: Value[][] = [];
    for (let r = n.r1; r <= r2; r++) {
      const line: Value[] = [];
      for (let c = n.c1; c <= n.c2; c++) line.push(this.cell(s, c, r));
      rows.push(line);
    }
    return { rows };
  }

  private eval(n: Node, s: SheetSpec): Any {
    switch (n.k) {
      case 'lit':
        return n.v;
      case 'ref':
        return this.cell(this.sheet(n.sheet, s), n.col, n.row);
      case 'range':
        return this.range(n, s);
      case 'un': {
        const a = this.scalar(n.a, s);
        const x = num(a);
        if (x instanceof FormulaError) return x;
        return n.op === '-' ? -x : n.op === '%' ? x / 100 : x;
      }
      case 'bin': {
        const a = this.scalar(n.a, s);
        const b = this.scalar(n.b, s);
        if (a instanceof FormulaError) return a;
        if (b instanceof FormulaError) return b;
        if (n.op === '&') return text(a) + text(b);
        if (['=', '<>', '<', '>', '<=', '>='].includes(n.op)) {
          const d = compare(a, b);
          return n.op === '=' ? d === 0 : n.op === '<>' ? d !== 0 : n.op === '<' ? d < 0 : n.op === '>' ? d > 0 : n.op === '<=' ? d <= 0 : d >= 0;
        }
        const x = num(a);
        const y = num(b);
        if (x instanceof FormulaError) return x;
        if (y instanceof FormulaError) return y;
        switch (n.op) {
          case '+': return x + y;
          case '-': return x - y;
          case '*': return x * y;
          case '/': return y === 0 ? err('#DIV/0!') : x / y;
          default: return x ** y;
        }
      }
      case 'call':
        return this.call(n.name, n.args, s);
    }
  }

  /** A single value (a range used as a value takes its first cell). */
  private scalar(n: Node, s: SheetSpec): Value {
    const v = this.eval(n, s);
    return isRange(v) ? (v.rows[0]?.[0] ?? null) : v;
  }

  private call(name: string, args: Node[], s: SheetSpec): Any {
    const val = (i: number) => (args[i] ? this.scalar(args[i], s) : null);
    const all = () => args.map((a) => this.eval(a, s));
    const rangeArg = (i: number): Range => {
      const v = args[i] ? this.eval(args[i], s) : null;
      return isRange(v) ? v : { rows: [[v as Value]] };
    };
    const numArg = (i: number, fallback?: number): number | FormulaError => (args[i] === undefined && fallback !== undefined ? fallback : num(val(i)));
    const agg = (f: (xs: number[]) => Value) => {
      const xs = numbers(all());
      return xs instanceof FormulaError ? xs : f(xs);
    };
    switch (name) {
      case 'SUM': return agg((xs) => xs.reduce((a, b) => a + b, 0));
      case 'AVERAGE': return agg((xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : err('#DIV/0!')));
      case 'MIN': return agg((xs) => (xs.length ? Math.min(...xs) : 0));
      case 'MAX': return agg((xs) => (xs.length ? Math.max(...xs) : 0));
      case 'MEDIAN': return agg((xs) => {
        if (!xs.length) return err('#NUM!');
        const o = [...xs].sort((a, b) => a - b);
        const m = Math.floor(o.length / 2);
        return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
      });
      case 'PRODUCT': return agg((xs) => xs.reduce((a, b) => a * b, 1));
      case 'COUNT': return flat(all()).filter((v) => typeof v === 'number').length;
      case 'COUNTA': return flat(all()).filter((v) => v !== null && v !== '').length;
      case 'COUNTBLANK': return flat(all()).filter((v) => v === null || v === '').length;
      case 'IF': {
        const c = bool(val(0));
        if (c instanceof FormulaError) return c;
        return c ? (args[1] ? this.eval(args[1], s) : true) : args[2] ? this.eval(args[2], s) : false;
      }
      case 'IFS': {
        for (let i = 0; i + 1 < args.length; i += 2) {
          const c = bool(val(i));
          if (c instanceof FormulaError) return c;
          if (c) return this.eval(args[i + 1], s);
        }
        return err('#N/A');
      }
      case 'IFERROR': {
        const v = val(0);
        return v instanceof FormulaError ? val(1) : v;
      }
      case 'IFNA': {
        const v = val(0);
        return v instanceof FormulaError && v.code === '#N/A' ? val(1) : v;
      }
      case 'AND':
      case 'OR': {
        const bs = flat(all()).filter((v) => v !== null).map(bool);
        const e = bs.find((b) => b instanceof FormulaError);
        if (e) return e as FormulaError;
        return name === 'AND' ? bs.every(Boolean) : bs.some(Boolean);
      }
      case 'NOT': {
        const b = bool(val(0));
        return b instanceof FormulaError ? b : !b;
      }
      case 'ROUND':
      case 'ROUNDUP':
      case 'ROUNDDOWN': {
        const x = numArg(0);
        const d = numArg(1, 0);
        if (x instanceof FormulaError) return x;
        if (d instanceof FormulaError) return d;
        return round(x, d, name === 'ROUNDUP' ? 'up' : name === 'ROUNDDOWN' ? 'down' : 'near');
      }
      case 'INT': {
        const x = numArg(0);
        return x instanceof FormulaError ? x : Math.floor(x);
      }
      case 'ABS': {
        const x = numArg(0);
        return x instanceof FormulaError ? x : Math.abs(x);
      }
      case 'SQRT': {
        const x = numArg(0);
        return x instanceof FormulaError ? x : x < 0 ? err('#NUM!') : Math.sqrt(x);
      }
      case 'POWER': {
        const x = numArg(0);
        const y = numArg(1);
        return x instanceof FormulaError ? x : y instanceof FormulaError ? y : x ** y;
      }
      case 'MOD': {
        const x = numArg(0);
        const y = numArg(1);
        if (x instanceof FormulaError) return x;
        if (y instanceof FormulaError) return y;
        return y === 0 ? err('#DIV/0!') : x - y * Math.floor(x / y);
      }
      case 'COUNTIF':
      case 'SUMIF':
      case 'AVERAGEIF': {
        const test = criteria(val(1));
        const where = rangeArg(0).rows.flat();
        const sumRows = name === 'COUNTIF' ? where : (args[2] ? rangeArg(2) : rangeArg(0)).rows.flat();
        const hits = where.map((v, i) => (test(v) ? sumRows[i] : undefined)).filter((v) => v !== undefined);
        if (name === 'COUNTIF') return hits.length;
        const xs = hits.filter((v): v is number => typeof v === 'number');
        if (name === 'SUMIF') return xs.reduce((a, b) => a + b, 0);
        return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : err('#DIV/0!');
      }
      case 'COUNTIFS':
      case 'SUMIFS':
      case 'AVERAGEIFS': {
        const offset = name === 'COUNTIFS' ? 0 : 1;
        const target = name === 'COUNTIFS' ? null : rangeArg(0).rows.flat();
        const pairs: [Value[], (v: Value) => boolean][] = [];
        for (let i = offset; i + 1 < args.length; i += 2) pairs.push([rangeArg(i).rows.flat(), criteria(val(i + 1))]);
        const size = pairs[0]?.[0].length ?? 0;
        const idx = Array.from({ length: size }, (_, i) => i).filter((i) => pairs.every(([r, t]) => t(r[i] ?? null)));
        if (name === 'COUNTIFS') return idx.length;
        const xs = idx.map((i) => target![i]).filter((v): v is number => typeof v === 'number');
        if (name === 'SUMIFS') return xs.reduce((a, b) => a + b, 0);
        return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : err('#DIV/0!');
      }
      case 'VLOOKUP':
      case 'HLOOKUP': {
        const key = val(0);
        let table = rangeArg(1).rows;
        if (name === 'HLOOKUP') table = table[0]?.map((_, c) => table.map((r) => r[c])) ?? [];
        const n = numArg(2);
        if (n instanceof FormulaError) return n;
        const approx = args[3] === undefined || val(3) === null ? true : bool(val(3)) === true;
        let hit = -1;
        if (approx) {
          for (let i = 0; i < table.length; i++) {
            if (compare(table[i][0], key) <= 0) hit = i;
            else break;
          }
        } else hit = table.findIndex((r) => compare(r[0], key) === 0);
        if (hit < 0) return err('#N/A');
        return table[hit][n - 1] ?? err('#REF!');
      }
      case 'MATCH': {
        const key = val(0);
        const list = rangeArg(1).rows.flat();
        const type = numArg(2, 1);
        if (type instanceof FormulaError) return type;
        if (type === 0) {
          const i = list.findIndex((v) => compare(v, key) === 0);
          return i < 0 ? err('#N/A') : i + 1;
        }
        let hit = -1;
        for (let i = 0; i < list.length; i++) if (type > 0 ? compare(list[i], key) <= 0 : compare(list[i], key) >= 0) hit = i;
        return hit < 0 ? err('#N/A') : hit + 1;
      }
      case 'INDEX': {
        const t = rangeArg(0).rows;
        const r = numArg(1);
        const c = numArg(2, 1);
        if (r instanceof FormulaError) return r;
        if (c instanceof FormulaError) return c;
        const row = t.length === 1 && args[2] === undefined ? t[0] : t[r - 1];
        const v = t.length === 1 && args[2] === undefined ? row?.[r - 1] : row?.[c - 1];
        return v === undefined ? err('#REF!') : v;
      }
      case 'XLOOKUP': {
        const key = val(0);
        const look = rangeArg(1).rows.flat();
        const ret = rangeArg(2).rows.flat();
        const i = look.findIndex((v) => compare(v, key) === 0);
        return i < 0 ? (args[3] ? val(3) : err('#N/A')) : (ret[i] ?? err('#REF!'));
      }
      case 'RANK':
      case 'RANK.EQ': {
        const x = numArg(0);
        if (x instanceof FormulaError) return x;
        const xs = rangeArg(1).rows.flat().filter((v): v is number => typeof v === 'number');
        const asc = args[2] !== undefined && num(val(2)) !== 0;
        return 1 + xs.filter((v) => (asc ? v < x : v > x)).length;
      }
      case 'CONCAT':
      case 'CONCATENATE': return flat(all()).map(text).join('');
      case 'TEXTJOIN': {
        const sep = text(val(0));
        const skip = bool(val(1)) === true;
        return flat(args.slice(2).map((a) => this.eval(a, s))).filter((v) => !skip || (v !== null && v !== '')).map(text).join(sep);
      }
      case 'LEN': return text(val(0)).length;
      case 'UPPER': return text(val(0)).toUpperCase();
      case 'LOWER': return text(val(0)).toLowerCase();
      case 'PROPER': return text(val(0)).toLowerCase().replace(/(^|[^\p{L}])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
      case 'TRIM': return text(val(0)).trim().replace(/\s+/g, ' ');
      case 'LEFT':
      case 'RIGHT': {
        const t = text(val(0));
        const k = numArg(1, 1);
        if (k instanceof FormulaError) return k;
        return name === 'LEFT' ? t.slice(0, k) : k ? t.slice(-k) : '';
      }
      case 'MID': {
        const st = numArg(1);
        const k = numArg(2);
        if (st instanceof FormulaError) return st;
        if (k instanceof FormulaError) return k;
        return text(val(0)).substr(st - 1, k);
      }
      case 'TEXT': {
        const x = num(val(0));
        const fmt = text(val(1));
        if (x instanceof FormulaError) return text(val(0));
        if (/%$/.test(fmt)) return `${round(x * 100, (fmt.split('.')[1] || '').replace('%', '').length)}%`;
        const dec = (fmt.split('.')[1] || '').replace(/[^0#]/g, '').length;
        return x.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: fmt.includes(',') });
      }
      case 'VALUE': return num(val(0));
      case 'ISBLANK': {
        const v = val(0);
        return v === null || v === '';
      }
      case 'ISNUMBER': return typeof val(0) === 'number';
      case 'ISTEXT': return typeof val(0) === 'string';
      case 'ISERROR': return val(0) instanceof FormulaError;
      case 'PI': return Math.PI;
      default:
        throw new Unsupported(`function ${name}`);
    }
  }
}

function colLetter(i: number): string {
  let out = '';
  for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) out = String.fromCharCode(65 + ((i - 1) % 26)) + out;
  return out;
}

/** Result of a data cell's formula, or undefined when it can't be worked out here. */
export function formulaResult(book: Workbook, sheet: SheetSpec, formula: string, row: number): Value | undefined {
  try {
    const v = book.formula(sheet, formula, row);
    return typeof v === 'number' && !Number.isFinite(v) ? err('#NUM!') : v;
  } catch (e) {
    if (e instanceof Unsupported) return undefined;
    throw e;
  }
}
