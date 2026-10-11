import { Download, FileText, Loader2, Printer } from 'lucide-react';
import { useState } from 'react';
import { chatDocumentContent, chatExportName, chatToMarkdown } from '../lib/chat-export';
import { saveBlob } from '../lib/util';
import { useStore } from '../store';
import Modal from './Modal';

export default function ChatExportModal() {
  const id = useStore(state => state.exportChatId);
  const chat = useStore(state => state.chats.find(item => item.id === id));
  const { setUi, toast } = useStore.getState();
  const [busy, setBusy] = useState(false);
  const close = () => setUi({ exportChatId: null });
  if (!chat) return null;
  const download = async (format: 'md' | 'docx') => {
    setBusy(true);
    try {
      const blob = format === 'md' ? new Blob([chatToMarkdown(chat)], { type: 'text/markdown;charset=utf-8' }) : await (await import('../lib/generate/docx')).buildDocx(chatDocumentContent(chat));
      await saveBlob(blob, chatExportName(chat, format));
    } catch (error) { toast(`Export failed: ${(error as Error).message}`, 'error'); }
    finally { setBusy(false); }
  };
  return <Modal title="Export conversation" onClose={close}><div className="chat-export-panel">
    <h3 dir="auto">{chat.title}</h3>
    <p className="muted small">All saved messages, source links and Canvas drafts. Attachment names are included; original files and hidden thinking are not.</p>
    <div className="chat-export-options">
      <button className="btn" disabled={busy} onClick={() => void download('docx')}><FileText size={18} /><span>Word document<small>Editable .docx</small></span></button>
      <button className="btn" disabled={busy} onClick={() => { setUi({ exportChatId: null, preview: { name: chatExportName(chat, 'pdf'), content: chatDocumentContent(chat) } }); }}><Printer size={18} /><span>PDF<small>Preview, then choose Save as PDF</small></span></button>
      <button className="btn" disabled={busy} onClick={() => void download('md')}><Download size={18} /><span>Markdown<small>Portable plain text</small></span></button>
    </div>
    {busy && <p role="status" className="muted small"><Loader2 size={15} className="spin" /> Preparing your document…</p>}
    <p className="muted small">Exports are created on this device. Nothing is published or shared automatically.</p>
  </div></Modal>;
}
