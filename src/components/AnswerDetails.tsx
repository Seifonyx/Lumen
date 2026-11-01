import './answer-details.css';
import { Columns2, FileText } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { modelLabel, useStore } from '../store';
import type { Chat, KnowledgeSource, Message } from '../types';
import { answerFacts, answerSelection, compareSource, requestCompareFrom, selectionWords } from '../lib/answer-details';
import { isTemporaryChat } from '../lib/temporary-chat';
import { PROVIDER_NAMES } from '../lib/util';
import Modal from './Modal';

const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

/** The provider named by a model id's prefix ("groq:…"); nothing when the id doesn't name one. */
function providerOf(model?: string) {
  const prefix = model?.includes(':') ? model.split(':')[0] : '';
  return prefix === 'gemini' ? 'Google AI Studio' : (PROVIDER_NAMES as Record<string, string>)[prefix] || '';
}

function Details({ message, chat, onDone, onSource }: { message: Message; chat?: Chat; onDone: (then?: () => void) => void; onSource: (source: KnowledgeSource) => void }) {
  const catalog = useStore((s) => s.catalog);
  const excluded = useStore((s) => (s.settings.autoExcluded || []).includes(message.model || ''));
  const name = modelLabel(catalog, message.model);
  const selection = answerSelection(message);
  const source = compareSource(chat, message.id);
  const facts = answerFacts(message, source.question);
  const provider = providerOf(message.model);
  const web = message.research ? [] : message.sources || [];
  const documents = message.knowledgeSources || [];
  const when = new Date(message.createdAt);
  const reply = [facts.status, facts.research, facts.privacy, facts.memory, chat && isTemporaryChat(chat) ? 'Incognito: this chat isn’t saved.' : ''].filter(Boolean);
  return (
    <div className="ad-body">
      <section className="ad-section" aria-label="Model">
        <span className="ad-model">{message.model ? name : 'Model not recorded'}</span>
        {provider && <span className="ad-sub">{provider}</span>}
      </section>
      <section className="ad-section">
        <h3 className="ad-label">{selectionWords(selection)}</h3>
        {selection.kind === 'unrecorded' && <p className="ad-sub">No selection reason was saved with this answer. Lumen saves one when Auto or a layout picks the model.</p>}
        {selection.kind === 'combined' && <p className="ad-sub">{name} wrote this from the compared answers ({selection.reasons[0].toLowerCase()}).</p>}
        {(selection.kind === 'auto' || selection.kind === 'layout') && !!selection.reasons.length && <ul className="ad-list">{selection.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
        {selection.kind === 'layout' && !selection.reasons.length && <p className="ad-sub">The {selection.layout} layout answered. No further reason was saved.</p>}
        {selection.switched && <p className="ad-sub">Lumen switched models while answering: {selection.switched}.</p>}
        {selection.kind === 'auto' && <p className="ad-note">Fit is estimated from capabilities and model-family hints. Answer quality is not guaranteed.</p>}
        {!!selection.next.length && <>
          <h3 className="ad-label">Recorded alternatives</h3>
          <p className="ad-note">Candidates at that selection, not promised next models.</p>
          <ol className="ad-list">{selection.next.map((id) => <li key={id}>{modelLabel(catalog, id)}</li>)}</ol>
        </>}
        {selection.kind === 'auto' && message.model && (
          <label className="rw-toggle ad-toggle">
            <input type="checkbox" checked={excluded} onChange={(e) => useStore.getState().setAutoExcluded(message.model!, e.target.checked)} />
            <span>Never use {name} in Auto<small>You can still pick it yourself.</small></span>
          </label>
        )}
      </section>
      {(web.length > 0 || documents.length > 0) && (
        <section className="ad-section">
          <h3 className="ad-label">Sources</h3>
          <ul className="ad-sources">
            {web.map((s, i) => <li key={s.url + i}><a href={s.url} target="_blank" rel="noopener noreferrer"><span className="source-n">{i + 1}</span><span>{s.title && !/^https?:/.test(s.title) ? s.title : hostOf(s.url)}</span><small>{hostOf(s.url)}</small></a></li>)}
            {documents.map((d, i) => <li key={`${d.docId}:${d.page}`}><button type="button" onClick={() => onDone(() => onSource(d))}><span className="source-n">D{i + 1}</span><span>{d.title}</span><small><FileText size={12} aria-hidden="true" /> {/\.pdf$/i.test(d.title) ? 'PDF page' : 'Section'} {d.page}</small></button></li>)}
          </ul>
        </section>
      )}
      <section className="ad-section">
        <h3 className="ad-label">This reply</h3>
        <ul className="ad-facts">
          {reply.map((line) => <li key={line}>{line}</li>)}
          <li><time dateTime={when.toISOString()}>Answered {when.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time></li>
        </ul>
      </section>
      <section className="ad-section ad-compare">
        <button type="button" className="btn small" disabled={!source.ok} aria-describedby={`ad-compare-${message.id}`} onClick={() => chat && onDone(() => requestCompareFrom(chat.id, message.id))}><Columns2 size={15} aria-hidden="true" /> Compare with…</button>
        <p className="ad-note" id={`ad-compare-${message.id}`}>{source.ok ? 'Asks your question again of the models you pick. Each one is a new request; this reply stays as it is.' : source.reason}</p>
      </section>
    </div>
  );
}

/** Answer details: everything Lumen saved about a reply, behind its model name. A sheet on phones, a popover anchored
 * to the model name on computers. Loaded on first open (canvas-presentation.on.ts). */
export default function AnswerDetails({ message, anchor, onClose, onSource }: { message: Message; anchor: HTMLElement; onClose: () => void; onSource: (source: KnowledgeSource) => void }) {
  const chat = useStore((s) => s.chats.find((c) => c.messages.some((m) => m.id === message.id)));
  const [sheet] = useState(() => window.matchMedia('(max-width: 899px)').matches);
  const pop = useRef<HTMLDivElement>(null);
  const trigger = () => anchor.querySelector<HTMLElement>('.answer-details-btn');
  // Closing first lets focus go back to the model name, so whatever opens next (Compare, a document) returns there too.
  const done = (then?: () => void) => { onClose(); if (then) setTimeout(() => { trigger()?.focus({ preventScroll: true }); then(); }, 0); };
  useEffect(() => {
    if (sheet) return;
    pop.current?.focus({ preventScroll: true });
    const away = (e: PointerEvent) => { if (!anchor.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); trigger()?.focus(); } };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', key, true); };
  }, [sheet]); // eslint-disable-line react-hooks/exhaustive-deps
  // Opens above the model name, or below it when the top bar leaves too little room; never taller than the room it has.
  useLayoutEffect(() => {
    const el = pop.current;
    if (sheet || !el) return;
    const bar = Math.max(0, anchor.closest('.main')?.querySelector(':scope > .topbar')?.getBoundingClientRect().bottom || 0);
    const r = anchor.getBoundingClientRect(), above = r.top - bar - 16, below = window.innerHeight - r.bottom - 16;
    const down = above < Math.min(el.scrollHeight, 360) && below > above;
    anchor.toggleAttribute('data-below', down);
    el.style.maxHeight = `${Math.max(160, down ? below : above)}px`;
  }, [sheet]); // eslint-disable-line react-hooks/exhaustive-deps
  const body = <Details message={message} chat={chat} onDone={done} onSource={onSource} />;
  if (sheet) return <Modal title="Answer details" onClose={onClose}>{body}</Modal>;
  return (
    <div className="answer-details-pop" role="dialog" aria-label="Answer details" tabIndex={-1} ref={pop}>
      <strong className="ad-title">Answer details</strong>
      {body}
    </div>
  );
}
