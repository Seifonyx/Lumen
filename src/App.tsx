import { useEffect } from 'react';
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
import { useStore } from './store';

export default function App() {
  const authed = useStore((s) => s.authed);
  const init = useStore((s) => s.init);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setUi = useStore((s) => s.setUi);
  const accessDenied = useStore((s) => s.accessDenied);
  const settingsOpen = useStore((s) => s.settingsOpen);
  const workspaceOpen = useStore((s) => s.workspaceOpen);
  const repoPicker = useStore((s) => s.repoPicker);
  const user = useStore((s) => s.user);

  useEffect(() => {
    void init();
  }, [init]);

  // Listen for a right-swipe from the left edge (dismissed on phones where the menu button may not exist).
  useEffect(() => {
    const onSwipe = () => setUi({ sidebarOpen: true });
    window.addEventListener('model-router:swipe-edge', onSwipe);
    return () => window.removeEventListener('model-router:swipe-edge', onSwipe);
  }, [setUi]);

  // Global shortcuts: Ctrl/Cmd+Shift+O new chat, Ctrl/Cmd+K focus search, Esc stop/close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const s = useStore.getState();
      if (mod && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        s.newChat();
      } else if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setUi({ sidebarOpen: true });
        setTimeout(() => document.getElementById('chat-search')?.focus(), 50);
      } else if (e.key === 'Escape' && s.streamingChatId && !s.preview && !s.settingsOpen) {
        s.stop();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setUi]);

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
      {repoPicker && <RepoPicker onClose={() => setUi({ repoPicker: false })} />}
      <PreviewModal />
      <Toasts />
      <UpdateBar />
    </div>
  );
}