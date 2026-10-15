// Writing tools for a piece of selected text: Improve, Shorter, Simpler, More formal, Friendlier, bullet points or
// Translate. The result is shown first; you choose to put it in the reply, copy it, or try again.
import { ArrowLeft, Check, Copy, Languages, Loader2, RefreshCw, Replace, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { copyText } from '../lib/util';
import { translateTargets, WRITING_ACTIONS } from '../lib/writing-tools';
import { useStore } from '../store';

export default function WritingTools({ text, chatId, messageId, onDone }: { text: string; chatId?: string; messageId?: string; onDone?: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ label: string; ask: string; text: string } | null>(null);
  const [languages, setLanguages] = useState(false);
  const [copied, setCopied] = useState(false);
  const message = useStore((s) => (chatId && messageId ? s.chats.find((c) => c.id === chatId)?.messages.find((m) => m.id === messageId) : undefined));
  const canReplace = Boolean(message && message.text.split(text).length === 2);
  const run = async (label: string, ask: string) => {
    setBusy(label); setLanguages(false); setCopied(false);
    const out = await useStore.getState().rewriteText(text, ask);
    setBusy(null);
    if (out) setResult({ label, ask, text: out });
    else useStore.getState().toast("Couldn't rewrite that right now. Try again in a minute.", 'error');
  };
  if (result) {
    return (
      <div className="writing-tools result" onPointerDown={(e) => e.stopPropagation()}>
        <div className="writing-result-head"><Sparkles size={14} /> <span>{result.label}</span></div>
        <div className="writing-result" dir="auto">{result.text}</div>
        <div className="writing-result-actions">
          <button type="button" className="btn small ghost" onClick={() => setResult(null)}><ArrowLeft size={14} /> Back</button>
          <span className="spacer" />
          <button type="button" className="btn small ghost" disabled={Boolean(busy)} onClick={() => void run(result.label, result.ask)}>{busy ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />} Try again</button>
          <button type="button" className="btn small" onClick={async () => { if (await copyText(result.text)) setCopied(true); }}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}</button>
          {canReplace && (
            <button type="button" className="btn small primary" onClick={async () => {
              if (await useStore.getState().replaceInMessage(chatId!, messageId!, text, result.text)) { useStore.getState().toast('Changed in the reply.', 'success'); onDone?.(); }
            }}><Replace size={14} /> Use in reply</button>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="writing-tools" role="group" aria-label="Writing tools" onPointerDown={(e) => e.stopPropagation()}>
      {languages ? (
        <>
          <button type="button" className="writing-chip" onClick={() => setLanguages(false)} aria-label="Back"><ArrowLeft size={14} /></button>
          {translateTargets().map((lang) => (
            <button key={lang} type="button" className="writing-chip" disabled={Boolean(busy)} onClick={() => void run(`Translated to ${lang}`, `Translate it into ${lang}. Keep the meaning, tone and formatting.`)}>
              {busy === `Translated to ${lang}` && <Loader2 size={13} className="spin" />}{lang}
            </button>
          ))}
        </>
      ) : (
        <>
          {WRITING_ACTIONS.map((a) => (
            <button key={a.id} type="button" className="writing-chip" disabled={Boolean(busy)} onClick={() => void run(a.label, a.ask)}>
              {busy === a.label && <Loader2 size={13} className="spin" />}{a.label}
            </button>
          ))}
          <button type="button" className="writing-chip" disabled={Boolean(busy)} onClick={() => setLanguages(true)}><Languages size={13} /> Translate</button>
        </>
      )}
    </div>
  );
}
