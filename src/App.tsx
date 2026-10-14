import { lazy, Suspense, useEffect, useState } from 'react';
import ChatView from './components/ChatView';
import Login from './components/Login';
import NotInvited from './components/NotInvited';
import Sidebar from './components/Sidebar';
import Toasts from './components/Toasts';
import UpdateBar from './components/UpdateBar';
import WorkspacePanel from './components/WorkspacePanel';
import { listenForNotificationTaps } from './lib/notify';
import { useStore } from './store';
import { matchShortcut } from './lib/shortcuts';
import { copyText } from './lib/util';
import { keepScreenAwake } from './lib/wakelock';
import { installSidebarGestures } from './lib/sidebar-gesture';
import TaskEngine from './components/TaskEngine';
import { cancelKnowledge } from './lib/knowledge/engine';

const RunPanel = lazy(() => import('./components/RunPanel'));
const ShortcutsModal = lazy(() => import('./components/ShortcutsModal'));
// Screens opened on demand load their code the first time they open.
const SettingsModal = lazy(() => import('./components/SettingsModal'));
const CommandPalette = lazy(() => import('./components/CommandPalette'));
const RepoPicker = lazy(() => import('./components/RepoPicker'));
const PreviewModal = lazy(() => import('./components/PreviewModal'));
const ComparisonResultsModal = lazy(() => import('./components/ComparisonResultsModal'));
const AssistantLibrary = lazy(() => import('./components/AssistantLibrary'));
const CanvasPanel = lazy(() => import('./components/CanvasPanel'));
const ChatExportModal = lazy(() => import('./components/ChatExportModal'));

export default function App() {
  const authed = useStore((s) => s.authed);
  const init = useStore((s) => s.init);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setUi = useStore((s) => s.setUi);
  const accessDenied = useStore((s) => s.accessDenied);
  const settingsOpen = useStore((s) => s.settingsOpen);
  const workspaceOpen = useStore((s) => s.workspaceOpen);
  const canvasOpen = useStore((s) => s.canvasOpen);
  const runner = useStore((s) => s.runner);
  const exportChatId = useStore((s) => s.exportChatId);
  const repoPicker = useStore((s) => s.repoPicker);
  const previewOpen = useStore((s) => Boolean(s.preview));
  const comparisonOpen = useStore((s) => Boolean(s.comparison));
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryTab, setLibraryTab] = useState<'assistants' | 'prompts' | 'tools' | 'tasks' | 'knowledge'>('assistants');
  const accountId = useStore(s => s.user?.uid);
  useEffect(()=>useStore.subscribe((next,previous)=>{if(next.user?.uid!==previous.user?.uid||next.keys.gemini!==previous.keys.gemini||next.settings.privacyShield!==previous.settings.privacyShield||next.settings.privacyMode!==previous.settings.privacyMode)cancelKnowledge()}),[]);
  useEffect(() => { setLibraryOpen(false); setCommandPaletteOpen(false); }, [accountId]);
  useEffect(() => {
    const open = (event: Event) => { const requested=(event as CustomEvent).detail; setLibraryTab(requested === 'knowledge' ? 'knowledge' : requested === 'tasks' ? 'tasks' : requested === 'tools' ? 'tools' : 'assistants'); setUi({ sidebarOpen: false }); setLibraryOpen(true); };
    window.addEventListener('mr:library', open);
    const help = () => setShortcutsOpen(true);
    window.addEventListener('mr:shortcuts', help);
    return () => { window.removeEventListener('mr:library', open); window.removeEventListener('mr:shortcuts', help); };
  }, [setUi]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('mr.sidebarCollapsed') === 'true');
  const toggleSidebar = () => setSidebarCollapsed((collapsed) => {
    localStorage.setItem('mr.sidebarCollapsed', String(!collapsed));
    return !collapsed;
  });

  useEffect(() => {
    void init();
  }, [init]);

  // Keep the phone awake while a reply is being written, so locking the screen doesn't cut it off.
  const working = useStore((s) => s.streamingChatId !== null || s.compactingChatId !== null || s.comparing || s.canvasEditingChatId !== null);
  useEffect(() => {
    keepScreenAwake(working);
    return () => keepScreenAwake(false);
  }, [working]);

  useEffect(() => {
    if (authed) return installSidebarGestures();
  }, [authed]);

  // A tapped task notification opens that task's chat (once the chats have loaded).
  useEffect(() => {
    if (!authed) return;
    let stopWaiting = () => {};
    const cleanup = listenForNotificationTaps((id) => {
      const tryOpen = () => { const s = useStore.getState(); if (!s.chats.some((c) => c.id === id)) return false; s.selectChat(id); return true; };
      if (tryOpen()) return;
      stopWaiting();
      const unsub = useStore.subscribe(() => { if (tryOpen()) unsub(); });
      const timer = setTimeout(unsub, 15_000);
      stopWaiting = () => { unsub(); clearTimeout(timer); };
    });
    return () => { cleanup(); stopWaiting(); };
  }, [authed]);

  // Weekly quiet model check, once the app has settled (not in the test setup, which counts requests).
  const hasCatalog = useStore((s) => Boolean(s.catalog?.models.length));
  useEffect(() => {
    if (!authed || !hasCatalog || (/[?&]emulator\b/.test(location.search) && !(window as { __mrBackgroundCheck?: boolean }).__mrBackgroundCheck)) return;
    const timer = setTimeout(() => void useStore.getState().backgroundModelCheck(), (window as { __mrBackgroundCheckDelay?: number }).__mrBackgroundCheckDelay ?? 30_000);
    return () => clearTimeout(timer);
  }, [authed, hasCatalog]);

  // Global shortcuts (see src/lib/shortcuts.ts and the cheat sheet). Esc closes the palette or the phone menu,
  // otherwise stops a reply.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      if (commandPaletteOpen && e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        setCommandPaletteOpen(false);
        return;
      }
      if (e.key === 'Escape') {
        if (s.sidebarOpen && !s.settingsOpen && !document.querySelector('.modal-backdrop, .sheet-backdrop, .models-pop, .usage-pop')) s.setUi({ sidebarOpen: false });
        else if (s.streamingChatId && !s.preview && !s.runner && !s.settingsOpen) s.stop();
        return;
      }
      const shortcut = matchShortcut(e);
      if (!shortcut) return;
      e.preventDefault();
      const chat = s.chats.find((c) => c.id === s.currentId);
      if (shortcut === 'new-chat') s.newChat();
      else if (shortcut === 'palette') setCommandPaletteOpen(true);
      else if (shortcut === 'help') setShortcutsOpen(true);
      else if (shortcut === 'settings') s.setUi({ settingsOpen: true, sidebarOpen: false });
      else if (shortcut === 'library') window.dispatchEvent(new Event('mr:library'));
      else if (shortcut === 'sidebar') { if (window.matchMedia('(max-width: 899px)').matches) s.setUi({ sidebarOpen: !s.sidebarOpen }); else toggleSidebar(); }
      else if (shortcut === 'focus') document.querySelector<HTMLTextAreaElement>('.composer textarea')?.focus();
      else if (shortcut === 'copy-last') {
        const last = chat?.messages.filter((m) => m.role === 'assistant' && m.text).at(-1);
        if (!last) s.toast('No reply to copy yet.', 'info');
        else void copyText(last.text).then((ok) => s.toast(ok ? 'Copied the last reply' : 'Couldn’t copy', ok ? 'success' : 'error'));
      } else if (shortcut === 'delete-chat' && chat?.messages.length && confirm(`Delete "${chat.title}"?`)) void s.deleteChat(chat.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setUi, commandPaletteOpen]);

  if (authed === null) return <div className="splash" aria-busy="true" />;
  if (!authed) {
    return (
      <>
        <Login />
        <Toasts />
        <UpdateBar />
      </>
    );
  }
  if (accessDenied) return <NotInvited email={accessDenied} />;
  return (
    <div className={`app${settingsOpen ? ' settings-open' : ''}${workspaceOpen ? ' workspace-open' : ''}${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <TaskEngine />
      <a className="skip-link" href="#message-input">Skip to message</a>
      <Sidebar onCollapse={toggleSidebar} />
      <div className={`scrim${sidebarOpen ? ' visible' : ''}`} aria-hidden="true" onClick={() => setUi({ sidebarOpen: false })} />
      <ChatView onExpandSidebar={toggleSidebar} />
      {!settingsOpen && <WorkspacePanel />}
      {!settingsOpen && canvasOpen && <Suspense fallback={null}><CanvasPanel /></Suspense>}
      {settingsOpen && <Suspense fallback={null}><SettingsModal /></Suspense>}
      {commandPaletteOpen && <Suspense fallback={null}><CommandPalette onClose={() => setCommandPaletteOpen(false)} /></Suspense>}
      {libraryOpen && <Suspense fallback={null}><AssistantLibrary key={accountId} initialTab={libraryTab} onClose={() => setLibraryOpen(false)} /></Suspense>}
      {comparisonOpen && <Suspense fallback={null}><ComparisonResultsModal /></Suspense>}
      {shortcutsOpen && <Suspense fallback={null}><ShortcutsModal onClose={() => setShortcutsOpen(false)} /></Suspense>}
      {repoPicker && <Suspense fallback={null}><RepoPicker onClose={() => setUi({ repoPicker: false })} /></Suspense>}
      {previewOpen && <Suspense fallback={null}><PreviewModal /></Suspense>}
      {exportChatId && <Suspense fallback={null}><ChatExportModal /></Suspense>}
      {runner && (
        <Suspense fallback={null}>
          <RunPanel />
        </Suspense>
      )}
      <Toasts />
      <UpdateBar />
    </div>
  );
}
