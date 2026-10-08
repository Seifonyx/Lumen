// Normalizes a PowerPoint spec written by a model (shared by the .pptx writer and the in-app preview).

import { deckTheme, parseLooseJson, type DeckTheme } from './spec';

export interface Bullet {
  text: string;
  sub: string[];
}

export interface ChartSpec {
  type: 'bar' | 'column' | 'horizontalBar' | 'line' | 'area' | 'pie' | 'doughnut';
  labels: string[];
  series: { name: string; values: number[] }[];
}

export type Slide =
  | { layout: 'title' | 'closing' | 'section'; title: string; subtitle?: string; notes?: string }
  | { layout: 'bullets'; title: string; bullets: Bullet[]; notes?: string }
  | { layout: 'two-column'; title: string; leftTitle?: string; left: Bullet[]; rightTitle?: string; right: Bullet[]; notes?: string }
  | { layout: 'table'; title: string; header: string[]; rows: string[][]; notes?: string }
  | { layout: 'chart'; title: string; chart: ChartSpec; caption?: string; notes?: string }
  | { layout: 'stats'; title: string; stats: { value: string; label: string }[]; notes?: string }
  | { layout: 'timeline'; title: string; steps: { title: string; text?: string }[]; notes?: string }
  | { layout: 'quote'; quote: string; author?: string; notes?: string };

export interface Deck {
  title: string;
  theme: DeckTheme;
  slides: Slide[];
}

const str = (v: unknown) => (v === undefined || v === null ? '' : String(v));

function bullets(list: unknown): Bullet[] {
  if (!Array.isArray(list)) return typeof list === 'string' ? [{ text: list, sub: [] }] : [];
  return list.map((b: any) =>
    typeof b === 'string' ? { text: b, sub: [] } : { text: str(b?.text ?? b?.title), sub: Array.isArray(b?.sub ?? b?.bullets) ? (b.sub ?? b.bullets).map(str) : [] },
  );
}

function chart(c: any): ChartSpec {
  const type = String(c?.type || 'bar');
  const series = Array.isArray(c?.series) ? c.series : Array.isArray(c?.values) ? [{ name: c?.name || 'Series 1', values: c.values }] : [];
  return {
    type: (['bar', 'column', 'horizontalBar', 'line', 'area', 'pie', 'doughnut'].includes(type) ? type : 'bar') as ChartSpec['type'],
    labels: (c?.labels || []).map(str),
    series: series.map((s: any, i: number) => ({ name: str(s?.name) || `Series ${i + 1}`, values: (s?.values || []).map((v: any) => Number(v) || 0) })),
  };
}

export function parseDeck(content: string): Deck | null {
  const json = parseLooseJson<any>(content);
  if (!json) return null;
  const raw: any[] = Array.isArray(json) ? json : Array.isArray(json.slides) ? json.slides : [];
  if (!raw.length) return null;
  const slides: Slide[] = raw.map((s: any): Slide => {
    const notes = s?.notes ? str(s.notes) : undefined;
    const title = str(s?.title);
    const layout = String(s?.layout || '').toLowerCase();
    switch (layout) {
      case 'title':
      case 'closing':
      case 'section':
        return { layout, title, subtitle: s.subtitle ? str(s.subtitle) : undefined, notes };
      case 'two-column':
      case 'twocolumn':
      case 'comparison':
        return { layout: 'two-column', title, leftTitle: s.leftTitle ? str(s.leftTitle) : undefined, left: bullets(s.left), rightTitle: s.rightTitle ? str(s.rightTitle) : undefined, right: bullets(s.right), notes };
      case 'table': {
        const t = s.table || s;
        return { layout: 'table', title, header: (t.header || []).map(str), rows: (t.rows || []).map((r: any[]) => (r || []).map(str)), notes };
      }
      case 'chart':
        return { layout: 'chart', title, chart: chart(s.chart || s), caption: s.caption ? str(s.caption) : undefined, notes };
      case 'stats':
        return { layout: 'stats', title, stats: (s.stats || []).slice(0, 6).map((x: any) => ({ value: str(x?.value), label: str(x?.label) })), notes };
      case 'timeline':
        return { layout: 'timeline', title, steps: (s.steps || []).slice(0, 7).map((x: any) => (typeof x === 'string' ? { title: x } : { title: str(x?.title), text: x?.text ? str(x.text) : undefined })), notes };
      case 'quote':
        return { layout: 'quote', quote: str(s.quote || s.text || title), author: s.author ? str(s.author) : undefined, notes };
      default:
        if (s?.bullets || s?.points || s?.content) return { layout: 'bullets', title, bullets: bullets(s.bullets || s.points || s.content), notes };
        return { layout: 'title', title, subtitle: s?.subtitle ? str(s.subtitle) : undefined, notes };
    }
  });
  const first = slides[0] as any;
  return { title: str(json.title) || first?.title || 'Presentation', theme: deckTheme(json.theme), slides };
}
