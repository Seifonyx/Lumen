import { memo, useMemo } from 'react';
import { segments } from '../lib/markdown';
import { copyText } from '../lib/util';
import { useStore } from '../store';
import ChartBlock from './ChartBlock';
import FileCard from './FileCard';
import EditCard, { ApplyAll } from './EditCard';
import { parseEdit } from '../lib/edits';

function Markdown({ text, streaming }: { text: string; streaming: boolean }) {
  const parts = useMemo(() => segments(text, streaming), [text, streaming]);
  const edits = useMemo(
    () => (streaming ? [] : parts.flatMap((p) => (p.type === 'edit' && p.complete ? [parseEdit(p.kind, p.path, p.content)] : []))),
    [parts, streaming],
  );

  const setUi = useStore((s) => s.setUi);
  const onClick = async (e: React.MouseEvent) => {
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
          <EditCard key={p.key} kind={p.kind} path={p.path} content={p.content} complete={p.complete} />
        ) : p.type === 'file' ? (
          <FileCard key={p.key} name={p.name} content={p.content} complete={p.complete} />
        ) : (
          <ChartBlock key={p.key} content={p.content} complete={p.complete} />
        ),
      )}
      {edits.length > 1 && <ApplyAll edits={edits} />}
    </div>
  );
}

export default memo(Markdown);
