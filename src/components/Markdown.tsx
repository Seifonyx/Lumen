import { memo, useMemo, useSyncExternalStore } from 'react';
import { markdownExtrasVersion, segments, subscribeMarkdownExtras } from '../lib/markdown';
import { copyText } from '../lib/util';
import { useStore } from '../store';
import ChartBlock from './ChartBlock';
import FileCard from './FileCard';
import OfficeEditCard from './OfficeEditCard';
import EditCard, { ApplyAll } from './EditCard';
import { parseEdit } from '../lib/edits';
import type { KnowledgeSource } from '../types';

function Markdown({ text, streaming, messageId,knowledgeSources,onSource }: { text: string; streaming: boolean; messageId?: string; knowledgeSources?:KnowledgeSource[]; onSource?:(source:KnowledgeSource)=>void }) {
  const count=knowledgeSources?.length||0;
  // Re-render once maths and code colouring have loaded.
  const extras = useSyncExternalStore(subscribeMarkdownExtras, markdownExtrasVersion);
  const parts = useMemo(() => segments(text, streaming,count), [text, streaming,count, extras]);
  const edits = useMemo(
    () => (streaming ? [] : parts.flatMap((p) => (p.type === 'edit' && p.complete ? [parseEdit(p.kind, p.path, p.content)] : []))),
    [parts, streaming],
  );

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
    <div className="markdown" onClick={onClick}>
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
