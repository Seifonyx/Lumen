import { ChevronDown, ExternalLink, Loader2, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { geminiKeyLock, keyVersion, openRouterKeyInfo } from '../lib/ai/providers.js';
import { useStore } from '../store';

type Gemini = { state: 'locked' | 'open' | 'wrong-site' | 'invalid' | 'error'; message?: string } | null;
type OpenRouter = { state: 'capped' | 'free' | 'open' | 'limit' | 'error'; limit?: number; used?: number; message?: string } | null;

const SITE = 'https://lumen-chat.web.app/*';

function Status({ ok, warn, children }: { ok: boolean; warn?: boolean; children: React.ReactNode }) {
  return (
    <span className={`status ${ok ? 'ok' : warn ? 'wait' : 'blocked'}`}>
      {ok ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />} {children}
    </span>
  );
}

function Steps({ title, children, open: startOpen }: { title: string; children: React.ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(Boolean(startOpen));
  return (
    <div className="key-steps">
      <button className="link-btn" onClick={() => setOpen(!open)} aria-expanded={open}>
        <ChevronDown size={14} className={open ? 'flip' : ''} /> {title}
      </button>
      {open && <ol>{children}</ol>}
    </div>
  );
}

/** Checks that the user's own AI keys can't be misused if they ever leak. */
export default function KeySafety() {
  const keys = useStore((s) => s.keys);
  const [gemini, setGemini] = useState<Gemini>(null);
  const [openrouter, setOpenrouter] = useState<OpenRouter>(null);
  const [busy, setBusy] = useState(false);
  const checkGeneration=useRef(0);

  const check = useCallback(async () => {
    const current=++checkGeneration.current,version=keyVersion();
    setBusy(true);
    setGemini(null);setOpenrouter(null);
    const [g, o] = await Promise.all([geminiKeyLock(), openRouterKeyInfo()]);
    if(current!==checkGeneration.current || version!==keyVersion())return;
    setGemini(g as Gemini);
    setOpenrouter(o as OpenRouter);
    setBusy(false);
  }, []);

  useEffect(() => {
    if (keys.gemini || keys.openrouter) void check();
    else {setGemini(null);setOpenrouter(null);setBusy(false);}
    return ()=>{checkGeneration.current++;};
  }, [keys.gemini, keys.openrouter, check]);

  if (!keys.gemini && !keys.openrouter) return null;

  return (
    <div className="usage-card key-safety">
      <div className="usage-card-head">
        <span className="setting-label">Key safety</span>
        <button className="btn small ghost" onClick={() => void check()} disabled={busy}>
          {busy ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />} Check again
        </button>
      </div>
      <p className="setting-hint">
        If a key ever leaked, a locked key is useless anywhere else. Your keys are already private to your account; this adds a second lock.
      </p>

      {keys.gemini && (
        <div className="key-row">
          <div className="usage-row-head">
            <span className="small">Google (Gemini) key</span>
            {!gemini ? (
              <span className="status wait"><Loader2 size={13} className="spin" /> Checking</span>
            ) : gemini.state === 'locked' ? (
              <Status ok>Locked to this app</Status>
            ) : gemini.state === 'open' ? (
              <Status ok={false} warn>Works on any website</Status>
            ) : gemini.state === 'wrong-site' ? (
              <Status ok={false}>Locked to a different website</Status>
            ) : (
              <Status ok={false} warn>Couldn't check</Status>
            )}
          </div>
          {gemini?.state === 'locked' && <span className="setting-hint">Only Lumen can use this key. Nothing else to do.</span>}
          {gemini && gemini.state !== 'locked' && (
            <Steps title={gemini.state === 'wrong-site' ? 'Fix the website list' : 'Lock it (2 minutes, free)'} open={gemini.state === 'wrong-site'}>
              <li>
                Open <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">AI Studio → API keys <ExternalLink size={11} /></a> and click your key's
                project name, or go to{' '}
                <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">Google Cloud → Credentials <ExternalLink size={11} /></a> and pick
                that project.
              </li>
              <li>Under <b>API keys</b>, click your Gemini key.</li>
              <li>
                <b>Application restrictions</b> → <b>Websites</b> → <b>Add</b>: <code className="copyable">{SITE}</code>
              </li>
              <li>
                <b>API restrictions</b> → <b>Restrict key</b> → tick <b>Generative Language API</b>.
              </li>
              <li>Save, wait about 5 minutes, then press <b>Check again</b>.</li>
            </Steps>
          )}
          {gemini?.state === 'invalid' && <span className="setting-hint warn">Google says this key isn't valid: {gemini.message}</span>}
          {gemini?.state === 'error' && gemini.message && <span className="setting-hint">{gemini.message}</span>}
        </div>
      )}

      {keys.openrouter && (
        <div className="key-row">
          <div className="usage-row-head">
            <span className="small">OpenRouter key</span>
            {!openrouter ? (
              <span className="status wait"><Loader2 size={13} className="spin" /> Checking</span>
            ) : openrouter.state === 'capped' ? (
              <Status ok>Free models only ($0 limit)</Status>
            ) : openrouter.state === 'free' ? (
              <Status ok>No credits to spend</Status>
            ) : openrouter.state === 'limit' ? (
              <Status ok={false} warn>Can spend up to ${openrouter.limit}</Status>
            ) : openrouter.state === 'open' ? (
              <Status ok={false}>No spending limit</Status>
            ) : (
              <Status ok={false} warn>Couldn't check</Status>
            )}
          </div>
          {openrouter?.state === 'capped' && <span className="setting-hint">Even if it leaked, it can only use free models. Nothing else to do.</span>}
          {openrouter?.state === 'free' && <span className="setting-hint">You've never added credits, so it can't cost money. Setting a $0 limit makes that permanent.</span>}
          {openrouter && openrouter.state !== 'capped' && openrouter.state !== 'error' && (
            <Steps title="Cap it at $0">
              <li>
                Open <a href="https://openrouter.ai/settings/keys" target="_blank" rel="noopener noreferrer">OpenRouter → Keys <ExternalLink size={11} /></a>.
              </li>
              <li>Click <b>⋯</b> next to the key you use here → <b>Edit</b>.</li>
              <li>
                Set <b>Credit limit</b> to <b>0</b> and save. Free models keep working.
              </li>
              <li>Come back and press <b>Check again</b>.</li>
            </Steps>
          )}
          {openrouter?.state === 'error' && openrouter.message && <span className="setting-hint">{openrouter.message}</span>}
        </div>
      )}
    </div>
  );
}
