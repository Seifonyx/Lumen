import Toggle from './SettingToggle';
import ModelsTab from './ModelSettings';
import { Clock,
  ChevronLeft,
  Blocks,
  Boxes,
  Brain,
  ChevronRight,
  Download,
  Gauge,
  KeyRound,
  LogOut,
  RefreshCw,
  Shield,
  SlidersHorizontal,
  Trash2,
  Upload,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Suspense, useEffect, useRef, useState } from 'react';
import { VOICE_LANGS } from '../lib/speech';
import { useFocusScope } from '../lib/focus-scope';
import { PreviewTools } from './PreviewTools';
import { isTouch, saveBlob } from '../lib/util';
import { useStore } from '../store';
import type { Chat, FontSize, Theme } from '../types';
import ConnectorsTab from './ConnectorsTab';
import { savedChats } from '../lib/temporary-chat';
import { pageSwap, useSegmentThumb } from '../lib/motion';
import { playSend } from '../lib/sounds';
import { navigatorDefault } from './MessageThread';
import { installSwipeBack } from '../lib/swipe-back';
import { version as APP_VERSION } from '../../package.json';
import Modal from './Modal';
import { deleteCloudData, deleteLocalData, deleteSignIn } from '../lib/delete-account';
import { forgetLocalAccount, isPreviewUser, signOutUser } from '../lib/firebase';
import UsageTab from './UsageTab';
import MemoryTab from './MemoryTab';
import KeysPanel from './KeysPanel';
import SharedLinks from './SharedLinks';
import ImportChats from './ImportChats';
import TaskLibrary from './TaskLibrary';
import NotifyToggle from './NotifyToggle';
import PrivacyTab from './PrivacyTab';
import { CANVAS_SHELL, CanvasSettingsIndex, navigateBack, PhoneNavigation } from '../lib/canvas-presentation';

/** Settings sections: id, name, icon, one-line description */
const TABS: [string, string, LucideIcon, string][] = [
  ['general', 'General', SlidersHorizontal, 'Account, appearance and chat behaviour'],
  ['keys', 'API keys', KeyRound, 'Provider connections, access and billing controls'],
  ['connectors', 'Connectors', Blocks, 'GitHub repositories and connected services'],
  ['models', 'Models', Boxes, 'Your models, Auto routing and layouts'],
  ['usage', 'Usage', Gauge, "Today's requests, limits and resets"],
  ['personalize', 'Personalization', UserRound, 'Instructions every model follows'],
  ['memory', 'Memory', Brain, 'What models remember about you'],
  ['tasks', 'Scheduled tasks', Clock, 'Reminders and AI requests on a schedule'],
  ['privacy', 'Privacy & data', Shield, 'Protect personal details and manage chat backups'],
];

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
  const seg = useRef<HTMLDivElement>(null);
  useSegmentThumb(seg, value);
  return (
    <div className={`setting-row${options.length > 3 ? ' choice-wide' : ''}`}>
      <span className="setting-text">
        <span className="setting-label">{label}</span>
        {hint && <span className="setting-hint">{hint}</span>}
      </span>
      <span className="setting-ctrl">
        <div className="segmented has-thumb" role="radiogroup" aria-label={label} ref={seg}>
          <span className="seg-thumb" aria-hidden="true" />
          {options.map(([v, text]) => (
            <button key={v} role="radio" aria-label={label==='Text size'?v==='small'?'Small':v==='medium'?'Medium':'Large':undefined} aria-checked={value === v} tabIndex={value===v?0:-1} className={value === v ? 'active' : ''} onClick={() => onChange(v)} onKeyDown={e=>{
              if(!['ArrowLeft','ArrowUp','ArrowRight','ArrowDown','Home','End'].includes(e.key))return;
              e.preventDefault();const index=options.findIndex(([key])=>key===v);
              const next=e.key==='Home'?0:e.key==='End'?options.length-1:(index+(e.key==='ArrowLeft'||e.key==='ArrowUp'?-1:1)+options.length)%options.length;
              onChange(options[next][0]);e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
            }}>
              {text}
            </button>
          ))}
        </div>
      </span>
    </div>
  );
}

function DataTab() {
  const [deleting, setDeleting] = useState(false);
  const chats = useStore((s) => s.chats);
  const { clearAllChats, importChats, toast } = useStore.getState();
  const fileRef = useRef<HTMLInputElement>(null);
  const count = chats.filter((c) => c.messages.length || c.documents?.length).length;

  return (
    <div className="settings-section">
      <div className="settings-group">
        <span className="settings-group-title">Chat backups</span>
        <div className="settings-card">
          <div className="setting-row">
            <span className="setting-text">
              <span className="setting-label">Back up chats</span>
              <span className="setting-hint">Save {count} chat{count === 1 ? '' : 's'} (with this device's attachments) as one file.</span>
            </span>
            <span className="setting-ctrl">
              <button className="btn small" onClick={() => saveBlob(new Blob([JSON.stringify({ app: 'model-router', version: 2, chats: savedChats(chats) }, null, 0)], { type: 'application/json' }), `lumen-backup-${new Date().toISOString().slice(0, 10)}.json`)}>
                <Download size={14} /> Back up
              </button>
            </span>
          </div>
          <div className="setting-row">
            <span className="setting-text">
              <span className="setting-label">Restore a backup</span>
              <span className="setting-hint">Adds its chats; yours are kept.</span>
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
                  toast("That file isn't a Lumen backup.", 'error');
                }
              }}
            />
          </div>
          <ImportChats />
        </div>
      </div>
      <SharedLinks />
      {deleting && <DeleteAccount onClose={() => setDeleting(false)} />}
      <div className="settings-group">
        <span className="settings-group-title">Delete</span>
        <div className="settings-card danger">
          <div className="setting-row danger-row">
            <span className="setting-text">
              <span className="setting-label">Delete all chats</span>
              <span className="setting-hint">Removes every chat from all your devices. This can't be undone.</span>
            </span>
            <span className="setting-ctrl">
              <button className="btn small danger" onClick={() => { if (confirm('Delete all chats on all your devices?')) void clearAllChats().then(() => toast('All chats deleted.', 'success')); }}>
                <Trash2 size={14} /> Delete all
              </button>
            </span>
          </div>
          <div className="setting-row danger-row">
            <span className="setting-text">
              <span className="setting-label">Delete my account and data</span>
              <span className="setting-hint">Removes your chats, files, memories, keys, settings and share links everywhere, then signs you out.</span>
            </span>
            <span className="setting-ctrl">
              <button className="btn small danger" onClick={() => setDeleting(true)}>
                <Trash2 size={14} /> Delete account
              </button>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Typed confirmation, then deletes everything for this account (cloud and this device) and signs out. */
function DeleteAccount({ onClose }: { onClose: () => void }) {
  const user = useStore((s) => s.user);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async () => {
    if (!user) return;
    setBusy(true); setError('');
    const { stop, toast } = useStore.getState();
    stop();
    try {
      if (!isPreviewUser(user.uid)) await deleteCloudData(user.uid);
    } catch (e) {
      setBusy(false);
      setError(`Couldn't delete your data: ${(e as Error).message}. Nothing was signed out; try again.`);
      return;
    }
    await deleteLocalData(user.uid);
    forgetLocalAccount(user.uid);
    const removed = isPreviewUser(user.uid) || await deleteSignIn();
    toast(removed ? 'Your account and data were deleted.' : 'Your data was deleted. Signed out.', 'success');
    await signOutUser().catch(() => {});
    window.setTimeout(() => location.reload(), 600);
  };
  return (
    <Modal title="Delete your account?" onClose={busy ? () => {} : onClose}>
      <div className="delete-account">
        <p>This permanently deletes everything Lumen stores for <b dir="auto">{user?.email}</b>: chats, messages, files, memories, projects, scheduled tasks, API keys, settings and share links, on every device. It can't be undone.</p>
        <p className="muted small">Want a copy first? Use <b>Back up</b> above before you continue.</p>
        <label className="field-block"><span className="setting-label">Type DELETE to confirm</span><input value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="characters" autoComplete="off" aria-label="Type DELETE to confirm" disabled={busy} /></label>
        {error && <p className="free-tool-error" role="alert">{error}</p>}
        <div className="delete-account-actions">
          <button className="btn" disabled={busy} onClick={onClose}>Cancel</button>
          <button className="btn danger-fill" disabled={busy || typed.trim().toUpperCase() !== 'DELETE'} onClick={() => void run()}>{busy ? 'Deleting…' : 'Delete everything'}</button>
        </div>
      </div>
    </Modal>
  );
}

const SUPPORT_EMAIL = 'hebaghoneim8@gmail.com';

/** The people who build Lumen (Developer options are only shown to them). */
const DEVELOPERS = ['hebaghoneim8@gmail.com', 'seifeldingamal2021@gmail.com'];

function AboutSection() {
  const updateReady = useStore((s) => s.updateReady);
  const developer = useStore((s) => DEVELOPERS.includes((s.user?.email || '').toLowerCase()) || isPreviewUser(s.user?.uid));
  const [devOpen, setDevOpen] = useState(false);
  return (
    <div className="settings-group">
      <span className="settings-group-title">About</span>
      <div className="settings-card">
        <div className="setting-row">
          <span className="setting-text">
            <span className="setting-label">Lumen <span className="tag" style={{ textTransform: 'none' }}>v{APP_VERSION}</span></span>
            <span className="setting-hint">{updateReady ? 'A new version is ready to install.' : "You're on the latest version."}</span>
          </span>
          {updateReady && (
            <span className="setting-ctrl">
              <button className="btn small primary" onClick={updateReady}>
                <RefreshCw size={14} /> Update now
              </button>
            </span>
          )}
        </div>
        <div className="setting-row">
          <span className="setting-text">
            <span className="setting-label">Report a problem or suggest an idea</span>
            <span className="setting-hint">Opens an email with your app version and device filled in.</span>
          </span>
          <span className="setting-ctrl">
            <a className="btn small" href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Lumen ${APP_VERSION} feedback`)}&body=${encodeURIComponent(`\n\n—\nLumen ${APP_VERSION} · ${navigator.userAgent}`)}`}>Email us</a>
          </span>
        </div>
        <div className="setting-row">
          <span className="setting-text">
            <span className="setting-label">Privacy and terms</span>
            <span className="setting-hint">What Lumen stores, where your messages go, and the rules of use.</span>
          </span>
          <span className="setting-ctrl about-links">
            <a className="link-btn small" href="/privacy.html" target="_blank" rel="noopener">Privacy Policy</a>
            <a className="link-btn small" href="/terms.html" target="_blank" rel="noopener">Terms</a>
          </span>
        </div>
        {developer && (
        <div className="setting-row">
          <span className="setting-text">
            <span className="setting-label">Developer options</span>
            <span className="setting-hint">For developers and testing only.</span>
          </span>
          <span className="setting-ctrl">
            <button className="btn small" onClick={() => setDevOpen(!devOpen)} aria-expanded={devOpen}>
              {devOpen ? 'Hide' : 'Show'}
            </button>
          </span>
        </div>
        )}
      </div>
      {developer && devOpen && <PreviewTools />}
    </div>
  );
}

const PRESET_INSTRUCTIONS = [
  { label: '+ Student', text: 'I am a student; explain things step by step with simple examples, and check my understanding.' },
  { label: '+ Software Engineer', text: 'I am a software engineer; write clean, modular, typed code with minimal boilerplate and clear explanations.' },
  { label: '+ Concise & Direct', text: 'Keep answers short, direct, and factual. Avoid conversational filler, intros, or summaries.' },
  { label: '+ Explain simply', text: 'Explain things in plain words, as if to a smart friend who is new to the topic. Define any jargon.' },
  { label: '+ Show sources', text: 'When you state facts that could be wrong or out of date, say how sure you are and where they come from.' },
];

const REPLY_LANGUAGES = ['English', 'Arabic', 'Egyptian Arabic', 'French', 'Spanish', 'German', 'Italian', 'Portuguese', 'Turkish', 'Russian', 'Chinese', 'Japanese', 'Korean', 'Hindi', 'Urdu', 'Indonesian', 'Dutch', 'Persian'];

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
        <span className="settings-group-title">Answers</span>
        <div className="settings-card">
          <div className="setting-row">
            <span className="setting-text">
              <span className="setting-label">Reply language</span>
              <span className="setting-hint">Match your writing, or always use one.</span>
            </span>
            <span className="setting-ctrl">
              <select aria-label="Reply language" value={settings.replyLanguage || ''} onChange={(e) => update({ replyLanguage: e.target.value || undefined })}>
                <option value="">Match my writing</option>
                {REPLY_LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </span>
          </div>
          <Choice<'auto' | 'short' | 'detailed'> label="Answer length" value={settings.answerLength || 'auto'} onChange={(v) => update({ answerLength: v === 'auto' ? undefined : v })} options={[['auto', 'Auto'], ['short', 'Short'], ['detailed', 'Detailed']]} />
        </div>
      </div>
      <div className="settings-group">
        <div className="settings-card pad-card">
          <label className="field-block" style={{ paddingTop: 0 }}>
            <span className="setting-label">Custom instructions</span>
            <span className="setting-hint">About you and how you like answers.</span>
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
              placeholder={'Examples:\n• Use metric units and my local currency.\n• Explain technical terms simply.\n• Keep answers short unless I ask for detail.'}
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

// The Canvas presentation moves API keys, Models (with Layouts) and Usage into Router (src/lib/router-settings-route.ts).
const SECTIONS = CANVAS_SHELL ? TABS.filter(([id]) => !['keys', 'models', 'usage'].includes(id)) : TABS;

// Router reuses these through this chunk, so the shared editors keep one place in the bundle.
export { KeysPanel, ModelsTab };

export default function SettingsModal() {
  const open = useStore((s) => s.settingsOpen);
  const tab = useStore((s) => s.settingsTab);
  const settings = useStore((s) => s.settings);
  const user = useStore((s) => s.user);
  const { updateSettings: update, setUi, logout } = useStore.getState();
  const panel = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const dialog = useRef<HTMLElement>(null);

  const close = () => {
    if (CANVAS_SHELL && window.matchMedia('(max-width:899px)').matches) navigateBack!(() => setUi({ settingsOpen: false }));
    else setUi({ settingsOpen: false });
  };
  // Escape dismisses Settings. The visible phone Back control and edge-swipe still traverse history.
  // Replaying one history entry per changed Settings tab left the dialog open on desktop and in tests.
  useFocusScope(dialog,open,()=>{
    if (CANVAS_SHELL) setUi({ settingsOpen: false });
    else if (tab && window.matchMedia('(max-width:720px), (pointer:coarse) and (max-width:1100px)').matches) setUi({ settingsTab: '' });
    else close();
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || useStore.getState().preview) return;
      // If Settings owns Escape in Canvas, dismiss the entire dialog. The visible Back
      // button (not Escape) handles the nested section. Menus and editors own their own Escape.
      if (CANVAS_SHELL) {
        if (e.defaultPrevented || document.querySelector('.modal-backdrop,.sheet-backdrop,.glass-select-menu,[role="menu"]')) return;
        setUi({ settingsOpen: false });
      } else if (tab && window.matchMedia('(max-width: 720px), (pointer: coarse) and (max-width: 1100px)').matches) go('');
      else close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    panel.current?.scrollTo({ top: 0 });
  }, [tab]);

  // Canvas: Settings can open on a section Router now owns if that request came before the redirect hook was
  // installed (a first sign-in). Hand it to Router; the hook replaces this history entry.
  useEffect(() => {
    if (CANVAS_SHELL && open && ['keys', 'models', 'layouts', 'usage'].includes(tab)) setUi({ settingsTab: tab });
  }, [open, tab, setUi]);

  // Phones: swipe from the left edge of a section to go back to the list (follows the finger).
  useEffect(() => {
    const page = dialog.current;
    if (!open || !page) return;
    const narrow = () => window.matchMedia('(max-width: 720px), (pointer: coarse) and (max-width: 1100px)').matches;
    const section = installSwipeBack(page, () => narrow() && Boolean(useStore.getState().settingsTab), (copy) => copy.classList.remove('has-section'), () => CANVAS_SHELL ? navigateBack!(() => setUi({ settingsTab: '' })) : setUi({ settingsTab: '' }));
    // iPhone glass look: from the list of sections, swiping right closes Settings and the chat slides back.
    const root = installSwipeBack(page, () => narrow() && !useStore.getState().settingsTab && document.documentElement.classList.contains('glass'), () => {}, () => CANVAS_SHELL ? navigateBack!(() => setUi({ settingsOpen: false })) : setUi({ settingsOpen: false }), { reveal: () => document.querySelector<HTMLElement>('.app > .main') });
    return () => { section(); root(); };
  }, [open, setUi]);


  if (!open) return null;

  // Phones: a section slides in from the right over the list (push); back slides it away (pop).
  function go(next: string) {
    if (CANVAS_SHELL && !next && window.matchMedia('(max-width:899px)').matches) { navigateBack!(() => setUi({ settingsTab: '' })); return; }
    const narrow = window.matchMedia('(max-width: 720px), (pointer: coarse) and (max-width: 1100px)').matches;
    if (narrow && dialog.current && Boolean(next) !== Boolean(tab)) pageSwap(next ? 'push' : 'pop', dialog.current, () => dialog.current, () => setUi({ settingsTab: next }));
    else setUi({ settingsTab: next });
  }

  const current = SECTIONS.find(([id]) => id === (tab === 'layouts' ? 'models' : tab === 'data' ? 'privacy' : tab)) || SECTIONS[0];
  const [id, label, , blurb] = current;

  return (
    // On computers the sidebar stays usable next to Settings; on phones Settings covers the screen.
    <section className={`settings-page${tab ? ' has-section' : ''}${scrolled ? ' scrolled' : ''}`} aria-label="Settings" role="dialog" aria-modal={window.matchMedia('(max-width: 899px)').matches || undefined} data-keep-sidebar="true" tabIndex={-1} ref={dialog}>
      {CANVAS_SHELL && window.matchMedia('(max-width:899px)').matches && PhoneNavigation ? <PhoneNavigation title={tab ? label : 'Settings'} backTarget={tab ? 'settings-index' : 'settings-exit'} onBack={tab ? () => setUi({ settingsTab: '' }) : () => setUi({ settingsOpen: false })} /> : <header className="settings-top">
        {tab ? (
          <button className="icon-btn settings-back" onClick={() => go('')} aria-label={CANVAS_SHELL ? "Back" : "All settings"}>
            <ChevronLeft size={24} />
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
      </header>}

      <div className="settings-scroll" ref={panel} tabIndex={0} onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 40)}>
        {/* iPhone glass look: an iOS large title that scrolls away (hidden otherwise) */}
        <p className="settings-large-title" aria-hidden="true">{tab ? label : 'Settings'}</p>
        <div className="settings-inner">
          {CANVAS_SHELL && CanvasSettingsIndex && window.matchMedia('(max-width:899px)').matches ? <Suspense fallback={null}><CanvasSettingsIndex sections={SECTIONS} open={go} /></Suspense> : <nav className="settings-tabs" aria-label="Settings sections">
            {SECTIONS.map(([tid, tlabel, Icon, tblurb]) => (
              <button key={tid} aria-current={id === tid ? 'page' : undefined} className={id === tid ? 'active' : ''} onClick={() => go(tid)}>
                <span className="tab-icon"><Icon size={16} /></span>
                <span className="tab-text">
                  <span className="tab-label">{tlabel}</span>
                  <span className="tab-blurb">{tblurb}</span>
                </span>
                <ChevronRight size={16} className="tab-chev" />
              </button>
            ))}
          </nav>}

          <div className="settings-panel">
            <div className="settings-heading">
              <h2>{label}</h2>
              <p>{blurb}</p>
            </div>

            {id === 'general' && (
              <div className="settings-section">
                <div className="settings-card">
                  <div className="account-row">
                    <span className="avatar" aria-hidden="true">
                      {user?.photo ? <img src={user.photo} alt="" referrerPolicy="no-referrer" /> : (user?.name || user?.email || '?').charAt(0).toUpperCase()}
                    </span>
                    <span className="setting-text">
                      <span className="setting-label">{user?.name || user?.email}</span>
                      {user?.name && <span className="setting-hint">{user.email}</span>}
                    </span>
                    <span className="setting-ctrl">
                      <button className="btn small logout" onClick={() => { setUi({ settingsOpen: false }); logout(); }}>
                        <LogOut size={15} /> Sign out
                      </button>
                    </span>
                  </div>
                </div>

                <div className="settings-group">
                  <span className="settings-group-title">Appearance</span>
                  <div className="settings-card">
                    {CANVAS_SHELL
                      ? <Choice<Theme> label="Theme" value={settings.theme === 'black' ? 'dark' : settings.theme} onChange={(v) => update({ theme: v })} options={[['system', 'Auto'], ['light', 'Light'], ['dark', 'Dark']]} />
                      : <Choice<Theme> label="Theme" value={settings.theme} onChange={(v) => update({ theme: v })} options={[['system', 'Auto'], ['light', 'Light'], ['dark', 'Dark'], ['black', 'True black']]} />}
                    <Choice<FontSize> label="Text size" value={settings.fontSize} onChange={(v) => update({ fontSize: v })} options={[['auto', 'Auto'], ['small', 'S'], ['medium', 'M'], ['large', 'L']]} />
                  </div>
                </div>

                <div className="settings-group">
                  <span className="settings-group-title">Chat</span>
                  <div className="settings-card">
                    <Toggle label="Enter sends the message" hint="On computers. Shift+Enter adds a new line. On phones, use the send button." checked={settings.enterToSend} onChange={(v) => update({ enterToSend: v })} />
                    {isTouch() && <Toggle label="Vibration" hint="A light tap when you send, flip a switch, hold a message or swipe a chat." checked={settings.haptics !== false} onChange={(v) => update({ haptics: v })} />}
                    <Toggle label="Sound when sending" hint="A soft sound when your message goes. On iPhone it follows the silent switch." checked={Boolean(settings.sendSound)} onChange={(v) => { update({ sendSound: v }); if (v) playSend(); }} />
                    <NotifyToggle Toggle={Toggle} on={Boolean(settings.notifyReplies)} onChange={(v) => update({ notifyReplies: v })} />
                    <Toggle label="Message navigator" hint="The lines on the right of long chats that jump between your messages." checked={settings.messageNavigator ?? navigatorDefault()} onChange={(v) => update({ messageNavigator: v })} />
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
                        <select aria-label="Voice input language" value={settings.voiceLang} onChange={(e) => update({ voiceLang: e.target.value })}>
                          {VOICE_LANGS.map(([v, l]) => (
                            <option key={v} value={v}>{l}</option>
                          ))}
                        </select>
                      </span>
                    </div>
                  </div>
                </div>

                <AboutSection />
              </div>
            )}

            {id === 'keys' && <KeysPanel />}
            {id === 'connectors' && <ConnectorsTab />}
            {id === 'models' && <ModelsTab />}
            {id === 'usage' && <UsageTab />}
            {id === 'personalize' && <PersonalizeTab />}
            {id === 'memory' && <MemoryTab Toggle={Toggle} />}
            {id === 'tasks' && <div className="settings-section"><TaskLibrary onClose={() => setUi({ settingsOpen: false })} /></div>}
            {id === 'privacy' && <div className="settings-section privacy-data"><PrivacyTab Toggle={Toggle} Choice={Choice} /><DataTab /></div>}
          </div>
        </div>
      </div>
    </section>
  );
}
