import { memo, useMemo } from 'react';
import { segments } from '../lib/markdown';
import { copyText } from '../lib/util';
import ChartBlock from './ChartBlock';
import FileCard from './FileCard';

function Markdown({ text, streaming }: { text: string; streaming: boolean }) {
  const parts = useMemo(() => segments(text, streaming), [text, streaming]);

  const onClick = async (e: React.MouseEvent) => {
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
        ) : p.type === 'file' ? (
          <FileCard key={p.key} name={p.name} content={p.content} complete={p.complete} />
        ) : (
          <ChartBlock key={p.key} content={p.content} complete={p.complete} />
        ),
      )}
    </div>
  );
}

export default memo(Markdown);
