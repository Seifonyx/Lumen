import { ArrowDown, ArrowLeft, ArrowUp, Boxes, LayoutGrid, Brain, ChevronRight, Database, Download, ExternalLink, Gauge, KeyRound, Loader2, LogOut, Plus, RefreshCw, Search, Shield, SlidersHorizontal, Star, Trash2, Upload, UserRound, X, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { VOICE_LANGS } from '../lib/speech';
import { PROVIDER_NAMES, saveBlob, type ProviderId } from '../lib/util';
import { useStore } from '../store';
import type { Chat, FontSize, ModelInfo, Theme } from '../types';
import { Badges } from './ModelPicker';
import UsageTab from './UsageTab';
import MemoryTab from './MemoryTab';
import KeySafety from './KeySafety';
import PrivacyTab from './PrivacyTab';
import LayoutsTab from './LayoutsTab';

/** Settings sections: id, name, icon, one-line description (shown in the phone menu and as the section intro). */
const TABS: [string, string, LucideIcon, string][] = [
  ['general', 'General', SlidersHorizontal, 'Appearance, chat behaviour and your account'],
  ['keys', 'API keys', KeyRound, 'Your free Gemini, OpenRouter, Groq and Cerebras keys'],
  ['models', 'Models', Boxes, 'Which models you use, their order and Auto'],
  ['layouts', 'Layouts', LayoutGrid, 'Sets of models for coding, everyday, thinking…'],
  ['usage', 'Usage', Gauge, "Today's requests, limits and resets"],
  ['personalize', 'Personalization', UserRound, 'Instructions every model follows'],
  ['memory', 'Memory', Brain, 'What models remember about you'],
  ['privacy', 'Privacy', Shield, 'Hide personal details from AI models'],
  ['data', 'Data', Database, 'Back up, restore or delete your chats'],
];

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="setting-row">
      <span className="setting-text">
        <span className="setting-label">{label}</span>
        {hint && <span className="setting-hint">{hint}</span>}
      </span>
      <input type="checkbox" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function Choice<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="setting-row">
      <span className="setting-label">{label}</span>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map(([v, text]) => (
          <button key={v} role="radio" aria-checked={value === v} className={value === v ? 'active' : ''} onClick={() => onChange(v)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

const ctx = (n: number | null) => (n ? (n >= 1_000_000 ? `${Math.round(n / 1_000_000)}M` : `${Math.round(n / 1000)}K`) : '');

function ModelsTab() {
  const catalog = useStore((s) => s.catalog);
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const loadCatalog = useStore((s) => s.loadCatalog);
  const catalogError = useStore((s) => s.catalogError);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const enabled = settings.enabledModels;
  const find = (id: string) => catalog?.models.find((m) => m.id === id);

  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (catalog?.models || []).filter((m) => !enabled.includes(m.id) && (!q || `${m.label} ${m.name}`.toLowerCase().includes(q)));
  }, [catalog, enabled, query]);

  const move = (i: number, d: number) => {
    const next = [...enabled];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    update({ enabledModels: next });
  };
  const remove = (id: string) => {
    const next = enabled.filter((x) => x !== id);
    update({ enabledModels: next, defaultModel: settings.defaultModel === id ? next[0] || '' : settings.defaultModel });
  };
  const add = (id: string) => update({ enabledModels: [...enabled, id], defaultModel: settings.defaultModel || id });

  const group = (provider: ModelInfo['provider']) => available.filter((m) => m.provider === provider);

  return (
    <div className="settings-section">
      <Toggle
        label="Switch models automatically"
        hint="When a model hits its free limit or fails, the next model in your list answers instead."
        checked={settings.autoSwitch}
        onChange={(v) => update({ autoSwitch: v })}
      />
      <Toggle
        label="Auto for new chats"
        hint="Picks the best enabled model for each message: images, long documents, code, maths, web search, files, Arabic or quick replies."
        checked={settings.defaultModel === 'auto'}
        onChange={(v) => update({ defaultModel: v ? 'auto' : enabled[0] || '' })}
      />
      <div className="section-head">
        <h3>Your models</h3>
        <span className="muted small">Order = switching order and tie-breaker for Auto. ★ = default for new chats instead of Auto.</span>
      </div>
      <ul className="model-list">
        {enabled.length === 0 && <li className="muted small pad">No models yet. Add some below.</li>}
        {enabled.map((id, i) => {
          const m = find(id);
          return (
            <li key={id} className="model-row">
              <button className={`icon-btn sm star${settings.defaultModel === id ? ' on' : ''}`} onClick={() => update({ defaultModel: id })} aria-label="Make default" title="Default for new chats">
                <Star size={16} fill={settings.defaultModel === id ? 'currentColor' : 'none'} />
              </button>
              <span className="model-meta">
                <span className="model-title">{m?.label || id.split(':').slice(1).join(':')}</span>
                <span className="model-sub">
                  {m ? PROVIDER_NAMES[m.provider] : 'Not available right now'}
                  {m?.context ? ` · ${ctx(m.context)} context` : ''}
                </span>
              </span>
              <Badges m={m} />
              <button className="icon-btn sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><ArrowUp size={16} /></button>
              <button className="icon-btn sm" onClick={() => move(i, 1)} disabled={i === enabled.length - 1} aria-label="Move down"><ArrowDown size={16} /></button>
              <button className="icon-btn sm" onClick={() => remove(id)} aria-label="Remove"><X size={16} /></button>
            </li>
          );
        })}
      </ul>

      <div className="section-head">
        <h3>Add models</h3>
        <button className="btn ghost small" disabled={refreshing} onClick={async () => { setRefreshing(true); await loadCatalog(); setRefreshing(false); }}>
          <RefreshCw size={14} className={refreshing ? 'spin' : ''} /> Refresh
        </button>
      </div>
      {catalogError && <p className="error-text small" dir="auto">{catalogError}</p>}
      <label className="search">
        <Search size={16} />
        <input type="search" placeholder="Search models (e.g. gemini, deepseek, qwen)" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {(Object.keys(PROVIDER_NAMES) as ProviderId[]).map((p) =>
        catalog?.providers[p] || !catalog ? (
          <div key={p}>
            <div className="pop-label">{{ google: 'Google (free tier)', openrouter: 'OpenRouter (free models)', groq: 'Groq (free plan)', cerebras: 'Cerebras (free plan)' }[p]}</div>
            <ul className="model-list add">
              {group(p).length === 0 && <li className="muted small pad">{query ? 'No matches.' : 'All added.'}</li>}
              {group(p).map((m) => (
                <li key={m.id} className="model-row">
                  <span className="model-meta">
                    <span className="model-title">{m.label}{m.preview && <span className="tag">preview</span>}</span>
                    <span className="model-sub">{m.name}{m.context ? ` · ${ctx(m.context)} context` : ''}</span>
                  </span>
                  <Badges m={m} />
                  <button className="icon-btn sm" onClick={() => add(m.id)} aria-label={`Add ${m.label}`}><Plus size={17} /></button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p key={p} className="muted small">
            {PROVIDER_NAMES[p]} isn't connected. Add its key under API keys to use its models.
          </p>
        ),
      )}
      <p className="muted small legend">
        Icons: <Badges m={{ vision: true } as ModelInfo} /> reads images · <Badges m={{ search: true } as ModelInfo} /> web search · <Badges m={{ thinking: true } as ModelInfo} /> thinks first
      </p>
    </div>
  );
}

const KEY_FIELDS: { id: 'gemini' | 'openrouter' | 'groq' | 'cerebras' | 'github'; label: string; placeholder: string; link: string; hint: string; linkText?: string }[] = [
  { id: 'gemini', label: 'Google AI Studio (Gemini)', placeholder: 'AIza…', link: 'https://aistudio.google.com/apikey', hint: 'Best all-rounder: reads images and PDFs, searches the web.' },
  { id: 'openrouter', label: 'OpenRouter', placeholder: 'sk-or-…', link: 'https://openrouter.ai/keys', hint: 'Dozens of free open models (DeepSeek, Qwen, Llama…).' },
  { id: 'groq', label: 'Groq', placeholder: 'gsk_…', link: 'https://console.groq.com/keys', hint: 'Very fast answers (Llama, GPT-OSS, Qwen). Generous free limits.' },
  { id: 'cerebras', label: 'Cerebras', placeholder: 'csk-…', link: 'https://cloud.cerebras.ai/platform', hint: 'The fastest replies; about 1 million free tokens a day.' },
  {
    id: 'github',
    label: 'GitHub (for coding)',
    placeholder: 'github_pat_…',
    link: 'https://github.com/settings/personal-access-tokens/new',
    linkText: 'Create a token',
    hint: 'Lets chats read your repositories and commit changes. Use a fine-grained token with Contents and Pull requests set to Read and write.',
  },
];

function KeysTab() {
  const keys = useStore((s) => s.keys);
  const saveApiKeys = useStore((s) => s.saveApiKeys);
  const toast = useStore((s) => s.toast);
  const [draft, setDraft] = useState({ ...keys });
  const [busy, setBusy] = useState(false);
  const changed = KEY_FIELDS.some(({ id }) => (draft[id] || '').trim() !== (keys[id] || ''));
  const any = KEY_FIELDS.some(({ id }) => id !== 'github' && (draft[id] || '').trim());

  return (
    <div className="settings-section">
      <p className="muted">
        Your keys are saved privately to your Google account in Firebase, so you only enter them once for all your devices. They're used directly from this app.
        Every key is free; add as many as you like — more providers means more free messages and better switching when one is busy.
      </p>
      {KEY_FIELDS.map(({ id, label, placeholder, link, hint, linkText }, i) => (
        <label key={id} className="field-block">
          <span className="setting-label">
            <KeyRound size={15} /> {label} key{i ? ' (optional)' : ''}
          </span>
          <input type="password" autoComplete="off" spellCheck={false} placeholder={placeholder} value={draft[id] || ''} onChange={(e) => setDraft({ ...draft, [id]: e.target.value })} />
          <span className="setting-hint key-hint">
            {hint}{' '}
            <a className="small" href={link} target="_blank" rel="noopener noreferrer">
              {linkText || 'Get a free key'} <ExternalLink size={12} />
            </a>
          </span>
        </label>
      ))}
      <div>
        <button
          className="btn primary"
          disabled={busy || !changed || !any}
          onClick={async () => {
            setBusy(true);
            try {
              await saveApiKeys(draft);
              toast('Keys saved. Your models are loading.', 'success');
            } catch (e) {
              toast(`Couldn't save keys: ${(e as Error).message}`, 'error');
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy && <Loader2 size={16} className="spin" />} Save keys
        </button>
      </div>
      <KeySafety />
    </div>
  );
}

function DataTab() {
  const chats = useStore((s) => s.chats);
  const { clearAllChats, importChats, toast } = useStore.getState();
  const fileRef = useRef<HTMLInputElement>(null);
  const count = chats.filter((c) => c.messages.length).length;

  return (
    <div className="settings-section">
      <p className="muted">Chats sync to your Google account, so they show up on all your devices. Attached files stay on the device you added them on.</p>
      <div className="setting-row">
        <span className="setting-text">
          <span className="setting-label">Back up chats</span>
          <span className="setting-hint">Save {count} chat{count === 1 ? '' : 's'} (with this device's attachments) as one file.</span>
        </span>
        <button className="btn small" onClick={() => saveBlob(new Blob([JSON.stringify({ app: 'model-router', version: 2, chats }, null, 0)], { type: 'application/json' }), `model-router-backup-${new Date().toISOString().slice(0, 10)}.json`)}>
          <Download size={15} /> Back up
        </button>
      </div>
      <div className="setting-row">
        <span className="setting-text">
          <span className="setting-label">Restore a backup</span>
          <span className="setting-hint">Adds the chats from a backup file. Existing chats are kept.</span>
        </span>
        <button className="btn small" onClick={() => fileRef.current?.click()}>
          <Upload size={15} /> Restore
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            try {
              const data = JSON.parse(await file.text());
              const list: Chat[] = Array.isArray(data) ? data : data.chats;
              const n = await importChats(list || []);
              toast(`Restored ${n} chat${n === 1 ? '' : 's'}.`, 'success');
            } catch {
              toast("That file isn't a Model Router backup.", 'error');
            }
          }}
        />
      </div>
      <div className="setting-row danger-row">
        <span className="setting-text">
          <span className="setting-label">Delete all chats</span>
          <span className="setting-hint">Removes every chat from all your devices. This can't be undone.</span>
        </span>
        <button className="btn small danger" onClick={() => { if (confirm('Delete all chats on all your devices?')) void clearAllChats().then(() => toast('All chats deleted.', 'success')); }}>
          <Trash2 size={15} /> Delete all
        </button>
      </div>
    </div>
  );
}

export default function SettingsModal() {
  const open = useStore((s) => s.settingsOpen);
  const tab = useStore((s) => s.settingsTab);
  const settings = useStore((s) => s.settings);
  const { updateSettings: update, setUi, logout } = useStore.getState();
  const [instructions, setInstructions] = useState(settings.customInstructions);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) setInstructions(useStore.getState().settings.customInstructions);
  }, [open]);
  const close = () => {
    const now = useStore.getState().settings.customInstructions;
    if (instructions !== now) update({ customInstructions: instructions });
    setUi({ settingsOpen: false });
  };
  // Esc: back to the section list on phones, otherwise close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || useStore.getState().preview) return;
      if (tab && window.matchMedia('(max-width: 720px)').matches) setUi({ settingsTab: '' });
      else close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  useEffect(() => {
    panel.current?.scrollTo({ top: 0 });
  }, [tab]);
  if (!open) return null;

  // An empty tab means "the section list" on phones; computers show General.
  const current = TABS.find(([id]) => id === tab) || TABS[0];
  const [id, label, , blurb] = current;

  return (
    <section className={`settings-page${tab ? ' has-section' : ''}`} aria-label="Settings">
      <header className="settings-top">
        {tab ? (
          <button className="icon-btn settings-back" onClick={() => setUi({ settingsTab: '' })} aria-label="All settings">
            <ArrowLeft size={18} />
          </button>
        ) : null}
        <h1 className="settings-title">
          <span className="settings-title-main">Settings</span>
          {tab && <span className="settings-title-section">{label}</span>}
        </h1>
        <div className="spacer" />
        <button className="icon-btn" onClick={close} aria-label="Close" title="Close (Esc)">
          <X size={18} />
        </button>
      </header>
      <div className="settings-scroll" ref={panel}>
        <div className="settings-inner">
          <nav className="settings-tabs" aria-label="Settings sections">
            {TABS.map(([tid, tlabel, Icon, tblurb]) => (
              <button key={tid} aria-current={id === tid ? 'page' : undefined} className={id === tid ? 'active' : ''} onClick={() => setUi({ settingsTab: tid })}>
                <span className="tab-icon"><Icon size={16} /></span>
                <span className="tab-text">
                  <span className="tab-label">{tlabel}</span>
                  <span className="tab-blurb">{tblurb}</span>
                </span>
                <ChevronRight size={16} className="tab-chev" />
              </button>
            ))}
          </nav>
          <div className="settings-panel">
            <div className="settings-heading">
              <h2>{label}</h2>
              <p>{blurb}</p>
            </div>
            {id === 'general' && (
              <div className="settings-section">
                <Choice<Theme> label="Theme" value={settings.theme} onChange={(v) => update({ theme: v })} options={[['system', 'Auto'], ['light', 'Light'], ['dark', 'Dark']]} />
                <Choice<FontSize> label="Text size" value={settings.fontSize} onChange={(v) => update({ fontSize: v })} options={[['small', 'S'], ['medium', 'M'], ['large', 'L']]} />
                <Toggle label="Show thinking" hint="Show the model's reasoning (collapsed) when it thinks before answering." checked={settings.showThinking} onChange={(v) => update({ showThinking: v })} />
                <Toggle label="Name chats automatically" hint="Uses a light model to write a short title after the first reply." checked={settings.autoTitle} onChange={(v) => update({ autoTitle: v })} />
                <Toggle
                  label="Compact long chats automatically"
                  hint="When a chat gets long, older messages are summarized and the summary is sent instead — faster replies and fewer limits. You can also type /compact."
                  checked={settings.autoCompact}
                  onChange={(v) => update({ autoCompact: v })}
                />
                <Toggle label="Enter sends the message" hint="On computers. Shift+Enter adds a new line. On phones, use the send button." checked={settings.enterToSend} onChange={(v) => update({ enterToSend: v })} />
                <label className="setting-row">
                  <span className="setting-label">Voice input language</span>
                  <select value={settings.voiceLang} onChange={(e) => update({ voiceLang: e.target.value })}>
                    {VOICE_LANGS.map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </label>
                <div className="setting-row">
                  <span className="setting-text">
                    <span className="setting-label">Signed in</span>
                    <span className="setting-hint">{useStore.getState().user?.email}</span>
                  </span>
                  <button className="btn small logout" onClick={() => { setUi({ settingsOpen: false }); logout(); }}>
                    <LogOut size={15} /> Sign out
                  </button>
                </div>
              </div>
            )}
            {id === 'keys' && <KeysTab />}
            {id === 'models' && <ModelsTab />}
            {id === 'layouts' && <LayoutsTab />}
            {id === 'usage' && <UsageTab />}
            {id === 'memory' && <MemoryTab Toggle={Toggle} />}
            {id === 'privacy' && <PrivacyTab Toggle={Toggle} Choice={Choice} />}
            {id === 'personalize' && (
              <div className="settings-section">
                <label className="field-block">
                  <span className="setting-label">Custom instructions</span>
                  <span className="setting-hint">Tell every model about you and how to answer — e.g. your job, language preferences, tone, or formats you like.</span>
                  <textarea
                    dir="auto"
                    rows={9}
                    maxLength={4000}
                    placeholder={'Examples:\n• I work in a hospital in Egypt; use metric units and EGP.\n• Answer in Egyptian Arabic unless I write in English.\n• Keep answers short unless I ask for detail.'}
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    onBlur={() => update({ customInstructions: instructions })}
                  />
                  <span className="muted small">{instructions.length}/4000</span>
                </label>
              </div>
            )}
            {id === 'data' && <DataTab />}
          </div>
        </div>
      </div>
    </section>
  );
}
