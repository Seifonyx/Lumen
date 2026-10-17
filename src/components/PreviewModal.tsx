import { Copy, Download, Loader2, Printer } from 'lucide-react';
import { lazy, Suspense, useMemo, useState } from 'react';
import { buildFile, fileKind } from '../lib/generate';
import { documentHtml, printDocument } from '../lib/generate/doc-html';
import { renderMarkdown } from '../lib/markdown';
import { copyText, extOf, saveBlob } from '../lib/util';
import { useStore } from '../store';
import Modal from './Modal';

const SheetPreview = lazy(() => import('./SheetPreview'));
const DeckPreview = lazy(() => import('./DeckPreview'));

function DocFrame({ content }: { content: string }) {
  const html = useMemo(() => {
    const { body, css, rtl } = documentHtml(content);
    return `<!doctype html><html dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><style>body{margin:0;background:#e9e9e6}.doc{margin:16px auto;box-shadow:0 1px 4px rgba(0,0,0,.12)}@media (max-width:640px){.doc{padding:24px 18px;margin:0}}${css}</style></head><body><div class="doc">${body}</div></body></html>`;
  }, [content]);
  return <iframe className="preview-frame" title="Document preview" sandbox="" srcDoc={html} />;
}

function CodeView({ name, content }: { name: string; content: string }) {
  const ext = extOf(name);
  const html = useMemo(() => renderMarkdown(`\`\`\`\`${ext === 'txt' ? 'text' : ext}\n${content}\n\`\`\`\``), [ext, content]);
  return <div className="markdown code-preview" dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function PreviewModal() {
  const preview = useStore((s) => s.preview);
  const setUi = useStore((s) => s.setUi);
  const toast = useStore((s) => s.toast);
  const [busy, setBusy] = useState(false);
  if (!preview) return null;
  const { name, content } = preview;
  const { kind, label } = fileKind(name);
  const close = () => setUi({ preview: null });

  const save = async () => {
    if (kind === 'pdf') {
      printDocument(content, name);
      return;
    }
    setBusy(true);
    try {
      await saveBlob(await buildFile(name, content), name);
    } catch (e) {
      toast(`Couldn't create ${name}: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  let body: React.ReactNode;
  if (kind === 'docx' || kind === 'pdf' || kind === 'markdown') body = <DocFrame content={content} />;
  else if (kind === 'xlsx' || kind === 'csv') body = <SheetPreview content={content} />;
  else if (kind === 'pptx') body = <DeckPreview content={content} />;
  else if (kind === 'html') body = <iframe className="preview-frame" title="Web page preview" sandbox="allow-scripts allow-forms allow-modals" srcDoc={content} />;
  else body = <CodeView name={name} content={content} />;

  return (
    <Modal
      full
      origin={preview.from}
      onClose={close}
      title={
        <span className="preview-title">
          <span dir="auto">{name}</span>
          <span className="muted small">{label}</span>
        </span>
      }
      actions={
        <>
          <button className="icon-btn" aria-label="Copy contents" title="Copy contents" onClick={async () => (await copyText(content)) && toast('Copied', 'success')}>
            <Copy size={18} />
          </button>
          <button className="btn primary small" onClick={save} disabled={busy}>
            {busy ? <Loader2 size={16} className="spin" /> : kind === 'pdf' ? <Printer size={16} /> : <Download size={16} />}
            {kind === 'pdf' ? 'Save PDF' : 'Save'}
          </button>
        </>
      }
    >
      <Suspense fallback={<div className="center pad"><Loader2 className="spin" /></div>}>{body}</Suspense>
    </Modal>
  );
}
