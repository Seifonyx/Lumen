import { lazy, Suspense, useEffect, useState } from 'react';
import ChatView from './components/ChatView';
import Login from './components/Login';
import NotInvited from './components/NotInvited';
import PreviewModal from './components/PreviewModal';
import SettingsModal from './components/SettingsModal';
import Sidebar from './components/Sidebar';
import Toasts from './components/Toasts';
import UpdateBar from './components/UpdateBar';
import WorkspacePanel from './components/WorkspacePanel';
import RepoPicker from './components/RepoPicker';
import CommandPalette from './components/CommandPalette';
import ComparisonResultsModal from './components/ComparisonResultsModal';
import { useStore } from './store';
import { keepScreenAwake } from './lib/wakelock';
import { installSidebarGestures } from './lib/sidebar-gesture';

const RunPanel = lazy(() => import('./components/RunPanel'));
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
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryTab, setLibraryTab] = useState<'assistants' | 'prompts' | 'tools'>('assistants');
  const accountId = useStore(s => s.user?.uid);
  useEffect(() => {
    const open = (event: Event) => { setLibraryTab((event as CustomEvent).detail === 'tools' ? 'tools' : 'assistants'); setUi({ sidebarOpen: false }); setLibraryOpen(true); };
    window.addEventListener('mr:library', open);
    return () => window.removeEventListener('mr:library', open);
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

  // Global shortcuts: Ctrl/Cmd+Shift+O new chat, Ctrl/Cmd+K command palette, Esc stop/close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const s = useStore.getState();
      if (commandPaletteOpen && e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        setCommandPaletteOpen(false);
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        s.newChat();
      } else if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      } else if (e.key === 'Escape' && s.sidebarOpen && !s.settingsOpen && !document.querySelector('.modal-backdrop, .sheet-backdrop, .models-pop, .usage-pop')) {
        s.setUi({ sidebarOpen: false });
      } else if (e.key === 'Escape' && s.streamingChatId && !s.preview && !s.runner && !s.settingsOpen && !commandPaletteOpen) {
        s.stop();
      }
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
      <Sidebar onCollapse={toggleSidebar} onOpenLibrary={() => setLibraryOpen(true)} />
      <div className={`scrim${sidebarOpen ? ' visible' : ''}`} aria-hidden="true" onClick={() => setUi({ sidebarOpen: false })} />
      <ChatView onExpandSidebar={toggleSidebar} />
      {!settingsOpen && <WorkspacePanel />}
      {!settingsOpen && canvasOpen && <Suspense fallback={null}><CanvasPanel /></Suspense>}
      <SettingsModal />
      {commandPaletteOpen && <CommandPalette onClose={() => setCommandPaletteOpen(false)} />}
      {libraryOpen && <Suspense fallback={null}><AssistantLibrary key={accountId} initialTab={libraryTab} onClose={() => setLibraryOpen(false)} /></Suspense>}
      <ComparisonResultsModal />
      {repoPicker && <RepoPicker onClose={() => setUi({ repoPicker: false })} />}
      <PreviewModal />
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
