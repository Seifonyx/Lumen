import { Check, Copy, Download, FileText, Globe, Link2Off, Loader2, Printer, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { listShares, shareChat, shareFindings, shareUrl, stopSharing, type ShareInfo } from '../lib/share';
import { copyText } from '../lib/util';
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
  const owner = useStore((s) => s.user?.uid);
  const [share, setShare] = useState<ShareInfo | null | undefined>(undefined);
  const [hide, setHide] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!owner || !id) return;
    let live = true;
    listShares(owner).then((all) => { if (live) setShare(all.find((x) => x.chatId === id) || null); }).catch(() => { if (live) setShare(null); });
    return () => { live = false; };
  }, [owner, id]);
  if (!chat) return null;
  const findings = shareFindings(chat);
  const kinds = [...new Set(findings.map((f) => f.kind.toLowerCase().replace(/_/g, ' ')))];
  const publish = async () => {
    if (!owner) return;
    setSharing(true);
    try {
      const mask = findings.length > 0 && hide;
      const shareId = await shareChat(owner, chat, mask, share?.id);
      setShare({ id: shareId, chatId: chat.id, title: chat.title, masked: mask, updatedAt: Date.now() });
      toast(share ? 'Link updated with the latest messages' : 'Public link created', 'success');
    } catch (e) { toast(`Couldn’t share: ${(e as Error).message}`, 'error'); }
    finally { setSharing(false); }
  };
  const unshare = async () => {
    if (!share || !confirm('Stop sharing? The link will stop working for everyone.')) return;
    setSharing(true);
    try { await stopSharing(share.id); setShare(null); toast('Link removed', 'info'); }
    catch (e) { toast(`Couldn’t remove the link: ${(e as Error).message}`, 'error'); }
    finally { setSharing(false); }
  };
  const copy = async () => { if (share && await copyText(shareUrl(share.id))) { setCopied(true); setTimeout(() => setCopied(false), 1500); } };
  const download = async (format: 'md' | 'docx') => {
    setBusy(true);
    try {
      const blob = format === 'md' ? new Blob([chatToMarkdown(chat)], { type: 'text/markdown;charset=utf-8' }) : await (await import('../lib/generate/docx')).buildDocx(chatDocumentContent(chat));
      await saveBlob(blob, chatExportName(chat, format));
    } catch (error) { toast(`Export failed: ${(error as Error).message}`, 'error'); }
    finally { setBusy(false); }
  };
  return <Modal title="Share or export" onClose={close}><div className="chat-export-panel">
    <h3 dir="auto">{chat.title}</h3>
    <p className="muted small">All saved messages, source links and Canvas drafts. Attachment names are included; original files and hidden thinking are not.</p>
    <div className="chat-export-options">
      <button className="btn" disabled={busy} onClick={() => void download('docx')}><FileText size={18} /><span>Word document<small>Editable .docx</small></span></button>
      <button className="btn" disabled={busy} onClick={() => { setUi({ exportChatId: null, preview: { name: chatExportName(chat, 'pdf'), content: chatDocumentContent(chat) } }); }}><Printer size={18} /><span>PDF<small>Preview, then choose Save as PDF</small></span></button>
      <button className="btn" disabled={busy} onClick={() => void download('md')}><Download size={18} /><span>Markdown<small>Portable plain text</small></span></button>
    </div>
    {busy && <p role="status" className="muted small"><Loader2 size={15} className="spin" /> Preparing your document…</p>}
    <section className="share-panel" aria-label="Public link">
      <div className="share-head"><Globe size={17} /><strong>Public link</strong>{share && <span className="key-status-pill configured">On</span>}</div>
      {share === undefined ? <p className="muted small"><Loader2 size={14} className="spin" /> Checking for an existing link…</p> : share ? <>
        <div className="share-link"><input readOnly aria-label="Public link" value={shareUrl(share.id)} onFocus={(e) => e.currentTarget.select()} /><button className="btn small" onClick={() => void copy()}>{copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy'}</button></div>
        <p className="muted small">Anyone with the link can read this chat’s text{share.masked ? ', with personal details hidden' : ''}. It doesn’t change when you keep chatting.</p>
        <div className="share-actions"><button className="btn small" disabled={sharing} onClick={() => void publish()}><RefreshCw size={14} /> Update with latest messages</button><button className="btn ghost small danger" disabled={sharing} onClick={() => void unshare()}><Link2Off size={14} /> Stop sharing</button></div>
      </> : <>
        <p className="muted small">Creates a read-only copy of this chat’s text that anyone with the link can open, without signing in. Attachments are listed by name only.</p>
        {findings.length > 0 && <label className="share-mask"><input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} /><span><b>Hide personal details</b> ({findings.length} found: {kinds.join(', ')}). They appear as placeholders like [NAME_1].</span></label>}
        <button className="btn primary small" disabled={sharing || !owner} onClick={() => void publish()}>{sharing ? <Loader2 size={15} className="spin" /> : <Globe size={15} />} Create public link</button>
      </>}
    </section>
    <p className="muted small">Exports are created on this device. Nothing is published unless you create a link.</p>
  </div></Modal>;
}
