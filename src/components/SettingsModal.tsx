import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Boxes,
  Brain,
  CheckCircle2,
  ChevronRight,
  Database,
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
  Search,
  Shield,
  SlidersHorizontal,
  Star,
  Trash2,
  Upload,
  UserRound,
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
  ['general', 'General', SlidersHorizontal, 'Appearance, chat behaviour and your account'],
  ['keys', 'API keys', KeyRound, 'Your free Gemini, OpenRouter, Groq and Cerebras keys'],
  ['models', 'Models', Boxes, 'Your models, Auto and layouts for coding, everyday, thinking…'],
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
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-group-title">
          <span>Your models</span>
          <span className="muted" style={{ fontWeight: 400, textTransform: 'none' }}>Order = switching order. ★ = default for new chats.</span>
        </div>
        <div className="settings-card">
          <ul className="model-list" style={{ border: 0, margin: 0, borderRadius: 0 }}>
            {enabled.length === 0 && <li className="muted small pad" style={{ padding: '16px 18px' }}>No models yet. Add some below.</li>}
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
        <span className="settings-group-title">Workspace Layouts</span>
        <LayoutsSection onEdit={setEditing} />
      </div>

      <div className="settings-group">
        <div className="settings-group-title">
          <span>Add models</span>
          <button className="link-btn small" disabled={refreshing} onClick={async () => { setRefreshing(true); await loadCatalog(); setRefreshing(false); }}>
            <RefreshCw size={13} className={refreshing ? 'spin' : ''} /> Refresh
          </button>
        </div>
        <div className="settings-card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {catalogError && <p className="error-text small" dir="auto">{catalogError}</p>}
          <label className="search" style={{ margin: 0 }}>
            <Search size={16} />
            <input type="search" placeholder="Search models (e.g. gemini, deepseek, qwen)" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          {(Object.keys(PROVIDER_NAMES) as ProviderId[]).map((p) =>
            catalog?.providers[p] || !catalog ? (
              <div key={p}>
                <div className="pop-label" style={{ marginBottom: 6 }}>{{ google: 'Google (free tier)', openrouter: 'OpenRouter (free models)', groq: 'Groq (free plan)', cerebras: 'Cerebras (free plan)' }[p]}</div>
                <ul className="model-list add" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
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
              <p key={p} className="muted small" style={{ margin: '4px 0' }}>
                {PROVIDER_NAMES[p]} isn't connected. Add its key under API keys to use its models.
              </p>
            ),
          )}
          <p className="muted small legend" style={{ margin: '8px 0 0' }}>
            Icons: <Badges m={{ vision: true } as ModelInfo} /> reads images · <Badges m={{ search: true } as ModelInfo} /> web search · <Badges m={{ thinking: true } as ModelInfo} /> thinks first
          </p>
        </div>
      </div>
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
    hint: 'Lets chats read your repositories and commit changes. Use a fine-grained token with Contents and Pull requests set to Read and write, and Actions set to Read (for test results).',
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
        <span className="settings-group-title">Provider Keys</span>
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
                    {linkText || 'Get a free key'} <ExternalLink size={12} />
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

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 12 }}>
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

      <div className="settings-group" style={{ marginTop: 8 }}>
        <span className="settings-group-title">Key Safety</span>
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
    <div className="settings-section">
      <div className="settings-group">
        <span className="settings-group-title">Chat Data & Storage</span>
        <div className="settings-card">
          <div className="setting-row">
            <span className="setting-text">
              <span className="setting-label">Back up chats</span>
              <span className="setting-hint">Save {count} chat{count === 1 ? '' : 's'} (with this device's attachments) as one file.</span>
            </span>
            <span className="setting-ctrl">
              <button className="btn small" onClick={() => saveBlob(new Blob([JSON.stringify({ app: 'model-router', version: 2, chats }, null, 0)], { type: 'application/json' }), `model-router-backup-${new Date().toISOString().slice(0, 10)}.json`)}>
                <Download size={14} /> Back up
              </button>
            </span>
          </div>
          <div className="setting-row">
            <span className="setting-text">
              <span className="setting-label">Restore a backup</span>
              <span className="setting-hint">Adds the chats from a backup file. Existing chats are kept.</span>
            </span>
            <span className="setting-ctrl">
              <button className="btn small" onClick={() => fileRef.current?.click()}>
                <Upload size={14} /> Restore
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
              <span className="setting-hint">Removes every chat from all your devices. This can't be undone.</span>
            </span>
            <span className="setting-ctrl">
              <button className="btn small danger" onClick={() => { if (confirm('Delete all chats on all your devices?')) void clearAllChats().then(() => toast('All chats deleted.', 'success')); }}>
                <Trash2 size={14} /> Delete all
              </button>
            </span>
          </div>
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
              {updateReady ? 'A new version has downloaded.' : checkedAt ? `Last checked today at ${checkedAt}` : 'Model Router is running the latest build.'}
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
              <li><strong>Multi-Model Engine:</strong> Smart routing between Gemini 2.5 Flash / Pro, OpenRouter free models, Groq, and Cerebras with auto-failover.</li>
              <li><strong>Symmetrical Settings Architecture:</strong> Consolidated, unified card layout with clean alignments and balanced sections.</li>
              <li><strong>Responsive Error & Prompt Viewports:</strong> Error messages, rate limit notices, and warnings wrap properly on both phone screens and desktop displays.</li>
              <li><strong>Document & Slide Generation:</strong> Build presentation decks (.pptx), spreadsheet trackers (.xlsx), and Word reports (.docx) directly from chat.</li>
              <li><strong>Privacy Shield:</strong> Real-time regex and NLP masking for personal identities, phone numbers, and keys before transmission to AI models.</li>
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
              <li><strong>Cross-Device Sync:</strong> Lightweight real-time Firestore sync with local IndexedDB offline storage.</li>
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

function PersonalizeTab() {
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
        <span className="settings-group-title">Instructions</span>
        <div className="settings-card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label className="field-block" style={{ paddingTop: 0 }}>
            <span className="setting-label">Custom instructions</span>
            <span className="setting-hint">Tell every model about you and how to answer — e.g. your job, language preferences, tone, or formats you like.</span>
            <div className="preset-chips">
              {PRESET_INSTRUCTIONS.map(({ label, text }) => (
                <button key={label} type="button" className="preset-chip" onClick={() => appendPreset(text)}>
                  {label}
                </button>
              ))}
            </div>
            <textarea
              dir="auto"
              rows={8}
              maxLength={4000}
              placeholder={'Examples:\n• I work in a hospital in Egypt; use metric units and EGP.\n• Answer in Egyptian Arabic unless I write in English.\n• Keep answers short unless I ask for detail.'}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              onBlur={() => update({ customInstructions: instructions })}
              style={{ width: '100%', resize: 'vertical', minHeight: 160, lineHeight: 1.55 }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <span className="muted small">{instructions.length}/4000</span>
            </div>
          </label>
        </div>
      </div>
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

  const current = TABS.find(([id]) => id === (tab === 'layouts' ? 'models' : tab)) || TABS[0];
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
                    <Choice<Theme> label="Theme" value={settings.theme} onChange={(v) => update({ theme: v })} options={[['system', 'Auto'], ['light', 'Light'], ['dark', 'Dark']]} />
                    <Choice<FontSize> label="Text size" value={settings.fontSize} onChange={(v) => update({ fontSize: v })} options={[['small', 'S'], ['medium', 'M'], ['large', 'L']]} />
                  </div>
                </div>

                <div className="settings-group">
                  <span className="settings-group-title">Chat Preferences</span>
                  <div className="settings-card">
                    <Toggle label="Enter sends the message" hint="On computers. Shift+Enter adds a new line. On phones, use the send button." checked={settings.enterToSend} onChange={(v) => update({ enterToSend: v })} />
                    <Toggle label="Show thinking" hint="Show the model's reasoning (collapsed) when it thinks before answering." checked={settings.showThinking} onChange={(v) => update({ showThinking: v })} />
                    <Toggle label="Name chats automatically" hint="Uses a light model to write a short title after the first reply." checked={settings.autoTitle} onChange={(v) => update({ autoTitle: v })} />
                    <Toggle
                      label="Compact long chats automatically"
                      hint="When a chat gets long, older messages are summarized and the summary is sent instead — faster replies and fewer limits. You can also type /compact."
                      checked={settings.autoCompact}
                      onChange={(v) => update({ autoCompact: v })}
                    />
                    <div className="setting-row">
                      <span className="setting-text">
                        <span className="setting-label">Voice input language</span>
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
                        <span className="setting-label">Signed in</span>
                        <span className="setting-hint">{useStore.getState().user?.email}</span>
                      </span>
                      <span className="setting-ctrl">
                        <button className="btn small logout" onClick={() => { setUi({ settingsOpen: false }); logout(); }}>
                          <LogOut size={15} /> Sign out
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
            {id === 'usage' && <UsageTab />}
            {id === 'personalize' && <PersonalizeTab />}
            {id === 'memory' && <MemoryTab Toggle={Toggle} />}
            {id === 'privacy' && <PrivacyTab Toggle={Toggle} Choice={Choice} />}
            {id === 'data' && <DataTab />}
          </div>
        </div>
      </div>
    </section>
  );
}
