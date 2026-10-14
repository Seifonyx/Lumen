// Deck spec → designed PowerPoint (16:9) with themed layouts, native charts and speaker notes.

import PptxGenJS from 'pptxgenjs';
import { isRtl } from '../util';
import type { Bullet, Deck, Slide } from './deck-spec';

const W = 13.333;
const H = 7.5;
const M = 0.6; // side margin

type PSlide = ReturnType<PptxGenJS['addSlide']>;

export async function buildPptx(deck: Deck): Promise<Blob> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.title = deck.title;
  pptx.author = 'Lumen';
  const t = deck.theme;
  const font = 'Calibri';

  const dir = (text: string) => (isRtl(text) ? { rtlMode: true, align: 'right' as const } : {});
  // A slide is laid out right-to-left when its visible text starts with Arabic/Hebrew.
  const rtlSlide = (s: Slide) => {
    const texts: string[] = [];
    const collect = (v: unknown, key = ''): void => {
      if (key === 'layout' || key === 'notes' || key === 'type') return;
      if (typeof v === 'string') texts.push(v);
      else if (Array.isArray(v)) v.forEach((x) => collect(x));
      else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => collect(x, k));
    };
    collect(s);
    return isRtl(texts.join(' '));
  };

  const footer = (slide: PSlide, n: number, rtl: boolean) => {
    slide.addText(deck.title, { x: rtl ? W - M - 6 : M, y: H - 0.5, w: 6, h: 0.3, fontSize: 10, color: t.muted, fontFace: font, align: rtl ? 'right' : 'left', ...(isRtl(deck.title) ? { rtlMode: true } : {}) });
    slide.addText(String(n), { x: rtl ? M : W - M - 1, y: H - 0.5, w: 1, h: 0.3, fontSize: 10, color: t.muted, fontFace: font, align: rtl ? 'left' : 'right' });
  };

  const header = (slide: PSlide, title: string, rtl: boolean) => {
    slide.background = { color: t.background };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.12, fill: { color: t.primary }, line: { color: t.primary } });
    slide.addText(title, { x: M, y: 0.45, w: W - 2 * M, h: 0.9, fontSize: title.length > 70 ? 22 : title.length > 45 ? 26 : 30, bold: true, color: t.dark ? t.text : t.primary, fontFace: font, valign: 'middle', ...dir(title) });
    slide.addShape(pptx.ShapeType.rect, { x: rtl ? W - M - 1.1 : M, y: 1.38, w: 1.1, h: 0.07, fill: { color: t.accent }, line: { color: t.accent } });
  };

  const bulletRuns = (list: Bullet[], size: number) =>
    list.flatMap((b) => [
      { text: b.text, options: { bullet: { indent: 18 }, fontSize: size, color: t.text, paraSpaceAfter: 10, breakLine: true, ...dir(b.text) } },
      ...b.sub.map((s) => ({ text: s, options: { bullet: { indent: 18 }, indentLevel: 1, fontSize: size - 3, color: t.muted, paraSpaceAfter: 4, breakLine: true, ...dir(s) } })),
    ]);

  const sizeFor = (list: Bullet[], base: number) => {
    const lines = list.reduce((n, b) => n + 1 + b.sub.length, 0);
    const chars = list.reduce((n, b) => n + b.text.length + b.sub.join('').length, 0);
    return Math.max(14, base - Math.max(0, lines - 5) * 1.5 - Math.max(0, chars - 350) / 60);
  };

  deck.slides.forEach((s, i) => {
    const slide = pptx.addSlide();
    const n = i + 1;
    const rtl = rtlSlide(s);
    if (s.notes) slide.addNotes(s.notes);

    switch (s.layout) {
      case 'title':
      case 'closing': {
        slide.background = { color: t.primary };
        slide.addShape(pptx.ShapeType.ellipse, { x: W - 4.2, y: -1.6, w: 6, h: 6, fill: { color: 'FFFFFF', transparency: 88 }, line: { color: t.primary, transparency: 100 } });
        slide.addShape(pptx.ShapeType.ellipse, { x: W - 2.4, y: 4.6, w: 3.6, h: 3.6, fill: { color: t.accent, transparency: 70 }, line: { color: t.primary, transparency: 100 } });
        slide.addShape(pptx.ShapeType.rect, { x: rtl ? W - M - 1.4 : M, y: 2.35, w: 1.4, h: 0.09, fill: { color: t.accent }, line: { color: t.accent } });
        slide.addText(s.title, { x: M, y: 2.55, w: W - 2 * M - 1.5, h: 1.6, fontSize: s.title.length > 60 ? 32 : s.title.length > 35 ? 38 : 44, bold: true, color: 'FFFFFF', fontFace: font, valign: 'top', ...dir(s.title) });
        if (s.subtitle) slide.addText(s.subtitle, { x: M, y: 4.2, w: W - 2 * M - 1.5, h: 1, fontSize: 20, color: 'E8EEF5', fontFace: font, valign: 'top', ...dir(s.subtitle) });
        break;
      }
      case 'section': {
        slide.background = { color: t.surface };
        slide.addShape(pptx.ShapeType.rect, { x: rtl ? W - 0.35 : 0, y: 0, w: 0.35, h: H, fill: { color: t.primary }, line: { color: t.primary } });
        slide.addText(String(n).padStart(2, '0'), { x: M + 0.2, y: 1.7, w: 3, h: 1, fontSize: 40, bold: true, color: t.accent, fontFace: font, align: rtl ? 'right' : 'left', ...(rtl ? { x: W - M - 3.2 } : {}) });
        slide.addText(s.title, { x: M + 0.2, y: 2.8, w: W - 2 * M - 0.4, h: 1.3, fontSize: 38, bold: true, color: t.dark ? t.text : t.primary, fontFace: font, ...dir(s.title) });
        if (s.subtitle) slide.addText(s.subtitle, { x: M + 0.2, y: 4.1, w: W - 2 * M - 0.4, h: 0.9, fontSize: 18, color: t.muted, fontFace: font, ...dir(s.subtitle) });
        footer(slide, n, rtl);
        break;
      }
      case 'bullets': {
        header(slide, s.title, rtl);
        const size = sizeFor(s.bullets, 22);
        slide.addText(bulletRuns(s.bullets, size), { x: M, y: 1.7, w: W - 2 * M, h: H - 2.5, valign: 'top', fontFace: font });
        footer(slide, n, rtl);
        break;
      }
      case 'two-column': {
        header(slide, s.title, rtl);
        const colW = (W - 2 * M - 0.5) / 2;
        const cols = rtl ? [[s.rightTitle, s.right], [s.leftTitle, s.left]] : [[s.leftTitle, s.left], [s.rightTitle, s.right]];
        cols.forEach(([title, list], ci) => {
          const x = M + ci * (colW + 0.5);
          slide.addShape(pptx.ShapeType.roundRect, { x, y: 1.7, w: colW, h: H - 2.5, fill: { color: t.surface }, line: { color: t.surface }, rectRadius: 0.12 });
          let y = 1.85;
          if (title) {
            slide.addText(title as string, { x: x + 0.25, y, w: colW - 0.5, h: 0.6, fontSize: 20, bold: true, color: ci === 0 ? t.primary : t.accent, fontFace: font, ...dir(title as string) });
            y += 0.65;
          }
          const items = list as Bullet[];
          slide.addText(bulletRuns(items, sizeFor(items, 18)), { x: x + 0.25, y, w: colW - 0.5, h: H - 0.8 - y, valign: 'top', fontFace: font });
        });
        footer(slide, n, rtl);
        break;
      }
      case 'table': {
        header(slide, s.title, rtl);
        const ncol = Math.max(s.header.length, ...s.rows.map((r) => r.length), 1);
        const size = s.rows.length > 10 ? 12 : s.rows.length > 6 ? 14 : 16;
        const order = <T,>(r: T[]) => (rtl ? [...r].reverse() : r);
        const cell = (text: string, opts: object) => ({ text, options: { ...opts, ...dir(text) } });
        const rows = [
          order(Array.from({ length: ncol }, (_, i) => cell(s.header[i] || '', { bold: true, color: 'FFFFFF', fill: { color: t.primary }, fontSize: size + 1 }))),
          ...s.rows.map((r, ri) => order(Array.from({ length: ncol }, (_, i) => cell(r[i] || '', { color: t.text, fill: { color: ri % 2 ? t.surface : t.background }, fontSize: size })))),
        ];
        slide.addTable(rows, { x: M, y: 1.75, w: W - 2 * M, fontFace: font, border: { type: 'solid', pt: 0.75, color: t.dark ? '334155' : 'D0D5DD' }, valign: 'middle', margin: 0.08, autoPage: false });
        footer(slide, n, rtl);
        break;
      }
      case 'chart': {
        header(slide, s.title, rtl);
        const c = s.chart;
        const type = ({ bar: 'bar', column: 'bar', horizontalBar: 'bar', line: 'line', area: 'area', pie: 'pie', doughnut: 'doughnut' } as const)[c.type];
        const round = c.type === 'pie' || c.type === 'doughnut';
        const data = c.series.map((ser) => ({ name: ser.name, labels: c.labels, values: ser.values }));
        const h = s.caption ? H - 3.1 : H - 2.6;
        slide.addChart(type, data, {
          x: M, y: 1.7, w: W - 2 * M, h,
          barDir: c.type === 'horizontalBar' ? 'bar' : 'col',
          chartColors: round ? t.palette.concat(t.palette) : t.palette,
          showLegend: round || c.series.length > 1,
          legendPos: 'b',
          legendColor: t.text,
          legendFontSize: 12,
          showValue: round || c.labels.length <= 8,
          showPercent: round,
          dataLabelColor: round ? 'FFFFFF' : t.text,
          dataLabelFontSize: 11,
          catAxisLabelColor: t.muted,
          valAxisLabelColor: t.muted,
          catAxisLabelFontSize: 12,
          valAxisLabelFontSize: 11,
          valGridLine: { color: t.dark ? '334155' : 'E5E7EB', size: 0.75 },
          catGridLine: { style: 'none' },
          lineSize: 3,
          lineDataSymbolSize: 8,
          holeSize: 55,
          barGapWidthPct: 60,
        } as PptxGenJS.IChartOpts);
        if (s.caption) slide.addText(s.caption, { x: M, y: H - 1.3, w: W - 2 * M, h: 0.6, fontSize: 14, color: t.muted, fontFace: font, italic: true, ...dir(s.caption) });
        footer(slide, n, rtl);
        break;
      }
      case 'stats': {
        header(slide, s.title, rtl);
        const k = Math.max(1, s.stats.length);
        const perRow = k <= 4 ? k : 3;
        const rowsN = Math.ceil(k / perRow);
        const gap = 0.35;
        const cw = (W - 2 * M - gap * (perRow - 1)) / perRow;
        const ch = rowsN === 1 ? 3.2 : 2.35;
        const stats = rtl ? [...s.stats].reverse() : s.stats;
        stats.forEach((st, i) => {
          const x = M + (i % perRow) * (cw + gap);
          const y = 1.9 + Math.floor(i / perRow) * (ch + gap);
          slide.addShape(pptx.ShapeType.roundRect, { x, y, w: cw, h: ch, fill: { color: t.surface }, line: { color: t.surface }, rectRadius: 0.15 });
          slide.addShape(pptx.ShapeType.rect, { x, y: y + 0.25, w: 0.08, h: ch - 0.5, fill: { color: i % 2 ? t.accent : t.primary }, line: { color: i % 2 ? t.accent : t.primary } });
          slide.addText(st.value, { x: x + 0.3, y: y + 0.25, w: cw - 0.5, h: ch * 0.5, fontSize: rowsN === 1 ? 48 : 38, bold: true, color: i % 2 ? t.accent : t.primary, fontFace: font, valign: 'middle', ...dir(st.value) });
          slide.addText(st.label, { x: x + 0.3, y: y + ch * 0.55, w: cw - 0.5, h: ch * 0.35, fontSize: 18, color: t.muted, fontFace: font, valign: 'top', ...dir(st.label) });
        });
        footer(slide, n, rtl);
        break;
      }
      case 'timeline': {
        header(slide, s.title, rtl);
        const steps = rtl ? [...s.steps].reverse() : s.steps;
        const k = Math.max(1, steps.length);
        const span = W - 2 * M;
        const step = span / k;
        const lineY = 3.0;
        slide.addShape(pptx.ShapeType.line, { x: M + step / 2, y: lineY, w: span - step, h: 0, line: { color: t.muted, width: 2 } });
        steps.forEach((st, i) => {
          const cx = M + step * i + step / 2;
          const color = i % 2 ? t.accent : t.primary;
          slide.addShape(pptx.ShapeType.ellipse, { x: cx - 0.32, y: lineY - 0.32, w: 0.64, h: 0.64, fill: { color }, line: { color: 'FFFFFF', width: 2 } });
          const num = rtl ? k - i : i + 1;
          slide.addText(String(num), { x: cx - 0.32, y: lineY - 0.32, w: 0.64, h: 0.64, fontSize: 16, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', fontFace: font });
          slide.addText(st.title, { x: cx - step / 2 + 0.08, y: lineY + 0.5, w: step - 0.16, h: 0.7, fontSize: 16, bold: true, color: t.text, align: 'center', fontFace: font, ...(isRtl(st.title) ? { rtlMode: true } : {}) });
          if (st.text) slide.addText(st.text, { x: cx - step / 2 + 0.08, y: lineY + 1.2, w: step - 0.16, h: 2.2, fontSize: 12, color: t.muted, align: 'center', valign: 'top', fontFace: font, ...(isRtl(st.text) ? { rtlMode: true } : {}) });
        });
        footer(slide, n, rtl);
        break;
      }
      case 'quote': {
        slide.background = { color: t.surface };
        slide.addText('“', { x: rtl ? W - M - 2 : M, y: 0.6, w: 2, h: 2, fontSize: 140, color: t.accent, fontFace: 'Georgia', bold: true });
        slide.addText(s.quote, { x: M + 0.8, y: 2.0, w: W - 2 * M - 1.6, h: 3, fontSize: 30, italic: true, color: t.dark ? t.text : t.primary, fontFace: 'Georgia', valign: 'middle', align: 'center', ...(isRtl(s.quote) ? { rtlMode: true } : {}) });
        if (s.author) slide.addText(`— ${s.author}`, { x: M + 0.8, y: 5.2, w: W - 2 * M - 1.6, h: 0.6, fontSize: 18, color: t.muted, fontFace: font, align: 'center', ...(isRtl(s.author) ? { rtlMode: true } : {}) });
        footer(slide, n, rtl);
        break;
      }
    }
  });

  const blob = (await pptx.write({ outputType: 'blob' })) as Blob;
  return new Blob([blob], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
}
