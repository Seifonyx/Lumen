import { memo, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { fadeInText, motionOff, settleText, type Arrivals } from '../lib/motion';
import { markdownExtrasVersion, segments, subscribeMarkdownExtras, type Segment } from '../lib/markdown';
import { copyText } from '../lib/util';
import { useStore } from '../store';
import ChartBlock from './ChartBlock';
import FileCard from './FileCard';
import OfficeEditCard from './OfficeEditCard';
import EditCard, { ApplyAll } from './EditCard';
import { parseEdit } from '../lib/edits';
import type { KnowledgeSource } from '../types';

// Finished messages are parsed and sanitised once and reused (switching chats, re-renders): this is most of
// the cost of opening a long chat. Keyed by text, citation count and whether maths/code colouring had loaded.
const CACHE_SIZE = 400;
const cache = new Map<string, Segment[]>();
function cachedSegments(text: string, streaming: boolean, count: number, extras: number): Segment[] {
  if (streaming) return segments(text, true, count);
  const key = `${extras}|${count}|${text}`;
  const hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return hit; }
  const parts = segments(text, false, count);
  cache.set(key, parts);
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
  return parts;
}

// While a reply streams, its finished paragraphs (everything before the last blank line that isn't inside a
// code block) are parsed once each and reused, so each update re-draws only the paragraph still being written
// instead of the whole reply. That keeps long replies, and the rest of the app, smooth while text arrives.
const FENCE = /^ {0,3}(`{3,}|~{3,})/gm;
function streamingSegments(text: string, count: number, extras: number): Segment[] {
  // Repository edits written as SEARCH/REPLACE blocks can span blank lines: parse those replies whole.
  if (/<{5,9} ?SEARCH/.test(text)) return segments(text, true, count);
  const blocks: string[] = [];
  let start = 0, open = false, last = 0;
  for (let i = text.indexOf('\n\n'); i >= 0; i = text.indexOf('\n\n', i + 2)) {
    // Inside a code block a blank line isn't a paragraph break.
    open = ((text.slice(last, i).match(FENCE) || []).length % 2 === 1) !== open;
    last = i;
    if (open) continue;
    blocks.push(text.slice(start, i + 2));
    start = i + 2;
  }
  const out: Segment[] = [];
  blocks.forEach((b, i) => { if (b.trim()) for (const p of cachedSegments(b, false, count, extras)) out.push({ ...p, key: `b${i}${p.key}` }); });
  for (const p of segments(text.slice(start), true, count)) out.push({ ...p, key: `t${p.key}` });
  return out;
}

function Markdown({ text, streaming, messageId,knowledgeSources,onSource }: { text: string; streaming: boolean; messageId?: string; knowledgeSources?:KnowledgeSource[]; onSource?:(source:KnowledgeSource)=>void }) {
  const count=knowledgeSources?.length||0;
  // Re-render once maths and code colouring have loaded.
  const extras = useSyncExternalStore(subscribeMarkdownExtras, markdownExtrasVersion);
  const parts = useMemo(() => (streaming ? streamingSegments(text, count, extras) : cachedSegments(text, false, count, extras)), [text, streaming, count, extras]);
  const edits = useMemo(
    () => (streaming ? [] : parts.flatMap((p) => (p.type === 'edit' && p.complete ? [parseEdit(p.kind, p.path, p.content)] : []))),
    [parts, streaming],
  );

  // New words fade in as a reply streams.
  const root = useRef<HTMLDivElement>(null);
  const arrivals = useRef<Arrivals | null>(null);
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    if (!streaming || motionOff()) { if (arrivals.current) { arrivals.current = null; settleText(el); } return; }
    // Joining a reply that's already well under way (switching back to its chat) shows what's there at once.
    arrivals.current ??= { total: text.length > 400 ? Infinity : 0, list: [] };
    fadeInText(el, arrivals.current);
  }, [parts, streaming]); // eslint-disable-line react-hooks/exhaustive-deps

  const setUi = useStore((s) => s.setUi);
  const onClick = async (e: React.MouseEvent) => {
    const citation=(e.target as HTMLElement).closest('[data-knowledge-citation]') as HTMLElement|null;
    if(citation){e.preventDefault();const source=knowledgeSources?.[Number(citation.dataset.knowledgeCitation)-1];if(source)onSource?.(source);return;}
    const runBtn = (e.target as HTMLElement).closest('[data-run-code]') as HTMLButtonElement | null;
    if (runBtn) {
      const code = runBtn.closest('.code-block')?.querySelector('code')?.textContent || '';
      setUi({ runner: { lang: runBtn.dataset.runCode || '', code } });
      return;
    }
    const btn = (e.target as HTMLElement).closest('[data-copy-code]') as HTMLButtonElement | null;
    if (!btn) return;
    const code = btn.closest('.code-block')?.querySelector('code')?.textContent || '';
    if (await copyText(code)) {
      btn.textContent = 'Copied';
      setTimeout(() => (btn.textContent = 'Copy'), 1500);
    }
  };

  return (
    <div className="markdown" onClick={onClick} ref={root}>
      {parts.map((p) =>
        p.type === 'html' ? (
          <div key={p.key} dangerouslySetInnerHTML={{ __html: p.html }} />
        ) : p.type === 'edit' ? (
          <EditCard key={p.key} kind={p.kind} path={p.path} content={p.content} complete={p.complete} messageId={messageId} />
        ) : p.type === 'office' ? (
          <OfficeEditCard key={p.key} name={p.name} content={p.content} complete={p.complete} />
        ) : p.type === 'file' ? (
          <FileCard key={p.key} name={p.name} content={p.content} complete={p.complete} />
        ) : (
          <ChartBlock key={p.key} content={p.content} complete={p.complete} />
        ),
      )}
      {edits.length > 1 && <ApplyAll edits={edits} messageId={messageId} />}
    </div>
  );
}

export default memo(Markdown);
