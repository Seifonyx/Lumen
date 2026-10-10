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

const RunPanel = lazy(() => import('./components/RunPanel'));

export default function App() {
  const authed = useStore((s) => s.authed);
  const init = useStore((s) => s.init);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setUi = useStore((s) => s.setUi);
  const accessDenied = useStore((s) => s.accessDenied);
  const settingsOpen = useStore((s) => s.settingsOpen);
  const workspaceOpen = useStore((s) => s.workspaceOpen);
  const runner = useStore((s) => s.runner);
  const repoPicker = useStore((s) => s.repoPicker);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  useEffect(() => {
    void init();
  }, [init]);

  // Keep the phone awake while a reply is being written, so locking the screen doesn't cut it off.
  const working = useStore((s) => s.streamingChatId !== null || s.compactingChatId !== null || s.comparing);
  useEffect(() => {
    keepScreenAwake(working);
    return () => keepScreenAwake(false);
  }, [working]);

  // Global shortcuts: Ctrl/Cmd+Shift+O new chat, Ctrl/Cmd+K command palette, Esc stop/close.
  useEffect(() => {
    const onSwipeEdge = () => {
      setUi({ sidebarOpen: true });
    };
    window.addEventListener('model-router:swipe-edge', onSwipeEdge);
    return () => window.removeEventListener('model-router:swipe-edge', onSwipeEdge);
  }, [setUi]);

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
    <div className={`app${settingsOpen ? ' settings-open' : ''}${workspaceOpen ? ' workspace-open' : ''}`}>
      <Sidebar />
      {sidebarOpen && <div className="scrim" onClick={() => setUi({ sidebarOpen: false })} />}
      <ChatView />
      {!settingsOpen && <WorkspacePanel />}
      <SettingsModal />
      {commandPaletteOpen && <CommandPalette onClose={() => setCommandPaletteOpen(false)} />}
      <ComparisonResultsModal />
      {repoPicker && <RepoPicker onClose={() => setUi({ repoPicker: false })} />}
      <PreviewModal />
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
