// Workbook spec → real Excel file with colours, number formats, formulas, totals and conditional formatting.

import ExcelJS from 'exceljs';
import { colLetter, fillFormula, layout, numFmt, parseNumber, type SheetSpec, type WorkbookSpec } from './sheet-spec';

const argb = (hex: string) => `FF${hex}`;
const FONT = { name: 'Calibri', size: 11 };
const thin = (color = 'D0D5DD') => ({ style: 'thin' as const, color: { argb: argb(color) } });

function cellValue(raw: unknown, type: string, row: number, first: number, last: number): ExcelJS.CellValue {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'string' && raw.trim().startsWith('=')) {
    return { formula: fillFormula(raw.trim().slice(1), row, first, last) } as ExcelJS.CellFormulaValue;
  }
  if (typeof raw === 'string' && type === 'date' && /^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const d = new Date(raw.length === 10 ? `${raw}T00:00:00Z` : raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (typeof raw === 'string' && type !== 'text') {
    const n = parseNumber(raw);
    if (n) return n.value;
  }
  return raw as ExcelJS.CellValue;
}

function addSheet(wb: ExcelJS.Workbook, s: SheetSpec) {
  const { headerRow, first, last, totalsRow } = layout(s);
  const ncols = Math.max(s.columns.length, 1);
  const ws = wb.addWorksheet(s.name, {
    views: [{ rightToLeft: s.rtl, state: s.freeze ? 'frozen' : 'normal', ySplit: s.freeze ? headerRow : 0, showGridLines: false }],
    properties: { defaultRowHeight: 18 },
  });

  if (s.title) {
    ws.mergeCells(1, 1, 1, ncols);
    const c = ws.getCell(1, 1);
    c.value = s.title;
    c.font = { ...FONT, size: 16, bold: true, color: { argb: argb(s.headerFill) } };
    c.alignment = { vertical: 'middle', horizontal: s.rtl ? 'right' : 'left' };
    ws.getRow(1).height = 26;
    if (s.subtitle) {
      ws.mergeCells(2, 1, 2, ncols);
      const sc = ws.getCell(2, 1);
      sc.value = s.subtitle;
      sc.font = { ...FONT, italic: true, color: { argb: 'FF666666' } };
      sc.alignment = { horizontal: s.rtl ? 'right' : 'left' };
    }
  }

  // Header
  const hr = ws.getRow(headerRow);
  s.columns.forEach((col, i) => {
    const c = hr.getCell(i + 1);
    c.value = col.header;
    c.font = { ...FONT, bold: true, color: { argb: argb(s.headerColor) } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(s.headerFill) } };
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    c.border = { top: thin(s.headerFill), bottom: thin(s.headerFill), left: thin(s.headerFill), right: thin(s.headerFill) };
  });
  hr.height = 24;

  // Data
  s.rows.forEach((row, ri) => {
    const r = ws.getRow(first + ri);
    s.columns.forEach((col, ci) => {
      const spec = row[ci] || { value: null };
      const c = r.getCell(ci + 1);
      c.value = cellValue(spec.value, col.type, first + ri, first, last);
      const fmt = numFmt(col);
      if (fmt) c.numFmt = fmt;
      const fill = spec.fill || (s.zebra && ri % 2 === 1 ? s.zebra : null);
      if (fill) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(fill) } };
      c.font = { ...FONT, color: spec.color ? { argb: argb(spec.color) } : undefined, bold: spec.bold, italic: spec.italic };
      c.border = { top: thin(), bottom: thin(), left: thin(), right: thin() };
      const horizontal = col.align || (col.type === 'text' ? undefined : col.type === 'date' ? 'center' : 'right');
      c.alignment = { vertical: 'top', horizontal, wrapText: col.type === 'text' };
      if (spec.note) c.note = spec.note;
    });
  });

  // Totals
  if (s.totals && s.rows.length) {
    const r = ws.getRow(totalsRow);
    let labelled = false;
    s.columns.forEach((col, ci) => {
      const c = r.getCell(ci + 1);
      const numeric = ['number', 'integer', 'currency', 'percent'].includes(col.type);
      const fn = col.total && col.total !== 'none' ? col.total : numeric && col.type !== 'percent' ? 'sum' : col.type === 'percent' ? 'average' : null;
      const letter = colLetter(ci);
      if (fn) {
        const name = { sum: 'SUM', average: 'AVERAGE', min: 'MIN', max: 'MAX', count: 'COUNTA' }[fn];
        c.value = { formula: `${name}(${letter}${first}:${letter}${last})` } as ExcelJS.CellFormulaValue;
        const fmt = numFmt(col);
        if (fmt) c.numFmt = fmt;
      } else if (!labelled) {
        c.value = s.rtl ? 'الإجمالي' : 'Total';
        labelled = true;
      }
      c.font = { ...FONT, bold: true };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8ECF2' } };
      c.border = { top: { style: 'double', color: { argb: argb(s.headerFill) } }, bottom: thin(), left: thin(), right: thin() };
      c.alignment = { horizontal: fn ? 'right' : undefined };
    });
  }

  // Column widths
  s.columns.forEach((col, ci) => {
    const longest = Math.max(
      col.header.length,
      ...s.rows.slice(0, 200).map((r) => {
        const v = r[ci]?.value;
        if (typeof v === 'number') return v.toLocaleString('en-US', { maximumFractionDigits: 2 }).length + (col.type === 'currency' ? 5 : 1);
        return String(v ?? '').length;
      }),
    );
    ws.getColumn(ci + 1).width = col.width || Math.min(60, Math.max(10, longest + 3));
  });

  if (s.filter && s.rows.length) ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: last, column: ncols } };

  // Conditional formatting
  for (const cf of s.conditional) {
    const letter = colLetter(cf.column);
    const ref = `${letter}${first}:${letter}${last}`;
    const style = {
      fill: { type: 'pattern' as const, pattern: 'solid' as const, bgColor: { argb: argb(cf.fill || 'F8CBAD') } },
      font: cf.color ? { color: { argb: argb(cf.color) } } : undefined,
    };
    const v = (x: unknown) => (typeof x === 'number' ? String(x) : `"${String(x ?? '').replace(/"/g, '""')}"`);
    let rule: any = null;
    if (cf.type === 'colorScale') {
      rule = { type: 'colorScale', priority: 1, cfvo: [{ type: 'min' }, { type: 'percentile', value: 50 }, { type: 'max' }], color: [{ argb: 'FFF8696B' }, { argb: 'FFFFEB84' }, { argb: 'FF63BE7B' }] };
    } else if (cf.type === 'dataBar') {
      rule = { type: 'dataBar', priority: 1, minLength: 0, maxLength: 100, cfvo: [{ type: 'min' }, { type: 'max' }], color: { argb: argb(cf.fill || cf.color || '5B9BD5') }, gradient: true };
    } else if (cf.type === 'greaterThan' || cf.type === 'lessThan' || cf.type === 'equals') {
      rule = { type: 'cellIs', priority: 1, operator: cf.type === 'equals' ? 'equal' : cf.type, formulae: [v(cf.value)], style };
    } else if (cf.type === 'between') {
      rule = { type: 'cellIs', priority: 1, operator: 'between', formulae: [v(cf.value), v(cf.value2)], style };
    } else if (cf.type === 'contains') {
      rule = { type: 'containsText', priority: 1, operator: 'containsText', text: String(cf.value ?? ''), style };
    }
    if (rule) ws.addConditionalFormatting({ ref, rules: [rule] });
  }

  ws.pageSetup = { orientation: ncols > 6 ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: `${headerRow}:${headerRow}` };
}

export async function buildXlsx(spec: WorkbookSpec): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'TheModelRouter';
  wb.created = new Date();
  for (const s of spec.sheets) addSheet(wb, s);
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
