// Turns files the user attaches into something every model can read:
// images and small PDFs are sent as-is; everything else becomes text in the browser.

import type { Attachment } from '../../types';
import { extOf, uid } from '../util';

const MAX_NATIVE_PDF_BYTES = 2_500_000;
const MAX_TEXT_CHARS = 300_000;
const IMAGE_MAX_SIDE = 1600;
const TEXT_EXT = /^(txt|md|markdown|csv|tsv|json|html?|xml|js|jsx|ts|tsx|py|java|c|cpp|h|cs|go|rs|rb|php|sql|css|scss|log|ya?ml|ini|toml|sh|bat|srt|vtt|tex|rtf)$/;

export const ACCEPT = [
  'image/*', '.pdf', '.docx', '.xlsx', '.xlsm', '.pptx', '.doc', '.xls', '.ppt',
  '.txt', '.md', '.csv', '.tsv', '.json', '.html', '.xml', '.js', '.ts', '.py', '.css', '.sql', '.log', '.yaml', '.yml', '.srt', '.tex',
].join(',');

const clip = (t: string) => (t.length > MAX_TEXT_CHARS ? t.slice(0, MAX_TEXT_CHARS) + '\n[…file truncated]' : t);

function readAsDataURL(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

const stripDataUrl = (url: string) => url.slice(url.indexOf(',') + 1);

async function loadImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Couldn't read this image."));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function drawScaled(img: HTMLImageElement, maxSide: number, quality: number): string {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

async function readImage(file: File): Promise<Attachment> {
  const img = await loadImage(file);
  const full = drawScaled(img, IMAGE_MAX_SIDE, 0.85);
  return {
    id: uid(),
    kind: 'image',
    name: file.name || 'image.jpg',
    mime: 'image/jpeg',
    size: file.size,
    data: stripDataUrl(full),
    thumb: drawScaled(img, 160, 0.7),
  };
}

async function pdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const content = await (await pdf.getPage(i)).getTextContent();
    pages.push(`--- Page ${i} ---\n` + content.items.map((it: any) => ('str' in it ? it.str + (it.hasEOL ? '\n' : ' ') : '')).join(''));
  }
  return pages.join('\n\n');
}

async function readPdf(file: File): Promise<Attachment> {
  if (file.size <= MAX_NATIVE_PDF_BYTES) {
    return { id: uid(), kind: 'pdf', name: file.name, mime: 'application/pdf', size: file.size, data: stripDataUrl(await readAsDataURL(file)) };
  }
  const text = await pdfText(file);
  if (text.replace(/--- Page \d+ ---|\s/g, '').length < 50) {
    throw new Error(`${file.name} is large and seems to be scanned (no text inside). Send photos or screenshots of the pages instead.`);
  }
  return { id: uid(), kind: 'text', name: file.name, mime: 'application/pdf', size: file.size, text: clip(text) };
}

// Word → Markdown-ish text that keeps headings, lists and tables.
function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out: string[] = [];
  const inline = (n: Node): string =>
    [...n.childNodes]
      .map((c) => {
        if (c.nodeType === Node.TEXT_NODE) return c.textContent || '';
        const el = c as HTMLElement;
        const inner = inline(el);
        if (el.tagName === 'STRONG' || el.tagName === 'B') return inner.trim() ? `**${inner}**` : inner;
        if (el.tagName === 'EM' || el.tagName === 'I') return inner.trim() ? `*${inner}*` : inner;
        if (el.tagName === 'BR') return '\n';
        if (el.tagName === 'A') return inner;
        return inner;
      })
      .join('');
  const walk = (el: Element, depth = 0) => {
    for (const c of [...el.children]) {
      const tag = c.tagName;
      if (/^H[1-6]$/.test(tag)) out.push(`${'#'.repeat(Number(tag[1]))} ${inline(c).trim()}`);
      else if (tag === 'P') out.push(inline(c).trim());
      else if (tag === 'UL' || tag === 'OL') {
        [...c.children].forEach((li, i) => {
          const nested = [...li.children].filter((x) => x.tagName === 'UL' || x.tagName === 'OL');
          nested.forEach((n) => n.remove());
          out.push(`${'  '.repeat(depth)}${tag === 'OL' ? `${i + 1}.` : '-'} ${inline(li).trim()}`);
          nested.forEach((n) => walk({ children: [n] } as unknown as Element, depth + 1));
        });
      } else if (tag === 'TABLE') {
        const rows = [...c.querySelectorAll('tr')].map((tr) => [...tr.children].map((td) => inline(td).trim().replace(/\|/g, '\\|').replace(/\n/g, ' ')));
        if (rows.length) {
          const w = Math.max(...rows.map((r) => r.length));
          const line = (r: string[]) => `| ${Array.from({ length: w }, (_, i) => r[i] || '').join(' | ')} |`;
          out.push([line(rows[0]), `|${' --- |'.repeat(w)}`, ...rows.slice(1).map(line)].join('\n'));
        }
      } else walk(c, depth);
    }
  };
  walk(doc.body);
  return out.filter(Boolean).join('\n\n');
}

async function readDocx(file: File): Promise<Attachment> {
  const mammoth = await import('mammoth');
  const { value } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
  return { id: uid(), kind: 'text', name: file.name, mime: file.type, size: file.size, text: clip(htmlToMarkdown(value)) };
}

// ---------------------------------------------------------------- Excel

const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);
const byTag = (node: Document | Element, tag: string) => [...node.getElementsByTagNameNS('*', tag)];
const xml = (text: string) => new DOMParser().parseFromString(text, 'application/xml');

function isDateFormat(code: string) {
  const cleaned = code.replace(/"[^"]*"|\\.|\[[^\]]*\]/g, '');
  return /[dmyhs]/i.test(cleaned) && !/^general$/i.test(cleaned);
}

function excelDate(serial: number, date1904: boolean) {
  const d = new Date(Math.round((serial + (date1904 ? 1462 : 0) - 25569) * 86400000));
  const iso = d.toISOString();
  return d.getUTCHours() || d.getUTCMinutes() ? `${iso.slice(0, 10)} ${iso.slice(11, 16)}` : iso.slice(0, 10);
}

function colIndex(ref: string) {
  let n = 0;
  for (const ch of ref.replace(/[^A-Z]/gi, '').toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}

const csvCell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

async function readXlsx(file: File): Promise<Attachment> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const read = async (path?: string) => (path && zip.file(path) ? xml(await zip.file(path)!.async('string')) : null);

  const workbook = await read('xl/workbook.xml');
  if (!workbook) throw new Error(`${file.name} doesn't look like an Excel file.`);
  const date1904 = byTag(workbook, 'workbookPr').some((n) => ['1', 'true'].includes(n.getAttribute('date1904') || ''));

  const rels = await read('xl/_rels/workbook.xml.rels');
  const targets: Record<string, string> = {};
  for (const r of rels ? byTag(rels, 'Relationship') : []) {
    const t = r.getAttribute('Target') || '';
    targets[r.getAttribute('Id') || ''] = t.startsWith('/') ? t.slice(1) : `xl/${t}`;
  }

  const shared: string[] = [];
  const ss = await read('xl/sharedStrings.xml');
  for (const si of ss ? byTag(ss, 'si') : []) {
    shared.push(byTag(si, 't').filter((t) => (t.parentNode as Element).localName !== 'rPh').map((t) => t.textContent).join(''));
  }

  const dateStyles = new Set<number>();
  const styles = await read('xl/styles.xml');
  if (styles) {
    const custom: Record<string, string> = {};
    for (const f of byTag(styles, 'numFmt')) custom[f.getAttribute('numFmtId') || ''] = f.getAttribute('formatCode') || '';
    const xfs = byTag(styles, 'cellXfs')[0];
    [...(xfs ? xfs.children : [])].forEach((xf, i) => {
      const id = Number(xf.getAttribute('numFmtId') || 0);
      if (BUILTIN_DATE_FORMATS.has(id) || (custom[id] && isDateFormat(custom[id]))) dateStyles.add(i);
    });
  }

  const blocks: string[] = [];
  for (const sheet of byTag(workbook, 'sheet')) {
    const relId = sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || sheet.getAttribute('r:id') || '';
    const doc = await read(targets[relId]);
    if (!doc) continue;
    const rows: string[] = [];
    for (const row of byTag(doc, 'row')) {
      const cells: string[] = [];
      let next = 0;
      for (const c of byTag(row, 'c')) {
        const ref = c.getAttribute('r');
        const col = ref ? colIndex(ref) : next;
        next = col + 1;
        const type = c.getAttribute('t');
        const v = byTag(c, 'v')[0]?.textContent ?? '';
        let value: string;
        if (type === 's') value = shared[Number(v)] ?? '';
        else if (type === 'inlineStr') value = byTag(c, 't').map((t) => t.textContent).join('');
        else if (type === 'b') value = v === '1' ? 'TRUE' : 'FALSE';
        else if (v !== '' && (type === null || type === 'n') && dateStyles.has(Number(c.getAttribute('s') || 0))) value = excelDate(Number(v), date1904);
        else value = v;
        cells[col] = value;
      }
      const rowIndex = Number(row.getAttribute('r') || rows.length + 1) - 1;
      rows[rowIndex] = Array.from(cells, (x) => csvCell(x ?? '')).join(',').replace(/,+$/, '');
    }
    const body = Array.from(rows, (r) => r ?? '').join('\n').replace(/\n+$/, '');
    blocks.push(`### Sheet: ${sheet.getAttribute('name')}\n${body || '(empty)'}`);
  }
  if (blocks.length === 0) throw new Error(`${file.name}: couldn't find any sheets.`);
  return { id: uid(), kind: 'text', name: file.name, mime: file.type, size: file.size, text: clip(blocks.join('\n\n')) };
}

// ---------------------------------------------------------------- PowerPoint

async function readPptx(file: File): Promise<Attachment> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slideNo = (p: string) => Number(/(\d+)\.xml$/.exec(p)?.[1] || 0);
  const slides = Object.keys(zip.files).filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p)).sort((a, b) => slideNo(a) - slideNo(b));
  if (slides.length === 0) throw new Error(`${file.name} doesn't look like a PowerPoint file.`);
  const paragraphs = (doc: Document) =>
    byTag(doc, 'p')
      .map((p) => byTag(p, 't').map((t) => t.textContent).join(''))
      .filter((t) => t.trim());
  const out: string[] = [];
  for (const path of slides) {
    const n = slideNo(path);
    const text = paragraphs(xml(await zip.file(path)!.async('string')));
    let block = `### Slide ${n}\n${text.join('\n')}`;
    const notes = zip.file(`ppt/notesSlides/notesSlide${n}.xml`);
    if (notes) {
      const noteText = paragraphs(xml(await notes.async('string'))).filter((t) => !/^\d+$/.test(t.trim()));
      if (noteText.length) block += `\nSpeaker notes: ${noteText.join(' ')}`;
    }
    out.push(block);
  }
  return { id: uid(), kind: 'text', name: file.name, mime: file.type, size: file.size, text: clip(out.join('\n\n')) };
}

export async function readAttachment(file: File): Promise<Attachment> {
  const ext = extOf(file.name);
  if (file.type.startsWith('image/') && !/svg/.test(file.type)) return readImage(file);
  if (file.type === 'application/pdf' || ext === 'pdf') return readPdf(file);
  if (ext === 'docx') return readDocx(file);
  if (ext === 'xlsx' || ext === 'xlsm') return readXlsx(file);
  if (ext === 'pptx') return readPptx(file);
  if (ext === 'doc' || ext === 'xls' || ext === 'ppt') {
    const modern = { doc: '.docx', xls: '.xlsx', ppt: '.pptx' }[ext];
    throw new Error(`${file.name} is an old Office format. Open it and "Save as" ${modern}, then attach it again.`);
  }
  if (file.type.startsWith('text/') || TEXT_EXT.test(ext) || ext === 'svg') {
    return { id: uid(), kind: 'text', name: file.name, mime: file.type || 'text/plain', size: file.size, text: clip(await file.text()) };
  }
  throw new Error(`${file.name}: this file type isn't supported. Try PDF, Word, Excel, PowerPoint, images or text files.`);
}
