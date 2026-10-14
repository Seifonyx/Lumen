// Markdown (+ optional settings comment) → styled Word document.

import {
  AlignmentType, BorderStyle, Document, ExternalHyperlink, Footer, Header, HeadingLevel, LevelFormat, Packer, PageBreak,
  PageNumber, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
  type IRunOptions, type ParagraphChild,
} from 'docx';
import { marked, type Token, type Tokens } from 'marked';
import { hasRtl, isRtl } from '../util';
import { hex, splitDocConfig, type DocConfig } from './spec';

interface RunStyle {
  bold?: boolean;
  italics?: boolean;
  strike?: boolean;
  code?: boolean;
  color?: string;
  highlight?: boolean;
  underline?: boolean;
  sub?: boolean;
  sup?: boolean;
  link?: string;
}

const CALLOUTS: Record<string, { label: string; color: string; fill: string }> = {
  NOTE: { label: 'Note', color: '2F6FB3', fill: 'EAF2FB' },
  TIP: { label: 'Tip', color: '2E7D4F', fill: 'EAF6EF' },
  IMPORTANT: { label: 'Important', color: '7A4CB0', fill: 'F3EEFA' },
  WARNING: { label: 'Warning', color: 'B7791F', fill: 'FDF6E7' },
  CAUTION: { label: 'Caution', color: 'C0392B', fill: 'FCEDEB' },
};

const decode = (s: string) => {
  const t = document.createElement('textarea');
  t.innerHTML = s;
  return t.value;
};

function plain(tokens: Token[] | undefined): string {
  return (tokens || [])
    .map((t: any) => (t.tokens ? plain(t.tokens) : t.type === 'br' ? '\n' : t.type === 'html' ? '' : decode(t.text ?? t.raw ?? '')))
    .join('');
}

class Builder {
  theme: string;
  font: string;
  numberingRefs: string[] = [];
  private olCount = 0;

  constructor(cfg: DocConfig) {
    this.theme = hex(cfg.theme, '1F4E79');
    this.font = cfg.font || 'Calibri';
  }

  run(text: string, s: RunStyle): TextRun {
    const opts: IRunOptions & Record<string, unknown> = {
      text,
      bold: s.bold,
      boldComplexScript: s.bold,
      italics: s.italics,
      italicsComplexScript: s.italics,
      strike: s.strike,
      color: s.link ? '1F6FB2' : s.color,
      underline: s.underline || s.link ? {} : undefined,
      highlight: s.highlight ? 'yellow' : undefined,
      subScript: s.sub,
      superScript: s.sup,
      rightToLeft: hasRtl(text) || undefined,
      font: s.code ? { ascii: 'Consolas', hAnsi: 'Consolas', cs: 'Consolas' } : undefined,
      shading: s.code ? { type: ShadingType.CLEAR, color: 'auto', fill: 'EFEFEC' } : undefined,
    };
    return new TextRun(opts);
  }

  /** Inline tokens → runs. Handles simple inline HTML like <span style="color:…">, <mark>, <u>, <sub>, <sup>. */
  inline(tokens: Token[] | undefined, base: RunStyle = {}): ParagraphChild[] {
    const out: ParagraphChild[] = [];
    const stack: RunStyle[] = [base];
    const cur = () => stack[stack.length - 1];
    const textRuns = (text: string, s: RunStyle) =>
      text.split('\n').flatMap((line, i) => (i ? [new TextRun({ break: 1 }), this.run(line, s)] : [this.run(line, s)]));

    const walk = (list: Token[] | undefined, style: RunStyle) => {
      for (const t of list || []) {
        const s = merge(cur(), style);
        switch (t.type) {
          case 'strong': walk(t.tokens, { ...s, bold: true }); break;
          case 'em': walk(t.tokens, { ...s, italics: true }); break;
          case 'del': walk(t.tokens, { ...s, strike: true }); break;
          case 'codespan': out.push(this.run(decode(t.text), { ...s, code: true })); break;
          case 'br': out.push(new TextRun({ break: 1 })); break;
          case 'link': {
            const href = (t as Tokens.Link).href;
            const children = this.inline(t.tokens, { ...s, link: href }) as TextRun[];
            out.push(/^https?:|^mailto:/i.test(href) ? new ExternalHyperlink({ link: href, children }) : (children[0] ?? this.run('', s)));
            if (!/^https?:|^mailto:/i.test(href)) out.push(...children.slice(1));
            break;
          }
          case 'image': out.push(this.run(`[${(t as Tokens.Image).text || 'image'}]`, { ...s, italics: true })); break;
          case 'html': {
            const tag = t.raw.trim();
            const close = /^<\//.test(tag);
            if (close) {
              if (stack.length > 1) stack.pop();
            } else if (/^<br\s*\/?>$/i.test(tag)) out.push(new TextRun({ break: 1 }));
            else {
              const color = /color\s*:\s*(#[0-9a-f]{3,6}|[a-z]+)/i.exec(tag)?.[1];
              const next: RunStyle = { ...cur() };
              if (color) next.color = hex(color, namedColor(color));
              if (/^<mark/i.test(tag) || /background(-color)?\s*:/i.test(tag)) next.highlight = true;
              if (/^<(u|ins)\b/i.test(tag)) next.underline = true;
              if (/^<(b|strong)\b/i.test(tag)) next.bold = true;
              if (/^<(i|em)\b/i.test(tag)) next.italics = true;
              if (/^<sub\b/i.test(tag)) next.sub = true;
              if (/^<sup\b/i.test(tag)) next.sup = true;
              if (!/\/>$/.test(tag)) stack.push(next);
            }
            break;
          }
          default:
            if ((t as any).tokens) walk((t as any).tokens, s);
            else out.push(...textRuns(decode((t as any).text ?? t.raw ?? ''), s));
        }
      }
    };
    walk(tokens, base);
    return out;
  }

  paragraph(children: ParagraphChild[], text: string, extra: Record<string, unknown> = {}): Paragraph {
    return new Paragraph({ children, bidirectional: isRtl(text) || undefined, ...extra });
  }

  box(paragraphs: Paragraph[], fill: string, border: string, rtl: boolean): Table {
    const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const side = { style: BorderStyle.SINGLE, size: 24, color: border };
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      visuallyRightToLeft: rtl || undefined,
      borders: { top: none, bottom: none, left: rtl ? none : side, right: rtl ? side : none, insideHorizontal: none, insideVertical: none },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { type: ShadingType.CLEAR, color: 'auto', fill },
              margins: { top: 100, bottom: 100, left: 160, right: 160 },
              children: paragraphs,
            }),
          ],
        }),
      ],
    });
  }

  table(t: Tokens.Table): Table {
    const rtl = isRtl(plain(t.header.flatMap((c) => c.tokens)));
    const border = { style: BorderStyle.SINGLE, size: 4, color: 'C9CED6' };
    const align = (i: number) =>
      t.align[i] === 'center' ? AlignmentType.CENTER : t.align[i] === 'right' ? AlignmentType.END : t.align[i] === 'left' ? AlignmentType.START : undefined;
    const cell = (c: Tokens.TableCell, i: number, header: boolean, zebra: boolean) =>
      new TableCell({
        shading: header ? { type: ShadingType.CLEAR, color: 'auto', fill: this.theme } : zebra ? { type: ShadingType.CLEAR, color: 'auto', fill: 'F3F5F8' } : undefined,
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        children: [
          this.paragraph(this.inline(c.tokens, header ? { bold: true, color: 'FFFFFF' } : {}), plain(c.tokens), {
            alignment: align(i),
            spacing: { after: 0 },
          }),
        ],
      });
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      visuallyRightToLeft: rtl || undefined,
      borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
      rows: [
        new TableRow({ tableHeader: true, children: t.header.map((c, i) => cell(c, i, true, false)) }),
        ...t.rows.map((r, ri) => new TableRow({ children: r.map((c, i) => cell(c, i, false, ri % 2 === 1)) })),
      ],
    });
  }

  blocks(tokens: Token[], ctx: { indent?: number; quote?: boolean } = {}): (Paragraph | Table)[] {
    const out: (Paragraph | Table)[] = [];
    for (const t of tokens) {
      switch (t.type) {
        case 'heading': {
          const h = t as Tokens.Heading;
          const level = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4][Math.min(h.depth, 4) - 1];
          out.push(this.paragraph(this.inline(h.tokens), plain(h.tokens), { heading: level }));
          break;
        }
        case 'paragraph':
        case 'text': {
          const toks = (t as any).tokens || [{ type: 'text', raw: (t as any).text, text: (t as any).text }];
          out.push(this.paragraph(this.inline(toks, ctx.quote ? { italics: true, color: '555555' } : {}), plain(toks), ctx.indent ? { indent: { left: ctx.indent } } : {}));
          break;
        }
        case 'list':
          out.push(...this.list(t as Tokens.List, 0));
          break;
        case 'table':
          out.push(this.table(t as Tokens.Table), new Paragraph({ spacing: { after: 60 } }));
          break;
        case 'code': {
          const lines = (t as Tokens.Code).text.split('\n');
          const paras = lines.map((line) => new Paragraph({ spacing: { after: 0 }, children: [this.run(line || ' ', { code: true })] }));
          out.push(this.box(paras, 'F4F4F2', 'BBBBBB', false), new Paragraph({ spacing: { after: 60 } }));
          break;
        }
        case 'blockquote': {
          const q = t as Tokens.Blockquote;
          const first = q.tokens[0] as any;
          const m = first?.type === 'paragraph' ? /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i.exec(first.text) : null;
          if (m) {
            const kind = CALLOUTS[m[1].toUpperCase()];
            const rest = first.text.slice(m[0].length);
            const inner = [
              ...(rest.trim() ? marked.lexer(rest) : []),
              ...q.tokens.slice(1),
            ];
            const body = this.blocks(inner).filter((x): x is Paragraph => x instanceof Paragraph);
            const rtl = isRtl(plain(inner as Token[]) || rest);
            const title = new Paragraph({ bidirectional: rtl || undefined, spacing: { after: 60 }, children: [this.run(kind.label, { bold: true, color: kind.color })] });
            out.push(this.box([title, ...body], kind.fill, kind.color, rtl), new Paragraph({ spacing: { after: 60 } }));
          } else {
            const inner = this.blocks(q.tokens, { quote: true, indent: 360 });
            out.push(...inner);
          }
          break;
        }
        case 'hr':
          out.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'BBBBBB', space: 1 } } }));
          break;
        case 'html':
          if (/<!--\s*pagebreak\s*-->|page-break/i.test(t.raw)) out.push(new Paragraph({ children: [new PageBreak()] }));
          else {
            const text = decode(t.raw.replace(/<[^>]+>/g, '')).trim();
            if (text) out.push(this.paragraph([this.run(text, {})], text));
          }
          break;
        case 'space':
          break;
        default: {
          const text = (t as any).text;
          if (text) out.push(this.paragraph([this.run(decode(text), {})], text));
        }
      }
    }
    return out;
  }

  list(t: Tokens.List, depth: number): Paragraph[] {
    const out: Paragraph[] = [];
    let reference = 'bullets';
    if (t.ordered) {
      reference = `numbers-${++this.olCount}`;
      this.numberingRefs.push(reference);
    }
    for (const item of t.items) {
      let first = true;
      for (const sub of item.tokens) {
        if (sub.type === 'list') out.push(...this.list(sub as Tokens.List, Math.min(depth + 1, 8)));
        else if ((sub.type === 'text' || sub.type === 'paragraph') && first) {
          const toks = (sub as any).tokens || [{ type: 'text', raw: (sub as any).text, text: (sub as any).text }];
          const prefix = item.task ? [this.run(item.checked ? '☑ ' : '☐ ', {})] : [];
          out.push(this.paragraph([...prefix, ...this.inline(toks)], plain(toks), { numbering: { reference, level: depth }, spacing: { after: 60 } }));
          first = false;
        } else {
          out.push(...(this.blocks([sub], { indent: 720 * (depth + 1) }).filter((x) => x instanceof Paragraph) as Paragraph[]));
        }
      }
    }
    return out;
  }
}

/** Combines two run styles, ignoring keys that are undefined. */
function merge(a: RunStyle, b: RunStyle): RunStyle {
  const out: RunStyle = { ...a };
  for (const [k, v] of Object.entries(b)) if (v !== undefined) (out as any)[k] = v;
  return out;
}

function namedColor(name: string): string {
  const map: Record<string, string> = {
    red: 'C00000', green: '2E7D32', blue: '1F4E79', orange: 'E36C09', purple: '7030A0', gray: '7F7F7F', grey: '7F7F7F',
    black: '000000', white: 'FFFFFF', yellow: 'BF8F00', teal: '00796B', brown: '7B4A12', pink: 'C2185B',
  };
  return map[name.toLowerCase()] || '000000';
}

export async function buildDocx(content: string): Promise<Blob> {
  const { config, body } = splitDocConfig(content);
  const b = new Builder(config);
  const children = b.blocks(marked.lexer(body));
  const rtlDoc = isRtl(body.replace(/[#*>|`\-\d.\s]/g, ''));

  const cover: Paragraph[] = [];
  if (config.cover && config.title) {
    const rtl = isRtl(config.title);
    const line = (text: string, opts: Record<string, unknown>) => new Paragraph({ bidirectional: rtl || undefined, children: [new TextRun({ text, rightToLeft: hasRtl(text) || undefined, ...opts })] });
    cover.push(
      new Paragraph({ spacing: { before: 2400 } }),
      line(config.title, { bold: true, size: 64, color: b.theme }),
      new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: b.theme, space: 6 } }, spacing: { after: 240 } }),
    );
    if (config.subtitle) cover.push(line(config.subtitle, { size: 32, color: '555555' }));
    cover.push(new Paragraph({ spacing: { before: 1200 } }));
    if (config.author) cover.push(line(config.author, { size: 24, color: '333333' }));
    cover.push(line(config.date || new Date().toLocaleDateString(rtl ? 'ar-EG' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' }), { size: 22, color: '777777' }));
    cover.push(new Paragraph({ children: [new PageBreak()] }));
  } else if (config.title) {
    children.unshift(
      new Paragraph({ heading: HeadingLevel.TITLE, bidirectional: isRtl(config.title) || undefined, children: [new TextRun({ text: config.title, rightToLeft: hasRtl(config.title) || undefined })] }),
      ...(config.subtitle ? [new Paragraph({ bidirectional: isRtl(config.subtitle) || undefined, children: [new TextRun({ text: config.subtitle, color: '666666', size: 28 })] })] : []),
    );
  }

  const small = { size: 18, color: '888888' };
  const header = config.header
    ? new Header({ children: [new Paragraph({ alignment: rtlDoc ? AlignmentType.LEFT : AlignmentType.RIGHT, bidirectional: isRtl(config.header) || undefined, children: [new TextRun({ text: config.header, ...small, rightToLeft: hasRtl(config.header) || undefined })] })] })
    : undefined;
  const footer =
    config.footer !== false
      ? new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES], ...small })] })] })
      : undefined;

  const levels = (ordered: boolean) =>
    Array.from({ length: 9 }, (_, level) => ({
      level,
      format: ordered ? (level % 3 === 1 ? LevelFormat.LOWER_LETTER : level % 3 === 2 ? LevelFormat.LOWER_ROMAN : LevelFormat.DECIMAL) : LevelFormat.BULLET,
      text: ordered ? `%${level + 1}.` : ['•', '◦', '▪'][level % 3],
      alignment: AlignmentType.START,
      style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
    }));

  const doc = new Document({
    creator: config.author || 'Lumen',
    title: config.title || 'Document',
    styles: {
      default: {
        document: { run: { font: { ascii: b.font, hAnsi: b.font, cs: 'Arial', eastAsia: b.font }, size: 22 }, paragraph: { spacing: { after: 120, line: 276 } } },
        title: { run: { size: 52, bold: true, color: b.theme } },
        heading1: { run: { size: 34, bold: true, color: b.theme }, paragraph: { spacing: { before: 360, after: 120 }, keepNext: true } },
        heading2: { run: { size: 28, bold: true, color: b.theme }, paragraph: { spacing: { before: 280, after: 100 }, keepNext: true } },
        heading3: { run: { size: 24, bold: true, color: '333333' }, paragraph: { spacing: { before: 220, after: 80 }, keepNext: true } },
        heading4: { run: { size: 22, bold: true, italics: true, color: '444444' }, paragraph: { spacing: { before: 200, after: 60 }, keepNext: true } },
        hyperlink: { run: { color: '1F6FB2', underline: {} } },
      },
    },
    numbering: {
      config: [{ reference: 'bullets', levels: levels(false) }, ...b.numberingRefs.map((reference) => ({ reference, levels: levels(true) }))],
    },
    sections: [
      {
        properties: {
          titlePage: cover.length > 0,
          page: { margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } },
        },
        headers: header ? { default: header, ...(cover.length ? { first: new Header({ children: [] }) } : {}) } : undefined,
        footers: footer ? { default: footer, ...(cover.length ? { first: new Footer({ children: [] }) } : {}) } : undefined,
        children: [...cover, ...(children.length ? children : [new Paragraph('')])],
      },
    ],
  });
  return Packer.toBlob(doc);
}
