import { useMemo, useState } from 'react';
import { colLetter, fillFormula, layout, parseWorkbook, type CellSpec, type ColumnSpec, type SheetSpec } from '../lib/generate/sheet-spec';

function format(v: CellSpec['value'], col: ColumnSpec): string {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'string' && v.startsWith('=')) return v;
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') {
    if (col.type === 'percent') return `${(v * 100).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
    if (col.type === 'currency') return `${col.currency ? `${col.currency} ` : ''}${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (col.type === 'integer') return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
    return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(v);
}

/** Tiny evaluator so totals and simple formulas show a value in the preview. */
function evaluate(sheet: SheetSpec, formula: string, row: number): number | null {
  const { first, last } = layout(sheet);
  const f = fillFormula(formula.slice(1), row, first, last).toUpperCase().replace(/\s+/g, '');
  const cellVal = (ref: string): number => {
    const m = /^([A-Z]+)(\d+)$/.exec(ref);
    if (!m) return NaN;
    const col = m[1].split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
    const v = sheet.rows[Number(m[2]) - first]?.[col]?.value;
    return typeof v === 'number' ? v : typeof v === 'string' && v.startsWith('=') ? evaluate(sheet, v, Number(m[2])) ?? NaN : Number(v);
  };
  const range = (a: string, b: string): number[] => {
    const ma = /^([A-Z]+)(\d+)$/.exec(a);
    const mb = /^([A-Z]+)(\d+)$/.exec(b);
    if (!ma || !mb || ma[1] !== mb[1]) return [];
    const out: number[] = [];
    for (let r = Number(ma[2]); r <= Number(mb[2]); r++) out.push(cellVal(`${ma[1]}${r}`));
    return out.filter((n) => !Number.isNaN(n));
  };
  const fn = /^(SUM|AVERAGE|MIN|MAX|COUNT|COUNTA)\(([A-Z]+\d+):([A-Z]+\d+)\)$/.exec(f);
  if (fn) {
    const vals = range(fn[2], fn[3]);
    if (!vals.length) return null;
    switch (fn[1]) {
      case 'SUM': return vals.reduce((a, b) => a + b, 0);
      case 'AVERAGE': return vals.reduce((a, b) => a + b, 0) / vals.length;
      case 'MIN': return Math.min(...vals);
      case 'MAX': return Math.max(...vals);
      default: return vals.length;
    }
  }
  if (/^[A-Z0-9+\-*/().]+$/.test(f)) {
    const expr = f.replace(/[A-Z]+\d+/g, (ref) => String(cellVal(ref)));
    if (/^[0-9+\-*/().eE]+$/.test(expr)) {
      try {
        const v = Function(`"use strict";return (${expr})`)();
        return typeof v === 'number' && Number.isFinite(v) ? v : null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

function Sheet({ sheet }: { sheet: SheetSpec }) {
  const { first } = layout(sheet);
  const numericCols = sheet.columns.map((c) => ['number', 'integer', 'currency', 'percent'].includes(c.type));

  const values = sheet.rows.map((r, ri) =>
    sheet.columns.map((_, ci) => {
      const v = r[ci]?.value;
      if (typeof v === 'string' && v.startsWith('=')) return evaluate(sheet, v, first + ri) ?? v;
      return v ?? null;
    }),
  );

  const stats = sheet.columns.map((_, ci) => {
    const nums = values.map((r) => r[ci]).filter((v): v is number => typeof v === 'number');
    return { min: Math.min(...nums), max: Math.max(...nums) };
  });

  const condStyle = (ci: number, v: unknown): React.CSSProperties => {
    const style: React.CSSProperties = {};
    for (const c of sheet.conditional.filter((x) => x.column === ci)) {
      const n = typeof v === 'number' ? v : NaN;
      const { min, max } = stats[ci];
      const t = max > min ? (n - min) / (max - min) : 0.5;
      if (c.type === 'colorScale' && !Number.isNaN(n)) style.background = `hsl(${Math.round(t * 120)} 65% 72%)`;
      else if (c.type === 'dataBar' && !Number.isNaN(n)) style.background = `linear-gradient(90deg, #${c.fill || c.color || '5B9BD5'}88 ${Math.round(t * 100)}%, transparent ${Math.round(t * 100)}%)`;
      else {
        const hit =
          (c.type === 'greaterThan' && n > Number(c.value)) ||
          (c.type === 'lessThan' && n < Number(c.value)) ||
          (c.type === 'between' && n >= Number(c.value) && n <= Number(c.value2)) ||
          (c.type === 'equals' && String(v) === String(c.value)) ||
          (c.type === 'contains' && String(v ?? '').includes(String(c.value ?? '')));
        if (hit) {
          style.background = `#${c.fill || 'F8CBAD'}`;
          if (c.color) style.color = `#${c.color}`;
        }
      }
    }
    return style;
  };

  const totals = sheet.totals
    ? sheet.columns.map((col, ci) => {
        const nums = values.map((r) => r[ci]).filter((v): v is number => typeof v === 'number');
        const fn = col.total && col.total !== 'none' ? col.total : numericCols[ci] ? (col.type === 'percent' ? 'average' : 'sum') : null;
        if (!fn || !nums.length) return null;
        const sum = nums.reduce((a, b) => a + b, 0);
        return { sum, average: sum / nums.length, min: Math.min(...nums), max: Math.max(...nums), count: nums.length }[fn] ?? null;
      })
    : null;

  return (
    <div className="sheet-scroll" dir={sheet.rtl ? 'rtl' : 'ltr'}>
      {sheet.title && <div className="sheet-title" style={{ color: `#${sheet.headerFill}` }}>{sheet.title}</div>}
      {sheet.subtitle && <div className="sheet-subtitle">{sheet.subtitle}</div>}
      <table className="sheet">
        <thead>
          <tr>
            <th className="rownum" />
            {sheet.columns.map((c, i) => (
              <th key={i} style={{ background: `#${sheet.headerFill}`, color: `#${sheet.headerColor}`, minWidth: c.width ? c.width * 7 : undefined }}>
                <span className="col-letter">{colLetter(i)}</span>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sheet.rows.map((r, ri) => (
            <tr key={ri}>
              <td className="rownum">{first + ri}</td>
              {sheet.columns.map((col, ci) => {
                const cell = r[ci] || { value: null };
                const v = values[ri][ci];
                const style: React.CSSProperties = {
                  background: cell.fill ? `#${cell.fill}` : sheet.zebra && ri % 2 ? `#${sheet.zebra}` : undefined,
                  color: cell.color ? `#${cell.color}` : undefined,
                  fontWeight: cell.bold ? 700 : undefined,
                  fontStyle: cell.italic ? 'italic' : undefined,
                  textAlign: col.align || (numericCols[ci] || col.type === 'date' ? (col.type === 'date' ? 'center' : 'end') : 'start'),
                  ...condStyle(ci, v),
                };
                return (
                  <td key={ci} style={style} title={cell.note || (typeof cell.value === 'string' && cell.value.startsWith('=') ? cell.value : undefined)}>
                    {format(v as CellSpec['value'], col)}
                    {cell.note && <span className="note-mark" />}
                  </td>
                );
              })}
            </tr>
          ))}
          {totals && (
            <tr className="totals">
              <td className="rownum">Σ</td>
              {sheet.columns.map((col, ci) => (
                <td key={ci} style={{ textAlign: totals[ci] !== null ? 'end' : 'start' }}>
                  {totals[ci] !== null ? format(totals[ci], col) : ci === totals.findIndex((x) => x === null) ? (sheet.rtl ? 'الإجمالي' : 'Total') : ''}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function SheetPreview({ content }: { content: string }) {
  const wb = useMemo(() => parseWorkbook(content), [content]);
  const [tab, setTab] = useState(0);
  if (!wb) return <p className="pad muted">This spreadsheet's data couldn't be read.</p>;
  const sheet = wb.sheets[Math.min(tab, wb.sheets.length - 1)];
  return (
    <div className="sheet-preview">
      <Sheet sheet={sheet} />
      {wb.sheets.length > 1 && (
        <div className="sheet-tabs" role="tablist">
          {wb.sheets.map((s, i) => (
            <button key={s.name} role="tab" aria-selected={i === tab} className={i === tab ? 'active' : ''} onClick={() => setTab(i)} dir="auto">
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
