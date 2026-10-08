import { ArrowDown, ArrowUp, Download, LogOut, Plus, RefreshCw, Search, Star, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { VOICE_LANGS } from '../lib/speech';
import { saveBlob } from '../lib/util';
import { useStore } from '../store';
import type { Chat, FontSize, ModelInfo, Theme } from '../types';
import Modal from './Modal';
import { Badges } from './ModelPicker';

const TABS = [
  ['general', 'General'],
  ['models', 'Models'],
  ['personalize', 'Personalize'],
  ['data', 'Data'],
] as const;

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
      <div className="section-head">
        <h3>Your models</h3>
        <span className="muted small">Order = switching order. ★ = default for new chats.</span>
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
                  {m ? (m.provider === 'google' ? 'Google' : 'OpenRouter') : 'Not available right now'}
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
      {(['google', 'openrouter'] as const).map((p) =>
        catalog?.providers[p] ? (
          <div key={p}>
            <div className="pop-label">{p === 'google' ? 'Google (free tier)' : 'OpenRouter (free models)'}</div>
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
            {p === 'google' ? 'Google' : 'OpenRouter'} isn't connected. Add {p === 'google' ? 'GEMINI_API_KEY' : 'OPENROUTER_API_KEY'} in Vercel to use its models.
          </p>
        ),
      )}
      <p className="muted small legend">
        Icons: <Badges m={{ vision: true } as ModelInfo} /> reads images · <Badges m={{ search: true } as ModelInfo} /> web search · <Badges m={{ thinking: true } as ModelInfo} /> thinks first
      </p>
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
      <p className="muted">Chats are saved only on this device. Use a backup to move them to another phone or computer.</p>
      <div className="setting-row">
        <span className="setting-text">
          <span className="setting-label">Back up chats</span>
          <span className="setting-hint">{count} chat{count === 1 ? '' : 's'} with attachments, as one file.</span>
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
          <span className="setting-hint">Removes every chat from this device. This can't be undone.</span>
        </span>
        <button className="btn small danger" onClick={() => { if (confirm('Delete all chats on this device?')) void clearAllChats().then(() => toast('All chats deleted.', 'success')); }}>
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
  useEffect(() => {
    if (open) setInstructions(useStore.getState().settings.customInstructions);
  }, [open]);
  if (!open) return null;
  const close = () => {
    if (instructions !== settings.customInstructions) update({ customInstructions: instructions });
    setUi({ settingsOpen: false });
  };

  return (
    <Modal title="Settings" onClose={close} wide>
      <div className="settings">
        <nav className="settings-tabs" role="tablist">
          {TABS.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setUi({ settingsTab: id })}>
              {label}
            </button>
          ))}
        </nav>
        <div className="settings-panel">
          {tab === 'general' && (
            <div className="settings-section">
              <Choice<Theme> label="Theme" value={settings.theme} onChange={(v) => update({ theme: v })} options={[['system', 'Auto'], ['light', 'Light'], ['dark', 'Dark']]} />
              <Choice<FontSize> label="Text size" value={settings.fontSize} onChange={(v) => update({ fontSize: v })} options={[['small', 'S'], ['medium', 'M'], ['large', 'L']]} />
              <Toggle label="Show thinking" hint="Show the model's reasoning (collapsed) when it thinks before answering." checked={settings.showThinking} onChange={(v) => update({ showThinking: v })} />
              <Toggle label="Name chats automatically" hint="Uses a light model to write a short title after the first reply." checked={settings.autoTitle} onChange={(v) => update({ autoTitle: v })} />
              <Toggle label="Enter sends the message" hint="On computers. Shift+Enter adds a new line. On phones, use the send button." checked={settings.enterToSend} onChange={(v) => update({ enterToSend: v })} />
              <label className="setting-row">
                <span className="setting-label">Voice input language</span>
                <select value={settings.voiceLang} onChange={(e) => update({ voiceLang: e.target.value })}>
                  {VOICE_LANGS.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </label>
              <button className="btn ghost logout" onClick={() => { setUi({ settingsOpen: false }); logout(); }}>
                <LogOut size={16} /> Sign out
              </button>
            </div>
          )}
          {tab === 'models' && <ModelsTab />}
          {tab === 'personalize' && (
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
          {tab === 'data' && <DataTab />}
        </div>
      </div>
    </Modal>
  );
}
