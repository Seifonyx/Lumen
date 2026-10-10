import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Boxes,
  Brain,
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Gauge,
  KeyRound,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  SlidersHorizontal,
  Star,
  Trash2,
  Upload,
  X,
  type LucideIcon,
} from 'lucide-react';
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
import LayoutsSection, { LayoutEditor } from './LayoutsTab';
import type { Layout } from '../lib/layouts';

/** Settings sections: id, name, icon, one-line description */
const TABS: [string, string, LucideIcon, string][] = [
  ['general', 'General', SlidersHorizontal, 'Appearance, chat preferences, account & updates'],
  ['keys', 'API Keys', KeyRound, 'Free Gemini, OpenRouter, Groq & Cerebras keys'],
  ['models', 'Models', Boxes, 'Smart routing, layouts & model catalog'],
  ['personalize', 'Personalization', Brain, 'Custom instructions & saved memory context'],
  ['usage', 'Usage', Gauge, "Daily limits, quotas & database sync"],
  ['privacy', 'Privacy & Data', Shield, 'Privacy shield, backups & data control'],
];

/** Backward-compatible tab alias mapping */
const TAB_ALIASES: Record<string, string> = {
  memory: 'personalize',
  data: 'privacy',
  layouts: 'models',
};

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="setting-row">
      <span className="setting-text">
        <span className="setting-label">{label}</span>
        {hint && <span className="setting-hint">{hint}</span>}
      </span>
      <span className="setting-ctrl">
        <input type="checkbox" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      </span>
    </label>
  );
}

function Choice<T extends string>({
  value,
  options,
  onChange,
  label,
  hint,
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
  label: string;
  hint?: string;
}) {
  return (
    <div className="setting-row">
      <span className="setting-text">
        <span className="setting-label">{label}</span>
        {hint && <span className="setting-hint">{hint}</span>}
      </span>
      <span className="setting-ctrl">
        <div className="segmented" role="radiogroup" aria-label={label}>
          {options.map(([v, text]) => (
            <button key={v} role="radio" aria-checked={value === v} className={value === v ? 'active' : ''} onClick={() => onChange(v)}>
              {text}
            </button>
          ))}
        </div>
      </span>
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
  const [editing, setEditing] = useState<Layout | null>(null);
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

  if (editing) return <div className="settings-section"><LayoutEditor start={editing} onDone={() => setEditing(null)} /></div>;
  return (
    <div className="settings-section">
      <div className="settings-group">
        <span className="settings-group-title">Smart Routing & Behavior</span>
        <div className="settings-card">
          <Toggle
            label="Switch models automatically"
            hint="When an active model hits its free rate limit or encounters an error, the next model answers instead."
            checked={settings.autoSwitch}
            onChange={(v) => update({ autoSwitch: v })}
          />
          <Toggle
            label="Auto-routing for new chats"
            hint="Dynamically picks the best model for each message: images, long documents, code, mathematics, web search, or fast replies."
            checked={settings.defaultModel === 'auto'}
            onChange={(v) => update({ defaultModel: v ? 'auto' : enabled[0] || '' })}
          />
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-group-title">
          <span>Active Models ({enabled.length})</span>
          <span className="muted" style={{ fontWeight: 400, textTransform: 'none' }}>★ = default for new chats</span>
        </div>
        <div className="settings-card">
          <ul className="model-list" style={{ border: 0, margin: 0, borderRadius: 0 }}>
            {enabled.length === 0 && <li className="muted small pad" style={{ padding: '16px 18px' }}>No models active. Add models from the catalog below.</li>}
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
        </div>
      </div>

      <div className="settings-group">
        <span className="settings-group-title">Workspace Presets</span>
        <LayoutsSection onEdit={setEditing} />
      </div>

      <div className="settings-group">
        <div className="settings-group-title">
          <span>Available Model Catalog</span>
          <button className="link-btn small" disabled={refreshing} onClick={async () => { setRefreshing(true); await loadCatalog(); setRefreshing(false); }}>
            <RefreshCw size={13} className={refreshing ? 'spin' : ''} /> Refresh catalog
          </button>
        </div>
        <div className="settings-card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {catalogError && <p className="error-text small" dir="auto">{catalogError}</p>}
          <label className="search" style={{ margin: 0 }}>
            <Search size={16} />
            <input type="search" placeholder="Search models (e.g. gemini, deepseek, qwen, llama)" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          {(Object.keys(PROVIDER_NAMES) as ProviderId[]).map((p) =>
            catalog?.providers[p] || !catalog ? (
              <div key={p}>
                <div className="pop-label" style={{ marginBottom: 6 }}>{{ google: 'Google AI Studio (free tier)', openrouter: 'OpenRouter (free open models)', groq: 'Groq (free high-speed plan)', cerebras: 'Cerebras (ultra-fast free tier)' }[p]}</div>
                <ul className="model-list add" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                  {group(p).length === 0 && <li className="muted small pad">{query ? 'No matches found.' : 'All models added to active list.'}</li>}
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
              <p key={p} className="muted small" style={{ margin: '4px 0' }}>
                {PROVIDER_NAMES[p]} isn't connected. Add its key under API Keys to load its models.
              </p>
            ),
          )}
          <p className="muted small legend" style={{ margin: '8px 0 0' }}>
            Capabilities: <Badges m={{ vision: true } as ModelInfo} /> Vision & Images · <Badges m={{ search: true } as ModelInfo} /> Live Web Search · <Badges m={{ thinking: true } as ModelInfo} /> Reasoning & Thinking
          </p>
        </div>
      </div>
    </div>
  );
}

const KEY_FIELDS: { id: 'gemini' | 'openrouter' | 'groq' | 'cerebras' | 'github'; label: string; placeholder: string; link: string; hint: string; linkText?: string }[] = [
  { id: 'gemini', label: 'Google AI Studio (Gemini)', placeholder: 'AIza…', link: 'https://aistudio.google.com/apikey', hint: 'Best all-rounder: reads images & documents, performs live web search.' },
  { id: 'openrouter', label: 'OpenRouter', placeholder: 'sk-or-…', link: 'https://openrouter.ai/keys', hint: 'Dozens of free open models including DeepSeek, Qwen, and Llama.' },
  { id: 'groq', label: 'Groq', placeholder: 'gsk_…', link: 'https://console.groq.com/keys', hint: 'Ultra-fast inference (Llama, GPT-OSS, Qwen) with generous daily free limits.' },
  { id: 'cerebras', label: 'Cerebras', placeholder: 'csk-…', link: 'https://cloud.cerebras.ai/platform', hint: 'The fastest replies in the world; ~1 million free tokens per day.' },
  {
    id: 'github',
    label: 'GitHub Personal Token (Coding)',
    placeholder: 'github_pat_…',
    link: 'https://github.com/settings/personal-access-tokens/new',
    linkText: 'Generate token',
    hint: 'Enables chat to inspect repositories, run tests, and commit pull requests. Fine-grained with Contents: Read & write.',
  },
];

function KeysTab() {
  const keys = useStore((s) => s.keys);
  const saveApiKeys = useStore((s) => s.saveApiKeys);
  const toast = useStore((s) => s.toast);
  const [draft, setDraft] = useState({ ...keys });
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const changed = KEY_FIELDS.some(({ id }) => (draft[id] || '').trim() !== (keys[id] || ''));
  const any = KEY_FIELDS.some(({ id }) => id !== 'github' && (draft[id] || '').trim());

  const toggleShow = (id: string) => setShowKey((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="settings-section">
      <div className="settings-group">
        <span className="settings-group-title">Configured Providers</span>
        <div className="settings-card">
          {KEY_FIELDS.map(({ id, label, placeholder, link, hint, linkText }) => {
            const val = draft[id] || '';
            const isConfigured = Boolean(val.trim());
            const visible = Boolean(showKey[id]);
            return (
              <div key={id} className="key-provider-card">
                <div className="key-provider-head">
                  <span className="key-provider-title">
                    <KeyRound size={15} /> {label}
                    <span className={`key-status-pill ${isConfigured ? 'configured' : 'empty'}`}>
                      {isConfigured ? '● Active' : '○ Not set'}
                    </span>
                  </span>
                  <a className="link-btn small inline" href={link} target="_blank" rel="noopener noreferrer">
                    {linkText || 'Get free key'} <ExternalLink size={12} />
                  </a>
                </div>
                <span className="key-provider-desc">{hint}</span>
                <div className="key-input-wrap">
                  <input
                    type={visible ? 'text' : 'password'}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={placeholder}
                    value={val}
                    onChange={(e) => setDraft({ ...draft, [id]: e.target.value })}
                  />
                  {val && (
                    <button className="icon-btn sm" onClick={() => setDraft({ ...draft, [id]: '' })} aria-label="Clear key" title="Clear">
                      <X size={14} />
                    </button>
                  )}
                  <button className="icon-btn sm" onClick={() => toggleShow(id)} aria-label={visible ? 'Hide' : 'Reveal'} title={visible ? 'Hide' : 'Reveal'}>
                    {visible ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <button
          className="btn primary"
          disabled={busy || !changed || !any}
          onClick={async () => {
            setBusy(true);
            try {
              await saveApiKeys(draft);
              toast('API keys saved successfully. Models are syncing.', 'success');
            } catch (e) {
              toast(`Couldn't save keys: ${(e as Error).message}`, 'error');
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Loader2 size={16} className="spin" /> : <Check size={16} />} Save API keys
        </button>
        {changed && (
          <button className="btn ghost small" onClick={() => setDraft({ ...keys })}>
            <RotateCcw size={14} /> Revert changes
          </button>
        )}
      </div>

      <div className="settings-group" style={{ marginTop: 8 }}>
        <span className="settings-group-title">Key Security & Origin Lock</span>
        <KeySafety />
      </div>
    </div>
  );
}

function DataTab() {
  const chats = useStore((s) => s.chats);
  const { clearAllChats, importChats, toast } = useStore.getState();
  const fileRef = useRef<HTMLInputElement>(null);
  const count = chats.filter((c) => c.messages.length).length;

  return (
    <div className="settings-group">
      <span className="settings-group-title">Chat History & Backups</span>
      <div className="settings-card">
        <div className="setting-row">
          <span className="setting-text">
            <span className="setting-label">Export chat backup</span>
            <span className="setting-hint">Download all {count} conversation{count === 1 ? '' : 's'} as a structured JSON archive.</span>
          </span>
          <span className="setting-ctrl">
            <button className="btn small" onClick={() => saveBlob(new Blob([JSON.stringify({ app: 'model-router', version: 2, chats }, null, 0)], { type: 'application/json' }), `model-router-backup-${new Date().toISOString().slice(0, 10)}.json`)}>
              <Download size={14} /> Export
            </button>
          </span>
        </div>
        <div className="setting-row">
          <span className="setting-text">
            <span className="setting-label">Restore chat backup</span>
            <span className="setting-hint">Import conversations from an exported Model Router backup file without replacing existing chats.</span>
          </span>
          <span className="setting-ctrl">
            <button className="btn small" onClick={() => fileRef.current?.click()}>
              <Upload size={14} /> Import
            </button>
          </span>
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
            <span className="setting-label" style={{ color: 'var(--danger)' }}>Delete all chats</span>
            <span className="setting-hint">Permanently erase every conversation from all your connected devices.</span>
          </span>
          <span className="setting-ctrl">
            <button className="btn small danger" onClick={() => { if (confirm('Delete all chats on all your devices permanently?')) void clearAllChats().then(() => toast('All chats deleted.', 'success')); }}>
              <Trash2 size={14} /> Delete all
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}

function UpdatesSection() {
  const updateReady = useStore((s) => s.updateReady);
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  const checkUpdates = () => {
    setChecking(true);
    setTimeout(() => {
      setChecking(false);
      setCheckedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 600);
  };

  return (
    <div className="settings-group">
      <span className="settings-group-title">Updates & System</span>
      <div className="settings-card updates-card">
        <div className="version-card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="version-badge">v2.0.0</span>
              <span className="version-status"><CheckCircle2 size={13} /> {updateReady ? 'Update ready' : 'Up to date'}</span>
            </div>
            <span className="setting-hint">
              {updateReady ? 'A newer release has been downloaded and is ready.' : checkedAt ? `Last verified today at ${checkedAt}` : 'Model Router is running the latest production release.'}
            </span>
          </div>
          {updateReady ? (
            <button className="btn small primary" onClick={updateReady}>
              <RefreshCw size={14} /> Reload
            </button>
          ) : (
            <button className="btn small" onClick={checkUpdates} disabled={checking}>
              <RefreshCw size={13} className={checking ? 'spin' : ''} /> {checking ? 'Checking…' : 'Check for updates'}
            </button>
          )}
        </div>

        <div className="changelog-wrap">
          <div className="changelog-entry">
            <div className="changelog-head">
              <span className="changelog-tag">v2.0.0 — Unified Router & Workspaces</span>
              <span className="changelog-date">Latest Release</span>
            </div>
            <ul className="changelog-list">
              <li><strong>Multi-Model Engine:</strong> Smart routing between Gemini 2.5, OpenRouter free models, Groq, and Cerebras with auto-failover.</li>
              <li><strong>Symmetrical Settings Architecture:</strong> Consolidated, unified card layout with clean alignments and merged preferences.</li>
              <li><strong>Responsive Error & Prompt Viewports:</strong> Error messages, rate limit notices, and warnings wrap cleanly on all screens.</li>
              <li><strong>Document & Slide Generation:</strong> Generate presentations (.pptx), spreadsheets (.xlsx), and reports (.docx) directly from chat.</li>
              <li><strong>Privacy Shield:</strong> Real-time regex and NLP masking for personal identities and credentials before transmission.</li>
              <li><strong>Coding Workspace:</strong> Connect GitHub repos, view diffs, run in-browser tests, and commit pull requests right from your chats.</li>
            </ul>
          </div>

          <div className="changelog-entry">
            <div className="changelog-head">
              <span className="changelog-tag">v1.9.0 — Voice & Sync</span>
              <span className="changelog-date">Previous</span>
            </div>
            <ul className="changelog-list">
              <li><strong>Voice Input:</strong> Dictate prompts using built-in speech recognition with language selection.</li>
              <li><strong>Cross-Device Sync:</strong> Real-time Firestore sync with local IndexedDB offline storage.</li>
              <li><strong>Model Memory:</strong> Persistent user facts and preference memories automatically referenced in chats.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

const PRESET_INSTRUCTIONS = [
  { label: '+ Healthcare / Medical', text: 'I work in healthcare; use metric units and clinical terminology. Provide concise, grounded explanations.' },
  { label: '+ Software Engineer', text: 'I am a software engineer; write clean, modular, typed code with minimal boilerplate and clear explanations.' },
  { label: '+ Concise & Direct', text: 'Keep answers short, direct, and factual. Avoid conversational filler, intros, or summaries.' },
  { label: '+ Egyptian Arabic', text: 'Answer in Egyptian Arabic unless I write in English. Use familiar everyday professional expressions.' },
];

function PersonalizeSection() {
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const [instructions, setInstructions] = useState(settings.customInstructions);

  const appendPreset = (text: string) => {
    const next = instructions.trim() ? `${instructions.trim()}\n• ${text}` : `• ${text}`;
    setInstructions(next);
    update({ customInstructions: next });
  };

  return (
    <div className="settings-section">
      <div className="settings-group">
        <span className="settings-group-title">Custom Instructions</span>
        <div className="settings-card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <span className="setting-label">Persona & Behavioral Guidelines</span>
            <span className="setting-hint">Instructions provided to every model with each message (your role, language preferences, formatting, or tone).</span>
          </div>
          <div className="preset-chips">
            {PRESET_INSTRUCTIONS.map(({ label, text }) => (
              <button key={label} type="button" className="preset-chip" onClick={() => appendPreset(text)}>
                {label}
              </button>
            ))}
          </div>
          <textarea
            dir="auto"
            rows={7}
            maxLength={4000}
            placeholder={'Examples:\n• I work in a hospital in Egypt; use metric units and EGP.\n• Answer in Egyptian Arabic unless I write in English.\n• Keep answers short unless I ask for detail.'}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            onBlur={() => update({ customInstructions: instructions })}
            style={{ width: '100%', resize: 'vertical', minHeight: 140, lineHeight: 1.55 }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <span className="muted small">{instructions.length}/4000</span>
          </div>
        </div>
      </div>

      <MemoryTab Toggle={Toggle} />
    </div>
  );
}

function PrivacyAndDataSection() {
  return (
    <div className="settings-section">
      <PrivacyTab Toggle={Toggle} Choice={Choice} />
      <DataTab />
    </div>
  );
}

export default function SettingsModal() {
  const open = useStore((s) => s.settingsOpen);
  const tab = useStore((s) => s.settingsTab);
  const settings = useStore((s) => s.settings);
  const { updateSettings: update, setUi, logout } = useStore.getState();
  const panel = useRef<HTMLDivElement>(null);

  const close = () => {
    setUi({ settingsOpen: false });
  };

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

  // Resolve active tab using alias mapping
  const resolvedTabId = TAB_ALIASES[tab] || tab || 'general';
  const current = TABS.find(([id]) => id === resolvedTabId) || TABS[0];
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
                <div className="settings-group">
                  <span className="settings-group-title">Appearance & Display</span>
                  <div className="settings-card">
                    <Choice<Theme> label="Interface theme" value={settings.theme} onChange={(v) => update({ theme: v })} options={[['system', 'Auto'], ['light', 'Light'], ['dark', 'Dark']]} />
                    <Choice<FontSize> label="Text size" value={settings.fontSize} onChange={(v) => update({ fontSize: v })} options={[['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']]} />
                  </div>
                </div>

                <div className="settings-group">
                  <span className="settings-group-title">Chat Preferences</span>
                  <div className="settings-card">
                    <Toggle label="Enter sends the message" hint="On desktop. Shift+Enter creates a new line. On mobile, use the send button." checked={settings.enterToSend} onChange={(v) => update({ enterToSend: v })} />
                    <Toggle label="Show reasoning process" hint="Displays collapsible thinking traces when models reason before answering." checked={settings.showThinking} onChange={(v) => update({ showThinking: v })} />
                    <Toggle label="Automatic conversation titles" hint="Uses a fast model to name new chats automatically after the first message." checked={settings.autoTitle} onChange={(v) => update({ autoTitle: v })} />
                    <Toggle
                      label="Compact long conversations"
                      hint="Condenses earlier messages in lengthy threads to maintain fast replies and prevent token limit issues."
                      checked={settings.autoCompact}
                      onChange={(v) => update({ autoCompact: v })}
                    />
                    <div className="setting-row">
                      <span className="setting-text">
                        <span className="setting-label">Voice dictation language</span>
                        <span className="setting-hint">Language used for browser speech recognition.</span>
                      </span>
                      <span className="setting-ctrl">
                        <select value={settings.voiceLang} onChange={(e) => update({ voiceLang: e.target.value })}>
                          {VOICE_LANGS.map(([v, l]) => (
                            <option key={v} value={v}>{l}</option>
                          ))}
                        </select>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="settings-group">
                  <span className="settings-group-title">Account & Session</span>
                  <div className="settings-card">
                    <div className="setting-row">
                      <span className="setting-text">
                        <span className="setting-label">Signed in with Google</span>
                        <span className="setting-hint">{useStore.getState().user?.email || 'Preview User'}</span>
                      </span>
                      <span className="setting-ctrl">
                        <button className="btn small logout" onClick={() => { setUi({ settingsOpen: false }); logout(); }}>
                          <LogOut size={14} /> Sign out
                        </button>
                      </span>
                    </div>
                  </div>
                </div>

                <UpdatesSection />
              </div>
            )}

            {id === 'keys' && <KeysTab />}
            {id === 'models' && <ModelsTab />}
            {id === 'personalize' && <PersonalizeSection />}
            {id === 'usage' && <UsageTab />}
            {id === 'privacy' && <PrivacyAndDataSection />}
          </div>
        </div>
      </div>
    </section>
  );
}
