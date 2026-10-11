// Markdown document → styled HTML page. Used for document previews and for "Save as PDF" (browser print).

import DOMPurify from 'dompurify';
import { Marked } from 'marked';
import { escapeHtml, isRtl } from '../util';
import { hex, splitDocConfig } from './spec';

const md = new Marked({ gfm: true, breaks: false });

const CALLOUTS: Record<string, [string, string, string]> = {
  NOTE: ['Note', '#2F6FB3', '#EAF2FB'],
  TIP: ['Tip', '#2E7D4F', '#EAF6EF'],
  IMPORTANT: ['Important', '#7A4CB0', '#F3EEFA'],
  WARNING: ['Warning', '#B7791F', '#FDF6E7'],
  CAUTION: ['Caution', '#C0392B', '#FCEDEB'],
};

export function documentHtml(content: string): { body: string; css: string; title: string; rtl: boolean } {
  const { config, body } = splitDocConfig(content);
  const theme = `#${hex(config.theme, '1F4E79')}`;
  const raw = md.parse(body.replace(/<!--\s*pagebreak\s*-->/gi, '<div class="page-break"></div>')) as string;
  const clean = DOMPurify.sanitize(raw, { ADD_ATTR: ['style'] });
  const doc = new DOMParser().parseFromString(`<div id="r">${clean}</div>`, 'text/html');
  const root = doc.getElementById('r')!;

  root.querySelectorAll('blockquote').forEach((q) => {
    const p = q.querySelector('p');
    const m = p && /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i.exec(p.innerHTML);
    if (!p || !m) return;
    const [label, color, fill] = CALLOUTS[m[1].toUpperCase()];
    p.innerHTML = p.innerHTML.slice(m[0].length).replace(/^<br>\s*/, '');
    q.className = 'callout';
    q.setAttribute('style', `border-color:${color};background:${fill}`);
    q.insertAdjacentHTML('afterbegin', `<div class="callout-title" style="color:${color}">${label}</div>`);
  });
  root.querySelectorAll('p,li,h1,h2,h3,h4,h5,h6,td,th,blockquote,div.callout-title').forEach((el) => el.setAttribute('dir', 'auto'));
  root.querySelectorAll('table').forEach((t) => {
    if (isRtl(t.querySelector('th')?.textContent || '')) t.setAttribute('dir', 'rtl');
  });

  let cover = '';
  if (config.cover && config.title) {
    const dateText = config.date || new Date().toLocaleDateString(isRtl(config.title) ? 'ar-EG' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
    cover = `<section class="cover" dir="auto"><h1 class="cover-title">${escapeHtml(config.title)}</h1><div class="cover-rule"></div>${
      config.subtitle ? `<p class="cover-sub">${escapeHtml(config.subtitle)}</p>` : ''
    }<div class="cover-meta">${config.author ? `<div>${escapeHtml(config.author)}</div>` : ''}<div>${escapeHtml(dateText)}</div></div></section>`;
  } else if (config.title) {
    cover = `<h1 class="doc-title" dir="auto">${escapeHtml(config.title)}</h1>${config.subtitle ? `<p class="doc-sub" dir="auto">${escapeHtml(config.subtitle)}</p>` : ''}`;
  }

  const css = `
    .doc{font:11pt/1.55 Calibri,"Segoe UI",Arial,"Noto Sans Arabic",sans-serif;color:#1f1f1f;max-width:780px;margin:0 auto;padding:40px 48px;background:#fff;overflow-wrap:anywhere}
    .doc h1,.doc h2{color:${theme};line-height:1.25}
    .doc h1{font-size:20pt;margin:1.2em 0 .4em}.doc h2{font-size:16pt;margin:1.1em 0 .4em}.doc h3{font-size:13pt;margin:1em 0 .3em}
    .doc .doc-title{font-size:26pt;margin:0 0 .2em}.doc .doc-sub{color:#666;font-size:13pt;margin:0 0 1.2em}
    .doc table{border-collapse:collapse;width:100%;margin:.8em 0}
    .doc th{background:${theme};color:#fff;text-align:start}
    .doc th,.doc td{border:1px solid #C9CED6;padding:6px 9px;vertical-align:top}
    .doc tr:nth-child(even) td{background:#F3F5F8}
    .doc blockquote{margin:.8em 0;padding:.2em 1em;border-inline-start:3px solid #bbb;color:#555;font-style:italic}
    .doc .callout{font-style:normal;color:#1f1f1f;border-inline-start:5px solid;border-radius:4px;padding:.6em 1em}
    .doc .callout-title{font-weight:700;margin-bottom:.2em}
    .doc pre{background:#F4F4F2;padding:10px 12px;border-radius:6px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:9.5pt}
    .doc code{font-family:Consolas,Menlo,monospace}.doc :not(pre)>code{background:#EFEFEC;padding:0 4px;border-radius:3px}
    .doc mark{background:#FFF2A8}.doc a{color:#1F6FB2}
    .doc hr{border:0;border-top:1px solid #bbb;margin:1.2em 0}
    .doc .cover{min-height:70vh;display:flex;flex-direction:column;justify-content:center}
    .doc .cover-title{font-size:34pt;color:${theme};margin:0}.doc .cover-rule{height:4px;width:120px;background:${theme};margin:18px 0}
    .doc .cover-sub{font-size:16pt;color:#555;margin:0}.doc .cover-meta{margin-top:60px;color:#666}
    .doc .page-break{height:0}
    @media print{.doc{padding:0;max-width:none}.doc .cover{min-height:auto;height:90vh;page-break-after:always}.doc .page-break{page-break-after:always}.doc table,.doc .callout{page-break-inside:avoid}}
  `;
  return { body: cover + root.innerHTML, css, title: config.title || '', rtl: isRtl(body.replace(/[#*>|`\-\d.\s]/g, '')) };
}

/** Opens the system print dialog for a document (choose "Save as PDF"). */
export function printDocument(content: string, name: string) {
  const { body, css, rtl } = documentHtml(content);
  const html = `<!doctype html><html dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${escapeHtml(name.replace(/\.pdf$/i, ''))}</title><style>@page{margin:18mm}body{margin:0}${css}</style></head><body><div class="doc">${body}</div></body></html>`;
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const win = frame.contentWindow!;
  win.document.open();
  win.document.write(html);
  win.document.close();
  setTimeout(() => {
    win.focus();
    win.print();
    setTimeout(() => frame.remove(), 60_000);
  }, 250);
}
