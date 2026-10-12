// Renders model replies: Markdown + highlighted code + LaTeX maths, with file and chart blocks split out
// so they can be shown as interactive components.

import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import css from 'highlight.js/lib/languages/css';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import kotlin from 'highlight.js/lib/languages/kotlin';
import markdown from 'highlight.js/lib/languages/markdown';
import php from 'highlight.js/lib/languages/php';
import python from 'highlight.js/lib/languages/python';
import r from 'highlight.js/lib/languages/r';
import ruby from 'highlight.js/lib/languages/ruby';
import rust from 'highlight.js/lib/languages/rust';
import sql from 'highlight.js/lib/languages/sql';
import swift from 'highlight.js/lib/languages/swift';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import katex from 'katex';
import { Marked, type Token, type Tokens } from 'marked';
import { escapeHtml } from './util';
import { EDIT_FENCE, normalizeEdits, replaceReadRequests } from './edits';
import { replaceSearchRequests } from './repoindex';
import { runLang } from './runner';

Object.entries({ bash, c, cpp, csharp, css, go, java, javascript, json, kotlin, markdown, php, python, r, ruby, rust, sql, swift, typescript, xml, yaml }).forEach(
  ([name, lang]) => hljs.registerLanguage(name, lang),
);
hljs.registerAliases(['sh', 'shell', 'zsh'], { languageName: 'bash' });
hljs.registerAliases(['js', 'jsx'], { languageName: 'javascript' });
hljs.registerAliases(['ts', 'tsx'], { languageName: 'typescript' });
hljs.registerAliases(['py'], { languageName: 'python' });
hljs.registerAliases(['html', 'svg'], { languageName: 'xml' });
hljs.registerAliases(['yml'], { languageName: 'yaml' });
hljs.registerAliases(['cs'], { languageName: 'csharp' });

function tex(src: string, display: boolean): string {
  try {
    return katex.renderToString(src, { displayMode: display, throwOnError: false, output: 'html', strict: 'ignore' });
  } catch {
    return escapeHtml(src);
  }
}

function createMarkdown(highlight: boolean, sourceCount=0) {
const marked = new Marked({ gfm: true, breaks: true });

marked.use({
  extensions: [
    ...(sourceCount?[{name:'knowledgeCitation',level:'inline' as const,start:(src:string)=>src.indexOf('[D'),tokenizer(src:string){const match=/^\[D(\d{1,2})\](?![\[(])/.exec(src);if(match&&Number(match[1])>=1&&Number(match[1])<=sourceCount)return {type:'knowledgeCitation',raw:match[0],number:match[1]};return undefined;},renderer:(token:any)=>`<a href="#document-source-${token.number}" data-knowledge-citation="${token.number}" class="knowledge-inline-source" aria-label="Document source D${token.number}">[D${token.number}]</a>`}]:[]),
    {
      name: 'mathBlock',
      level: 'block',
      start: (src: string) => src.match(/\$\$|\\\[/)?.index,
      tokenizer(src: string) {
        const m = /^\$\$([\s\S]+?)\$\$/.exec(src) || /^\\\[([\s\S]+?)\\\]/.exec(src);
        if (m) return { type: 'mathBlock', raw: m[0], text: m[1].trim() };
        return undefined;
      },
      renderer: (token: any) => `<div class="math-block">${tex(token.text, true)}</div>`,
    },
    {
      name: 'mathInline',
      level: 'inline',
      start: (src: string) => src.match(/\$|\\\(/)?.index,
      tokenizer(src: string) {
        const m = /^\$(?!\s)((?:\\\$|[^$\n])+?)(?<!\s)\$(?!\d)/.exec(src) || /^\\\(([\s\S]+?)\\\)/.exec(src);
        if (m) return { type: 'mathInline', raw: m[0], text: m[1] };
        return undefined;
      },
      renderer: (token: any) => tex(token.text, false),
    },
  ],
  renderer: {
    code({ text, lang }: Tokens.Code) {
      const language = (lang || '').trim().split(/\s+/)[0].toLowerCase();
      let html = escapeHtml(text);
      if (highlight && language && hljs.getLanguage(language)) {
        try {
          html = hljs.highlight(text, { language, ignoreIllegals: true }).value;
        } catch {
          /* keep plain */
        }
      }
      const run = runLang(language || '') ? `<button type="button" class="code-copy code-run" data-run-code="${escapeHtml(language || '')}">▶ Run</button>` : '';
      return `<div class="code-block"><div class="code-head"><span>${escapeHtml(language || 'text')}</span><span class="code-actions">${run}<button type="button" class="code-copy" data-copy-code>Copy</button></span></div><pre><code class="hljs">${html}</code></pre></div>`;
    },
    link({ href, title, tokens }: Tokens.Link) {
      const text = this.parser.parseInline(tokens);
      return `<a href="${escapeHtml(href)}"${title ? ` title="${escapeHtml(title)}"` : ''} target="_blank" rel="noopener noreferrer">${text}</a>`;
    },
    table(token: Tokens.Table) {
      const cell = (c: Tokens.TableCell, i: number, tag: string) => {
        const align = token.align[i];
        return `<${tag} dir="auto"${align ? ` style="text-align:${align}"` : ''}>${this.parser.parseInline(c.tokens)}</${tag}>`;
      };
      const head = `<tr>${token.header.map((c, i) => cell(c, i, 'th')).join('')}</tr>`;
      const body = token.rows.map((r) => `<tr>${r.map((c, i) => cell(c, i, 'td')).join('')}</tr>`).join('');
      return `<div class="table-wrap"><table><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
    },
  },
});
return marked;
}
const marked = createMarkdown(true);
const streamingMarked = createMarkdown(false);
const citationParsers=new Map<string,Marked>();

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

const CALLOUT = /<blockquote>\s*<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(?:<br>)?\s*/gi;
const CALLOUT_LABEL: Record<string, string> = { NOTE: 'Note', TIP: 'Tip', IMPORTANT: 'Important', WARNING: 'Warning', CAUTION: 'Caution' };

export function renderMarkdown(text: string, highlight = true,sourceCount=0): string {
  sourceCount=Math.max(0,Math.min(6,Math.floor(sourceCount)));let parser=highlight?marked:streamingMarked;
  if(sourceCount){const key=`${highlight}:${sourceCount}`;if(!citationParsers.has(key))citationParsers.set(key,createMarkdown(highlight,sourceCount));parser=citationParsers.get(key)!;}
  const html = parser.parse(text, { async: false }) as string;
  return DOMPurify.sanitize(html, { ADD_ATTR: ['target', 'data-copy-code', 'data-run-code','data-knowledge-citation'] })
    .replace(CALLOUT, (_, kind: string) => `<blockquote class="callout callout-${kind.toLowerCase()}"><div class="callout-title">${CALLOUT_LABEL[kind.toUpperCase()]}</div><p>`)
    .replace(/<(p|li|h[1-6]|blockquote)( class="[^"]*")?>/g, '<$1$2 dir="auto">');
}

export type Segment =
  | { type: 'html'; html: string; key: string }
  | { type: 'file'; name: string; content: string; complete: boolean; key: string }
  | { type: 'chart'; content: string; complete: boolean; key: string }
  | { type: 'edit'; kind: 'edit' | 'delete'; path: string; content: string; complete: boolean; key: string };

const FILE_FENCE = /^file[:\s]\s*(.+?)\s*$/i;
const closed = (raw: string) => /\n\s*(`{3,}|~{3,})\s*$/.test(raw.trimEnd());

/** Splits a reply into Markdown parts and special file/chart blocks. */
export function segments(text: string, streaming: boolean,sourceCount=0): Segment[] {
  // A model asking to read repository files: [[read: src/app.ts]] → "📂 Reading `src/app.ts`"
  text = normalizeEdits(text);
  text = replaceReadRequests(text, (p) => `📂 Reading \`${p}\``);
  text = replaceSearchRequests(text, (q) => `🔎 Searching the code for \`${q.replace(/`/g, '')}\``);
  const tokens = marked.lexer(text);
  const out: Segment[] = [];
  let buffer: Token[] = [];
  let n = 0;
  const flush = () => {
    if (!buffer.length) return;
    const raw = buffer.map((t) => t.raw).join('');
    if (raw.trim()) out.push({ type: 'html', html: renderMarkdown(raw, !streaming,sourceCount), key: `h${n++}` });
    buffer = [];
  };
  tokens.forEach((t, i) => {
    if (t.type === 'code') {
      const lang = (t as Tokens.Code).lang || '';
      const file = FILE_FENCE.exec(lang);
      const complete = !streaming || i < tokens.length - 1 || closed(t.raw);
      const edit = EDIT_FENCE.exec(lang);
      if (edit) {
        flush();
        out.push({ type: 'edit', kind: edit[1].toLowerCase() as 'edit' | 'delete', path: edit[2], content: (t as Tokens.Code).text, complete, key: `e${n++}` });
        return;
      }
      if (file) {
        flush();
        out.push({ type: 'file', name: file[1], content: (t as Tokens.Code).text, complete, key: `f${n++}` });
        return;
      }
      if (lang.trim().toLowerCase() === 'chart') {
        flush();
        out.push({ type: 'chart', content: (t as Tokens.Code).text, complete, key: `c${n++}` });
        return;
      }
    }
    buffer.push(t);
  });
  flush();
  return out;
}

/** Plain text for reading aloud / copying without Markdown syntax. */
export function toPlainText(text: string): string {
  const div = document.createElement('div');
  div.innerHTML = renderMarkdown(text.replace(/`{3,}(?:file|edit|delete):[^\n]*\n[\s\S]*?`{3,}/g, '').replace(/```chart\n[\s\S]*?```/g, ''), false);
  div.querySelectorAll('.code-head').forEach((n) => n.remove());
  return (div.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}
