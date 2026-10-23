import { useEffect, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import Logo from './Logo';
import { BrandWordmark } from '../lib/brand-identity';
import { readShare, type SharedChat } from '../lib/share';
import { segments } from '../lib/markdown';

/** The public, read-only page for a shared chat (/share/<id>). Works without signing in. */
export default function SharedChatPage({ id }: { id: string }) {
  const [chat, setChat] = useState<SharedChat | null | undefined>(undefined);
  const [error, setError] = useState('');
  useEffect(() => {
    const robots = document.createElement('meta');
    robots.name = 'robots'; robots.content = 'noindex, nofollow';
    document.head.appendChild(robots);
    readShare(id).then((c) => { setChat(c); if (c) document.title = `${c.title} · Lumen`; }).catch(() => setError('This link couldn’t be opened. Check your connection and try again.'));
    return () => robots.remove();
  }, [id]);

  return (
    <div className="shared-page">
      <header className="shared-top">
        {BrandWordmark ? <a className="shared-brand" href="/"><BrandWordmark height={20} /></a> : <a className="shared-brand" href="/"><Logo size={22} /> Lumen</a>}
        <span className="shared-badge">Shared chat · read-only</span>
      </header>
      <main className="shared-main">
        {chat === undefined && !error ? <p className="shared-state"><Loader2 size={18} className="spin" /> Opening…</p>
          : error ? <p className="shared-state">{error}</p>
          : !chat ? <div className="shared-state"><h1>This link isn’t available</h1><p>It may have been removed by the person who shared it.</p></div>
          : <>
            <h1 className="shared-title" dir="auto">{chat.title}</h1>
            {chat.masked && <p className="shared-note">Personal details were hidden before sharing and appear as placeholders like [NAME_1].</p>}
            <div className="shared-thread">
              {chat.messages.map((m, i) => (
                <div key={i} className={`shared-msg ${m.role}`}>
                  {m.files?.length ? <div className="shared-files">{m.files.map((f) => <span key={f}><FileText size={13} /> {f}</span>)}</div> : null}
                  {m.role === 'user'
                    ? <p className="shared-bubble" dir="auto">{m.text}</p>
                    : <div className="markdown">{segments(m.text, false).map((p) => p.type === 'html' ? <div key={p.key} dangerouslySetInnerHTML={{ __html: p.html }} /> : p.type === 'file' || p.type === 'office' ? <p key={p.key} className="shared-files"><span><FileText size={13} /> {p.name}</span></p> : null)}</div>}
                  {m.model && <span className="shared-model">{m.model.split(':').slice(1).join(':')}</span>}
                </div>
              ))}
            </div>
          </>}
      </main>
      <footer className="shared-foot">Shared from Lumen. The person who shared this can turn the link off at any time.</footer>
    </div>
  );
}
