// Edits an existing Word or Excel file in place, so its fonts, tables, headers, logos and styles stay as
// they were. Models describe changes as JSON in a ```office-edit:Name.docx``` block:
//   Word:  {"edits":[{"find":"[Patient name]","replace":"Mona Adel"},
//                    {"after":"Findings","insert":["First new paragraph","Second"]},
//                    {"delete":"Draft – do not circulate"}]}
//   Excel: {"edits":[{"sheet":"Summary","cell":"B4","value":12},{"cell":"C2","value":"Done"}]}
// "find" matches text inside one paragraph (across differently formatted pieces); add "all":true to
// replace every match. Paragraph edits ("after"/"before"/"delete") find the paragraph containing the text.
import JSZip from 'jszip';
import { W, S, clean, describeEdit, type CellEdit, type EditResult, type OfficeEdit, type WordEdit } from './spec';
export type { EditResult, OfficeEdit } from './spec';

const parse = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');
const serialize = (doc: Document, original: string) => {
  const decl = /^<\?xml[^>]*\?>/.exec(original)?.[0];
  const body = new XMLSerializer().serializeToString(doc).replace(/^<\?xml[^>]*\?>\s*/, '');
  return (decl ? decl + '\n' : '') + body;
};

// ---------------------------------------------------------------- Word

type Piece = { node: Element; start: number; text: string };

/** The visible text of a paragraph, with where each piece of it lives. Deleted (tracked) text is skipped. */
function paragraphText(p: Element) {
  const pieces: Piece[] = [];
  let text = '';
  for (const t of Array.from(p.getElementsByTagNameNS(W, 't'))) {
    // Skip deleted (tracked-change) text and text that belongs to a nested paragraph (e.g. a text box).
    let owner: Element | null = t.parentElement, deleted = false;
    while (owner && !(owner.localName === 'p' && owner.namespaceURI === W)) { if (owner.localName === 'del') deleted = true; owner = owner.parentElement; }
    if (deleted || owner !== p) continue;
    pieces.push({ node: t, start: text.length, text: t.textContent || '' });
    text += t.textContent || '';
  }
  return { text, pieces };
}

/** Finds `needle` in `text` ignoring spacing differences; returns raw [start, end) offsets. */
function locate(text: string, needle: string, from = 0): [number, number] | null {
  const map: number[] = [];
  let norm = '';
  for (let i = 0; i < text.length; i++) {
    const ws = /\s/.test(text[i]);
    if (ws && (norm.endsWith(' ') || !norm)) continue;
    map.push(i);
    norm += ws ? ' ' : text[i];
  }
  const want = clean(needle);
  const fromNorm = map.findIndex((i) => i >= from);
  const at = norm.indexOf(want, fromNorm < 0 ? norm.length : fromNorm);
  if (at < 0 || !want) return null;
  return [map[at], map[at + want.length - 1] + 1];
}

function setText(t: Element, value: string) {
  t.textContent = value;
  t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
}

/** Replaces raw [start, end) of a paragraph's text, keeping the formatting of the piece where the match starts. */
function replaceRange(pieces: Piece[], start: number, end: number, replacement: string) {
  const first = pieces.find((p) => start >= p.start && start < p.start + p.text.length) || pieces.find((p) => start === p.start + p.text.length);
  if (!first) return;
  const lines = replacement.split('\n');
  for (const p of pieces) {
    const a = Math.max(start, p.start), b = Math.min(end, p.start + p.text.length);
    if (p === first) {
      const before = p.text.slice(0, start - p.start);
      const after = end <= p.start + p.text.length ? p.text.slice(end - p.start) : '';
      setText(p.node, before + lines[0] + (lines.length === 1 ? after : ''));
      // Line breaks become <w:br/> inside the same run, so they keep its formatting.
      let anchor: Element = p.node;
      lines.slice(1).forEach((line, i) => {
        const br = p.node.ownerDocument.createElementNS(W, 'w:br');
        const t = p.node.ownerDocument.createElementNS(W, 'w:t');
        setText(t, line + (i === lines.length - 2 ? after : ''));
        anchor.after(br, t);
        anchor = t;
      });
    } else if (a < b) {
      setText(p.node, p.text.slice(0, a - p.start) + p.text.slice(b - p.start));
    }
  }
}

/** A copy of paragraph `p` holding just `text`, in the formatting of its first run. */
function cloneParagraph(p: Element, text: string) {
  const copy = p.cloneNode(true) as Element;
  const runs = Array.from(copy.childNodes).filter((n): n is Element => n.nodeType === 1 && (n as Element).localName !== 'pPr');
  const firstRun = runs.find((n) => n.localName === 'r');
  runs.forEach((n) => n.remove());
  const doc = p.ownerDocument;
  const run = doc.createElementNS(W, 'w:r');
  const rPr = firstRun?.getElementsByTagNameNS(W, 'rPr')[0];
  if (rPr) run.appendChild(rPr.cloneNode(true));
  const t = doc.createElementNS(W, 'w:t');
  setText(t, text);
  run.appendChild(t);
  copy.appendChild(run);
  return copy;
}

async function editWord(zip: JSZip, edits: WordEdit[]): Promise<EditResult[]> {
  const partNames = Object.keys(zip.files).filter((n) => /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/.test(n)).sort((a) => (a === 'word/document.xml' ? -1 : 1));
  const parts = await Promise.all(partNames.map(async (name) => { const xml = await zip.file(name)!.async('string'); return { name, xml, doc: parse(xml) }; }));
  const paragraphs = () => parts.flatMap((part) => Array.from(part.doc.getElementsByTagNameNS(W, 'p')));
  const results = edits.map((e): EditResult => {
    const label = describeEdit(e);
    if ('find' in e) {
      let count = 0;
      for (const p of paragraphs()) {
        let from = 0;
        for (;;) {
          const { text, pieces } = paragraphText(p);
          const hit = locate(text, e.find, from);
          if (!hit) break;
          replaceRange(pieces, hit[0], hit[1], e.replace);
          count++;
          from = hit[0] + e.replace.length;
          if (!e.all) break;
        }
        if (count && !e.all) break;
      }
      return count ? { label, ok: true, note: count > 1 ? `${count} places` : undefined } : { label, ok: false, note: 'Text not found' };
    }
    const anchor = 'delete' in e ? e.delete : 'after' in e ? e.after : e.before;
    const p = paragraphs().find((x) => locate(paragraphText(x).text, anchor));
    if (!p) return { label, ok: false, note: 'Paragraph not found' };
    if ('delete' in e) {
      const cell = p.parentElement?.localName === 'tc' ? p.parentElement : null;
      if (cell && cell.getElementsByTagNameNS(W, 'p').length === 1) paragraphText(p).pieces.forEach((x) => setText(x.node, ''));
      else p.remove();
      return { label, ok: true };
    }
    const added = [e.insert].flat().map(String).map((text) => cloneParagraph(p, text));
    if ('after' in e) p.after(...added); else p.before(...added);
    return { label, ok: true };
  });
  for (const part of parts) zip.file(part.name, serialize(part.doc, part.xml));
  return results;
}

// ---------------------------------------------------------------- Excel

const colNumber = (ref: string) => [...ref.replace(/\d+/g, '').toUpperCase()].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
const rowNumber = (ref: string) => Number(ref.replace(/\D+/g, ''));

async function editExcel(zip: JSZip, edits: CellEdit[]): Promise<EditResult[]> {
  const wbXml = await zip.file('xl/workbook.xml')?.async('string');
  const relXml = await zip.file('xl/_rels/workbook.xml.rels')?.async('string');
  if (!wbXml || !relXml) throw new Error('This doesn’t look like an Excel workbook.');
  const wb = parse(wbXml), rels = parse(relXml);
  const targets = new Map(Array.from(rels.getElementsByTagName('Relationship')).map((r) => [r.getAttribute('Id'), r.getAttribute('Target') || '']));
  const sheets = Array.from(wb.getElementsByTagNameNS(S, 'sheet')).map((s) => {
    const target = targets.get(s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')) || '';
    return { name: s.getAttribute('name') || '', path: target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}` };
  });
  const loaded = new Map<string, { xml: string; doc: Document }>();
  const sheetDoc = async (path: string) => {
    if (!loaded.has(path)) { const xml = await zip.file(path)!.async('string'); loaded.set(path, { xml, doc: parse(xml) }); }
    return loaded.get(path)!.doc;
  };
  const results: EditResult[] = [];
  for (const e of edits) {
    const label = describeEdit(e);
    const sheet = e.sheet ? sheets.find((s) => s.name.toLowerCase() === e.sheet!.trim().toLowerCase()) : sheets[0];
    if (!sheet || !zip.file(sheet.path)) { results.push({ label, ok: false, note: 'Sheet not found' }); continue; }
    const doc = await sheetDoc(sheet.path);
    const data = doc.getElementsByTagNameNS(S, 'sheetData')[0];
    const ref = e.cell.trim().toUpperCase(), r = rowNumber(ref), c = colNumber(ref);
    let row = Array.from(data.getElementsByTagNameNS(S, 'row')).find((x) => Number(x.getAttribute('r')) === r);
    if (!row) {
      row = doc.createElementNS(S, 'row');
      row.setAttribute('r', String(r));
      const next = Array.from(data.getElementsByTagNameNS(S, 'row')).find((x) => Number(x.getAttribute('r')) > r);
      data.insertBefore(row, next || null);
    }
    let cell = Array.from(row.getElementsByTagNameNS(S, 'c')).find((x) => (x.getAttribute('r') || '').toUpperCase() === ref);
    if (!cell) {
      cell = doc.createElementNS(S, 'c');
      cell.setAttribute('r', ref);
      const next = Array.from(row.getElementsByTagNameNS(S, 'c')).find((x) => colNumber(x.getAttribute('r') || '') > c);
      // A new cell takes its row's style, if the row has one.
      if (row.getAttribute('s')) cell.setAttribute('s', row.getAttribute('s')!);
      row.insertBefore(cell, next || null);
    }
    // Keep the cell's style (s); replace only its value.
    Array.from(cell.childNodes).forEach((n) => n.remove());
    cell.removeAttribute('t');
    const v = e.value;
    if (v === null || v === '') { /* empty */ }
    else if (typeof v === 'string' && v.startsWith('=')) { const f = doc.createElementNS(S, 'f'); f.textContent = v.slice(1); cell.appendChild(f); }
    else if (typeof v === 'number' && Number.isFinite(v)) { const x = doc.createElementNS(S, 'v'); x.textContent = String(v); cell.appendChild(x); }
    else if (typeof v === 'boolean') { cell.setAttribute('t', 'b'); const x = doc.createElementNS(S, 'v'); x.textContent = v ? '1' : '0'; cell.appendChild(x); }
    else {
      cell.setAttribute('t', 'inlineStr');
      const is = doc.createElementNS(S, 'is'), t = doc.createElementNS(S, 't');
      t.textContent = String(v);
      t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
      is.appendChild(t); cell.appendChild(is);
    }
    results.push({ label, ok: true });
  }
  for (const [path, { xml, doc }] of loaded) zip.file(path, serialize(doc, xml));
  // Formulas recalculate when the file opens; drop the cached calculation order, which may now be stale.
  const calcPr = wb.getElementsByTagNameNS(S, 'calcPr')[0];
  if (calcPr) calcPr.setAttribute('fullCalcOnLoad', '1');
  else { const x = wb.createElementNS(S, 'calcPr'); x.setAttribute('fullCalcOnLoad', '1'); wb.documentElement.appendChild(x); }
  zip.file('xl/workbook.xml', serialize(wb, wbXml));
  if (zip.file('xl/calcChain.xml')) {
    zip.remove('xl/calcChain.xml');
    zip.file('xl/_rels/workbook.xml.rels', relXml.replace(/<Relationship[^>]*calcChain[^>]*\/>/g, ''));
    const types = await zip.file('[Content_Types].xml')?.async('string');
    if (types) zip.file('[Content_Types].xml', types.replace(/<Override[^>]*calcChain[^>]*\/>/g, ''));
  }
  return results;
}

/** Applies edits to the original file; returns the edited file and what happened to each edit. */
export async function applyOfficeEdits(original: Blob, fileName: string, edits: OfficeEdit[]): Promise<{ blob: Blob; results: EditResult[] }> {
  const zip = await JSZip.loadAsync(await original.arrayBuffer());
  const excel = /\.(xlsx|xlsm)$/i.test(fileName);
  const usable = edits.filter((e) => ('cell' in e) === excel);
  const applied = excel ? await editExcel(zip, usable as CellEdit[]) : await editWord(zip, usable as WordEdit[]);
  // Results in the same order as the edits.
  const results = edits.map((e) => usable.includes(e) ? applied[usable.indexOf(e)] : { label: describeEdit(e), ok: false, note: excel ? 'Not a cell edit' : 'Cell edits are for Excel files' });
  const type = excel ? (/\.xlsm$/i.test(fileName) ? 'application/vnd.ms-excel.sheet.macroEnabled.12' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const blob = await zip.generateAsync({ type: 'blob', mimeType: type, compression: 'DEFLATE' });
  return { blob, results };
}
