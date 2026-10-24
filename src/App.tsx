import { lazy, Suspense, useEffect, useState } from 'react';
import ChatView from './components/ChatView';
import Login from './components/Login';
import NotInvited from './components/NotInvited';
import Sidebar from './components/Sidebar';
import Toasts from './components/Toasts';
import AppSkeleton from './components/AppSkeleton';
import { ImageViewerHost } from './components/ImageViewer';
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
import { CANVAS_SHELL, CanvasNav, newGeneralChat, navigateBack, useScreenBackLayer, RoutingCenter } from './lib/canvas-presentation';
// CP05: the Canvas scope covers the whole document (pages and portalled dialogs/menus) while the shell switch is on;
// the ordinary build folds this away.
if (CANVAS_SHELL) { document.documentElement.setAttribute('data-lumen-canvas', ''); document.documentElement.setAttribute('data-lumen-canvas-foundation', ''); }

const RunPanel = lazy(() => import('./components/RunPanel'));
const ShortcutsModal = lazy(() => import('./components/ShortcutsModal'));
// Screens opened on demand load their code the first time they open.
const loadSettings = () => import('./components/SettingsModal');
const SettingsModal = lazy(loadSettings);
// Settings is opened often: fetch its code once the app is idle, so it slides in without waiting.
if (typeof window !== 'undefined') window.addEventListener('load', () => (window.requestIdleCallback || setTimeout)(() => void loadSettings()), { once: true });
const CommandPalette = lazy(() => import('./components/CommandPalette'));
const RepoPicker = lazy(() => import('./components/RepoPicker'));
const PreviewModal = lazy(() => import('./components/PreviewModal'));
const ComparisonResultsModal = lazy(() => import('./components/ComparisonResultsModal'));
const AssistantLibrary = lazy(() => import('./components/AssistantLibrary'));
const CanvasPanel = lazy(() => import('./components/CanvasPanel'));
const SideChat = lazy(() => import('./components/SideChat'));
const SelectionTools = lazy(() => import('./components/SelectionTools'));
const Study = lazy(() => import('./components/Study'));
const CollectionPage = lazy(() => import('./components/CollectionPage'));
const ProjectsPage = lazy(() => import('./components/ProjectsPage'));
const ToolsPage = lazy(() => import('./components/ToolsPage'));
const PromptsModal = lazy(() => import('./components/PromptsModal'));
const ToolsModal = lazy(() => import('./components/ToolsModal'));
const ChatExportModal = lazy(() => import('./components/ChatExportModal'));

const glassPhone = () => document.documentElement.classList.contains('glass') && window.matchMedia('(max-width: 899px)').matches;

/** Root presentation takes no account, transport or replacement-store props. */
export type AppProps = Record<string, never>;

export default function App() {
  const authed = useStore((s) => s.authed);
  const init = useStore((s) => s.init);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setUi = useStore((s) => s.setUi);
  const accessDenied = useStore((s) => s.accessDenied);
  const settingsOpen = useStore((s) => s.settingsOpen);
  const workspaceOpen = useStore((s) => s.workspaceOpen);
  const canvasOpen = useStore((s) => s.canvasOpen);
  const sideChatId = useStore((s) => s.sideChatId);
  const runner = useStore((s) => s.runner);
  const exportChatId = useStore((s) => s.exportChatId);
  const repoPicker = useStore((s) => s.repoPicker);
  const previewOpen = useStore((s) => Boolean(s.preview));
  const comparisonOpen = useStore((s) => Boolean(s.comparison));
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  // Assistants, Files and Study open as pages in place of the chat; Prompts and Tools as windows.
  const [prompts, setPrompts] = useState(false);
  const [tools, setTools] = useState<null | 'youtube' | 'calculation' | 'reader'>(null);
  if (CANVAS_SHELL) useScreenBackLayer!(Boolean(tools), () => setTools(null), () => setTools(tools), `tool:${tools}`);
  if (CANVAS_SHELL) useScreenBackLayer!(prompts, () => setPrompts(false), () => setPrompts(true), 'saved-prompts');
  const page = useStore((s) => s.page);
  const pageArg = useStore((s) => s.pageArg);
  useEffect(() => {
    const open = (e: Event) => { const from = (e as CustomEvent).detail; setUi({ page: 'study', pageArg: from && typeof from.chatId === 'string' ? from : undefined }); };
    window.addEventListener('mr-open-study', open);
    return () => window.removeEventListener('mr-open-study', open);
  }, [setUi]);
  const closePage = () => setUi({ page: null, pageArg: undefined });
  const accountId = useStore(s => s.user?.uid);
  useEffect(()=>useStore.subscribe((next,previous)=>{if(next.user?.uid!==previous.user?.uid||next.keys.gemini!==previous.keys.gemini||next.settings.privacyShield!==previous.settings.privacyShield||next.settings.privacyMode!==previous.settings.privacyMode)cancelKnowledge()}),[]);
  useEffect(() => { setUi({ page: null }); setCommandPaletteOpen(false); }, [accountId, setUi]);
  // Remembered so the next visit shows the app's frame before any code loads (index.html).
  useEffect(() => { try { if (authed) localStorage.setItem('mr.signedIn', '1'); else if (authed === false) localStorage.removeItem('mr.signedIn'); } catch { /* private mode */ } }, [authed]);
  useEffect(() => {
    // Where each kind of saved thing lives now (older shortcuts and links still ask for "the library").
    const open = (event: Event) => {
      const requested = String((event as CustomEvent).detail || 'assistants');
      if (requested === 'knowledge') setUi({ page: 'collection', pageArg: 'searchable' });
      else if (requested === 'documents') setUi({ page: 'collection', pageArg: 'documents' });
      else if (requested === 'collection') setUi({ page: 'collection', pageArg: 'all' });
      else if (requested === 'tools-page') setUi({ page: 'tools' });
      else if (requested === 'projects') setUi({ page: 'projects' });
      else if (requested === 'tasks') setUi({ settingsOpen: true, settingsTab: 'tasks' });
      else if (requested === 'prompts') { setUi({ sidebarOpen: false }); setPrompts(true); }
      else if (requested.startsWith('tools')) { setUi({ sidebarOpen: false }); setTools((requested.split(':')[1] as 'youtube') || 'youtube'); }
      else setUi({ page: 'assistants' });
    };
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
  // The sidebar's Lumen mark glows softly while a reply is being written (CSS: data-replying).
  useEffect(() => { document.documentElement.toggleAttribute('data-replying', working); }, [working]);
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
      if (shortcut === 'new-chat') { if (newGeneralChat) newGeneralChat(); else s.newChat(); }
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

  if (authed === null) return <AppSkeleton />;
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
    <div className={`app${settingsOpen ? ' settings-open' : ''}${page && !settingsOpen ? ' page-open' : ''}${workspaceOpen ? ' workspace-open' : ''}${sidebarCollapsed ? ' sidebar-collapsed' : ''}`} {...(CANVAS_SHELL ? { 'data-lumen-canvas-shell': '', 'data-lumen-canvas-foundation': '' } : undefined)}>
      <TaskEngine />
      <a className="skip-link" href="#message-input">Skip to message</a>
      <Sidebar onCollapse={toggleSidebar} />
      <div className={`scrim${sidebarOpen ? ' visible' : ''}`} aria-hidden="true" onClick={() => setUi({ sidebarOpen: false })} />
      {CANVAS_SHELL ? <>{CanvasNav && <CanvasNav collapsed={sidebarCollapsed} onExpand={toggleSidebar} />}<ChatView onExpandSidebar={toggleSidebar} />{RoutingCenter && <Suspense fallback={null}><RoutingCenter /></Suspense>}</> : <ChatView onExpandSidebar={toggleSidebar} />}
      {page && !settingsOpen && (
        <Suspense fallback={null}>
          {/* iPhone glass look: assistants live in Tools → Assistants (the separate Assistants page is computer-only). */}
          {page === 'assistants' && (CANVAS_SHELL || glassPhone()) ? <ToolsPage key={`${accountId}-tools-assistants-${String(pageArg || '')}`} initial="assistants" newAssistant={pageArg === 'new'} onClose={closePage} />
            : page === 'assistants' ? <AssistantLibrary key={`${accountId}-assistants-${String(pageArg || '')}`} startNew={pageArg === 'new'} onClose={closePage} />
            : page === 'collection' ? <CollectionPage key={`${accountId}-collection-${String(pageArg || '')}`} initial={typeof pageArg === 'string' ? pageArg as 'all' : 'all'} onClose={closePage} />
            : page === 'projects' ? <ProjectsPage key={`${accountId}-projects`} onClose={closePage} />
            : page === 'tools' ? <ToolsPage key={`${accountId}-tools`} onClose={closePage} />
            : <Study key={`${accountId}-study-${JSON.stringify(pageArg || '')}`} startFrom={typeof pageArg === 'object' ? pageArg : undefined} onClose={closePage} />}
        </Suspense>
      )}
      {!settingsOpen && <WorkspacePanel />}
      {!settingsOpen && canvasOpen && <Suspense fallback={null}><CanvasPanel /></Suspense>}
      {!settingsOpen && sideChatId && <Suspense fallback={null}><SideChat /></Suspense>}
      {settingsOpen && <Suspense fallback={null}><SettingsModal /></Suspense>}
      {commandPaletteOpen && <Suspense fallback={null}><CommandPalette onClose={() => setCommandPaletteOpen(false)} /></Suspense>}
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
      {prompts && <Suspense fallback={null}><PromptsModal onClose={CANVAS_SHELL ? () => navigateBack!(() => setPrompts(false)) : () => setPrompts(false)} /></Suspense>}
      {tools && <Suspense fallback={null}><ToolsModal initial={tools} onClose={CANVAS_SHELL ? () => navigateBack!(() => setTools(null)) : () => setTools(null)} /></Suspense>}
      <ImageViewerHost />
      <Suspense fallback={null}><SelectionTools /></Suspense>
      <Toasts />
      <UpdateBar />
    </div>
  );
}
