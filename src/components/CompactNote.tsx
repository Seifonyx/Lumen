import { Exit, motionOff } from '../lib/motion';
import { ChevronDown, Loader2, MessageSquarePlus, Shrink, Undo2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { isSheetScreen, useSheetDrag } from '../lib/sheet-drag';
import { useFocusScope } from '../lib/focus-scope';
import { activeSummary, compactLimit, contextTokens } from '../lib/compact';
import { isLayoutId } from '../lib/layouts';
import { memoryInstructions } from '../lib/memory';
import { AUTO } from '../lib/routing';
import { formatTokens, formatUntil, nextReset, providerOf, remaining } from '../lib/usage';
import { modelInfo, modelLabel, useStore } from '../store';
import type { Chat, ChatSummary } from '../types';
import Markdown from './Markdown';

/** The line in a chat where older messages were replaced by a summary. */
export function CompactNote({ chat, summary }: { chat: Chat; summary: ChatSummary }) {
  const [open, setOpen] = useState(false);
  const catalog = useStore((s) => s.catalog);
  const busy = useStore((s) => s.streamingChatId !== null || s.compactingChatId !== null);
  const undoCompact = useStore((s) => s.undoCompact);
  const continued = summary.upTo === null;

  return (
    <div className="compact-note" role="note">
      <div className="compact-line">
        <span className="compact-label">
          <Shrink size={14} />
          {continued ? (
            <span dir="auto">Continues “{summary.from}” · {summary.count} messages summarized</span>
          ) : (
            <span>
              {summary.count} earlier message{summary.count === 1 ? '' : 's'} summarized{summary.saved > 0 ? ` · saves ~${formatTokens(summary.saved)} tokens per message` : ''}
            </span>
          )}
        </span>
      </div>
      <div className="compact-actions">
        <button className="link-btn" onClick={() => setOpen(!open)} aria-expanded={open}>
          <ChevronDown size={14} className={open ? 'flip' : ''} /> {open ? 'Hide summary' : 'Show summary'}
        </button>
        {!continued && (
          <button className="link-btn" onClick={() => void undoCompact(chat.id)} disabled={busy} title="Send the full chat again">
            <Undo2 size={14} /> Undo
          </button>
        )}
      </div>
      {open && (
        <div className="compact-summary" dir="auto">
          <Markdown text={summary.text} streaming={false} />
          {summary.model && <div className="muted small">Written by {modelLabel(catalog, summary.model)}{summary.auto ? ' automatically' : ''}.</div>}
        </div>
      )}
    </div>
  );
}

export function CompactingNote() {
  return (
    <div className="compact-note working" role="status">
      <div className="compact-line">
        <span className="compact-label">
          <Loader2 size={14} className="spin" /> Summarizing earlier messages to keep this chat fast…
        </span>
      </div>
    </div>
  );
}

/**
 * The usage meter above the message box (like the context meter in Claude Code):
 *  - how full this chat is, and what else is sent with every message (saved memories, your instructions)
 *  - today's usage of the current model
 *  - compact options
 */
export function UsageMeter({ chat, model }: { chat: Chat; model: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useFocusScope(dialog,open,()=>{setOpen(false);trigger.current?.focus({preventScroll:true})});
  // Phones: usage slides up from the bottom as a sheet you can drag down to close.
  const [sheet, setSheet] = useState(false);
  const scrim = useRef<HTMLDivElement>(null);
  useSheetDrag(dialog, () => setOpen(false), open && sheet, scrim);
  const catalog = useStore((s) => s.catalog);
  const usage = useStore((s) => s.usage);
  const settings = useStore((s) => s.settings);
  const memories = useStore((s) => s.memories);
  const busy = useStore((s) => s.streamingChatId !== null || s.compactingChatId !== null);
  const compact = useStore((s) => s.compact);
  const undoCompact = useStore((s) => s.undoCompact);
  const continueInNewChat = useStore((s) => s.continueInNewChat);
  const updateSettings = useStore((s) => s.updateSettings);

  // Close when clicking outside or pressing Esc.
  useEffect(() => {
    if (!open) return;
    const fit = () => {
      if (sheet) return;
      const panel = box.current?.querySelector<HTMLElement>('.usage-pop');
      // The panel opens above the message box, so the space is what's above the box.
      if (panel && trigger.current) panel.style.maxHeight = `${Math.max(0, Math.min(600, (trigger.current.closest('.composer') || trigger.current).getBoundingClientRect().top - 20 - (window.visualViewport?.offsetTop || 0)))}px`;
    };
    let frame = 0;
    const scheduleFit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };
    fit();
    window.addEventListener('resize', scheduleFit);
    window.visualViewport?.addEventListener('resize', scheduleFit);
    const observer = new ResizeObserver(scheduleFit);
    if (box.current?.parentElement) observer.observe(box.current.parentElement);
    close.current?.focus({ preventScroll: true });
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node) && !dialog.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        trigger.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', scheduleFit);
      window.visualViewport?.removeEventListener('resize', scheduleFit);
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [open, sheet]);

  // This chat: how full it is compared with the point where it gets compacted.
  const used = contextTokens(chat);
  const limit = compactLimit(model === AUTO ? undefined : modelInfo(catalog, model));
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const level = pct >= 85 ? ' high' : pct >= 65 ? ' mid' : '';
  const summary = activeSummary(chat);
  const canUndo = Boolean(summary && summary.upTo !== null);

  // Also sent with every message (these don't count toward the compact point).
  const memoryTokens = settings.memory ? Math.ceil(memoryInstructions(memories, settings.memoryAuto, { aboutMe: settings.aboutMe, projectId: chat.projectId, projectName: chat.projectId ? 'project' : undefined }).length / 4) : 0;
  const instructionTokens = Math.ceil(settings.customInstructions.length / 4);

  // The model whose usage is shown: your pick, or (for Auto and layouts) the one that answered last.
  const picked = model === AUTO || isLayoutId(model);
  const current = picked ? [...chat.messages].reverse().find((m) => m.role === 'assistant' && m.model)?.model : model;
  const u = current ? usage?.models[current] : undefined;
  const freeOR = Boolean(current && current.startsWith('openrouter:') && current.endsWith(':free'));
  const left = current ? remaining(usage, current) : null;
  const blockedUntil = (() => {
    if (!usage) return null;
    if (u?.blockedUntil && u.blockedUntil > Date.now()) return u.blockedUntil;
    return freeOR && usage.openrouter.limit && usage.openrouter.used >= usage.openrouter.limit ? usage.openrouter.resetAt : null;
  })();
  const requests = freeOR ? usage?.openrouter.used || 0 : u?.requests || 0;
  const dailyLimit = freeOR ? usage?.openrouter.limit || null : u?.quota || null;
  const resetAt = current ? (freeOR && usage ? usage.openrouter.resetAt : nextReset(providerOf(current))) : 0;

  return (
    <div className="usage-meter" ref={box}>
      <button ref={trigger} className={`usage-chip${level}${pct < 50 && !blockedUntil ? ' quiet' : ''}`} onClick={() => { setSheet(isSheetScreen()); setOpen(!open); }} aria-expanded={open} aria-haspopup="dialog" aria-controls="usage-panel" title="Conversation capacity and daily usage">
        <svg className="usage-ring" viewBox="0 0 20 20" aria-hidden="true"><circle className="usage-ring-track" cx="10" cy="10" r="7" /><circle className="usage-ring-fill" cx="10" cy="10" r="7" strokeDasharray="43.98" strokeDashoffset={43.98 * (1 - pct / 100)} /></svg>
        <span className="usage-chip-pct" aria-hidden="true">{pct}%</span><span className="usage-chip-label">Context {pct}%</span>{blockedUntil && <span className="usage-status"> · limit reached</span>}
        <ChevronDown size={12} aria-hidden="true" />
      </button>
      {open && (() => {
        const panel = (
        <div ref={dialog} className={`usage-pop${sheet ? ' sheet' : ''}`} id="usage-panel" role="dialog" aria-modal="true" tabIndex={-1} aria-label="Usage">
          {sheet && <div className="sheet-grip" aria-hidden="true" />}
          <header className="um-head"><span>Usage</span><button ref={close} className="icon-btn sm" aria-label="Close usage" onClick={() => { setOpen(false); trigger.current?.focus({ preventScroll: true }); }}><X size={16} /></button></header>
          <div className="um-tiles">
            <section className="um-tile" aria-label="This chat">
              <Gauge pct={pct} tone={level.trim()} label={`${pct}%`} meter={{ name: 'How full this chat is', now: pct, max: 100 }} />
              <span className="um-tile-label">This chat</span>
              <strong className="um-tile-value">~{formatTokens(used)} <span>/ {formatTokens(limit)}</span></strong>
              <span className="um-tile-sub">tokens before it’s compacted</span>
            </section>
            <section className="um-tile" aria-label="Today">
              {(() => {
                const share = dailyLimit ? Math.min(100, Math.round((requests / dailyLimit) * 100)) : 0;
                const tone = blockedUntil || share >= 90 ? 'high' : share >= 70 ? 'mid' : '';
                return <Gauge pct={blockedUntil ? 100 : share} tone={tone} label={blockedUntil ? 'Full' : dailyLimit ? `${share}%` : '—'} meter={dailyLimit ? { name: 'Requests used today', now: Math.min(requests, dailyLimit), max: dailyLimit, text: `${requests} of ${dailyLimit} requests used today` } : undefined} />;
              })()}
              <span className="um-tile-label">{freeOR ? 'Shared free pool' : 'Requests today'}</span>
              <strong className="um-tile-value">{!usage || !current ? '—' : <>{requests}{dailyLimit ? <span> / {dailyLimit}</span> : null}</>}</strong>
              <span className={`um-tile-sub${blockedUntil ? ' um-bad' : ''}`}>{!usage ? 'Shows once you’re signed in' : !current ? 'Shows after the first reply' : blockedUntil ? `Limit reached · back ${formatUntil(blockedUntil)}` : `${left !== null ? `${left} remaining · ` : ''}resets ${formatUntil(resetAt)}`}</span>
            </section>
          </div>
          {current && <p className="um-model"><span className="um-dot" aria-hidden="true" />{modelLabel(catalog, current)}{picked ? ' · last used here' : ''}</p>}
          {pct >= 85 && <p className="um-note um-warning">This chat is nearly full. Compact it to make room for your next messages.</p>}
          {current && usage && !dailyLimit && <p className="um-note">Daily allowance unknown. A gauge appears once the provider reports a limit.</p>}
          <details className="um-details">
            <summary>Details</summary>
            <div className="um-row"><span>Saved memories</span><span className="muted">{settings.memory ? `~${formatTokens(memoryTokens)} · ${memories.length} saved` : 'Off'}</span></div>
            <div className="um-row"><span>Your instructions</span><span className="muted">{instructionTokens ? `~${formatTokens(instructionTokens)}` : 'None'}</span></div>
            {current && !freeOR && <div className="um-row"><span>Tokens today</span><span className="muted">{formatTokens(u?.input || 0)} in · {formatTokens(u?.output || 0)} out</span></div>}
            <p className="um-note">Memories and instructions go with every message but don’t count toward this chat’s limit.</p>
          </details>
          <div className="um-actions">
            <button className="btn" disabled={busy} onClick={() => { setOpen(false); void compact(chat.id); }}><Shrink size={15} /> Compact now</button>
            <button className="btn" disabled={busy} onClick={() => { setOpen(false); void continueInNewChat(chat.id); }}><MessageSquarePlus size={15} /> New chat with summary</button>
            {canUndo && <button className="btn ghost um-wide" disabled={busy} onClick={() => { setOpen(false); void undoCompact(chat.id); }}><Undo2 size={15} /> Undo last compact</button>}
          </div>
          <label className="um-toggle switch-row">
            <span>Compact automatically when full</span>
            <input type="checkbox" role="switch" checked={settings.autoCompact} onChange={(e) => updateSettings({ autoCompact: e.target.checked })} />
          </label>
        </div>
        );
        return sheet ? createPortal(<><Exit kind="fade"><div ref={scrim} className="um-scrim" onClick={() => setOpen(false)} aria-hidden="true" /></Exit><Exit kind="sheet">{panel}</Exit></>, document.body) : <Exit kind="drop">{panel}</Exit>;
      })()}
    </div>
  );
}

/** Numbers in a label count up from zero when it appears (e.g. "34%"). */
function CountUp({ text }: { text: string }) {
  const m = /^(\D*)(\d+)(.*)$/.exec(text);
  const target = m ? Number(m[2]) : 0;
  const [n, setN] = useState(() => (m && !motionOff() ? 0 : target));
  useEffect(() => {
    if (!m || motionOff()) { setN(target); return; }
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - start) / 700);
      setN(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps
  return <>{m ? `${m[1]}${n}${m[3]}` : text}</>;
}

/** A round gauge: a ring that fills with `pct`, the label in the middle. With `meter`, it's announced as a meter. */
function Gauge({ pct, tone, label, meter }: { pct: number; tone: string; label: string; meter?: { name: string; now: number; max: number; text?: string } }) {
  const c = 2 * Math.PI * 26;
  return (
    <div className={`um-gauge${tone ? ` ${tone}` : ''}`} {...(meter ? { role: 'meter', 'aria-label': meter.name, 'aria-valuemin': 0, 'aria-valuemax': meter.max, 'aria-valuenow': meter.now, 'aria-valuetext': meter.text } : { 'aria-hidden': true })}>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle className="um-gauge-track" cx="32" cy="32" r="26" />
        <circle className="um-gauge-fill" cx="32" cy="32" r="26" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(100, pct)) / 100)} style={{ '--c': c } as React.CSSProperties} />
      </svg>
      <span aria-hidden="true"><CountUp text={label} /></span>
    </div>
  );
}
