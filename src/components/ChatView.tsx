import { FolderGit2, FolderKanban, ArrowDown, FileText, Menu, PanelLeftOpen, Ghost, Sparkles } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { isTemporaryChat } from '../lib/temporary-chat';
import { activeSummary } from '../lib/compact';
import { AUTO } from '../lib/routing';
import { isLayoutId } from '../lib/layouts';
import { formatUntil } from '../lib/usage';
import { selectCurrentChat, useStore } from '../store';
import { UsageMeter } from './CompactNote';
import Composer from './Composer';
import { WELCOME_GREETINGS } from '../lib/welcome';
import MessageThread from './MessageThread';
import ModelPicker from './ModelPicker';
import ProjectManager from './ProjectManager';
import ProjectWorkspace from './ProjectWorkspace';

export default function ChatView({ onExpandSidebar }: { onExpandSidebar: () => void }) {
  const user=useStore(s=>s.user);
  const hour=new Date().getHours();
  const greeting=`${hour<12?'Morning':hour<18?'Afternoon':'Evening'}${user?.name?', '+user.name.split(' ')[0].slice(0,20):''}`;
  const welcomeSequence = useStore(s => s.welcomeSequence);
  const chat = useStore(selectCurrentChat);
  const catalogError = useStore((s) => s.catalogError);
  const streaming = useStore((s) => s.streamingChatId !== null && s.streamingChatId === s.currentId);
  const canvasEditing = useStore(s => s.canvasEditingChatId !== null);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const projects = useStore((s) => s.settings.projects) || [];
  const projectWorkspaceOpen = useStore((s) => s.projectWorkspaceOpen);
  const currentProject = projects.find((p) => p.id === (projectWorkspaceOpen ? activeProjectId : chat ? chat.projectId : activeProjectId));
  const defaultModel = useStore((s) => currentProject?.defaultModel || s.settings.defaultModel);
  const compacting = useStore((s) => s.compactingChatId !== null && s.compactingChatId === s.currentId);
  const syncPaused = useStore((s) => s.firebaseUsage.level === 'paused' && s.authed === true);
  const resetAt = useStore((s) => s.firebaseUsage.resetAt);
  const online = useStore((s) => s.online);
  const workspaceOpen = useStore((s) => s.workspaceOpen);
  const { setUi, setChatModel } = useStore.getState();
  const scroller = useRef<HTMLDivElement>(null);
  const navigationHost = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [showDown, setShowDown] = useState(false);
  const [projectModalId, setProjectModalId] = useState<string | null>(null);
  const [announcement,setAnnouncement]=useState('');
  const previousReply=useRef<{id?:string;streaming:boolean}>({streaming:false});

  const model = chat?.model && (chat.model === AUTO || isLayoutId(chat.model) || useStore.getState().settings.enabledModels.includes(chat.model)) ? chat.model : defaultModel;
  const messages = chat?.messages || [];
  const changeCount = Object.keys(chat?.changes || {}).length;
  const summary = chat ? activeSummary(chat) : null;
  const empty = messages.length === 0 && !summary && !chat?.repo;
  const lastText = messages.length ? messages[messages.length - 1].text.length + (messages[messages.length - 1].thinking?.length || 0) : 0;
  useEffect(()=>{
    const previous=previousReply.current;
    if(previous.id!==chat?.id)setAnnouncement('');
    else if(!previous.streaming && streaming)setAnnouncement('Reply started.');
    else if(previous.streaming && !streaming)setAnnouncement(messages.at(-1)?.status==='stopped'?'Reply stopped.':messages.at(-1)?.status==='error'?'Reply failed. Check the message for details.':'Reply complete.');
    previousReply.current={id:chat?.id,streaming};
  },[streaming,chat?.id,messages]);

  // Jump to the bottom when switching chats.
  useLayoutEffect(() => {
    stick.current = true;
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat?.id]);

  // Follow streaming text while the user is at the bottom.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages.length, lastText]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onScroll = () => {
      const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
      stick.current = gap < 80;
      setShowDown(gap > 400);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [chat?.id, projectWorkspaceOpen, empty]);

  if (currentProject && projectWorkspaceOpen) {
    return (
      <main className="main project-workspace-main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setUi({ sidebarOpen: true })} aria-label="Open chats">
            <Menu size={20} />
          </button>
          <button className="icon-btn expand-sidebar" onClick={onExpandSidebar} aria-label="Expand sidebar" title="Expand sidebar">
            <PanelLeftOpen size={20} />
          </button>
          <div className="project-topbar-pill static">
            <FolderKanban size={13} className={`color-${currentProject.color || 'indigo'}`} />
            <span className="project-topbar-name">{currentProject.name}</span>
            <span className="project-topbar-badge">Workspace</span>
          </div>
          <div className="spacer" />
          <button className="icon-btn new-chat-shortcut" onClick={()=>useStore.getState().toggleTemporaryChat()} aria-label={isTemporaryChat(chat)?'End incognito chat':'Start incognito chat'} aria-pressed={isTemporaryChat(chat)} title="Incognito · not saved, memory off. Your AI provider still receives messages.">
            <Ghost size={22} />
          </button>
        </header>
        <ProjectWorkspace
          project={currentProject}
          onOpenSettings={() => setProjectModalId(currentProject.id)}
        />
        {projectModalId && (
          <ProjectManager
            initialProjectId={projectModalId}
            onClose={() => setProjectModalId(null)}
          />
        )}
      </main>
    );
  }

  return (
    <main className={`main${empty ? ' is-empty' : ''}`}>
      <header className="topbar">
        <button className="icon-btn menu-btn" onClick={() => setUi({ sidebarOpen: true })} aria-label="Open chats">
          <Menu size={20} />
        </button>
        <button className="icon-btn expand-sidebar" onClick={onExpandSidebar} aria-label="Expand sidebar" title="Expand sidebar">
          <PanelLeftOpen size={20} />
        </button>
        <span className="chat-heading" title={chat?.title}>{empty ? '' : chat?.title || 'Chat'}</span>
        {currentProject && (
          <button
            type="button"
            className="project-topbar-pill"
            onClick={() => useStore.getState().selectProject(currentProject.id)}
            title={`Project: ${currentProject.name} — Click to view Project Workspace`}
          >
            <FolderKanban size={13} className={`color-${currentProject.color || 'indigo'}`} />
            <span className="project-topbar-name">{currentProject.name}</span>
            {Boolean(currentProject.files?.length) && (
              <span className="project-topbar-badge">{currentProject.files!.length} doc{currentProject.files!.length === 1 ? '' : 's'}</span>
            )}
          </button>
        )}
        <div className="spacer" />
        {Boolean(chat?.documents?.length) && <button className="icon-btn" aria-label="Open canvas" title="Open canvas" onClick={() => useStore.getState().openCanvas()}><FileText size={18} /></button>}
        {chat?.assistant && <span className="assistant-badge" title={chat.assistant.description || chat.assistant.name}>{chat.assistant.name}</span>}
        {chat?.repo && (
          <button
            className={`icon-btn code-toggle${workspaceOpen ? ' on' : ''}`}
            onClick={() => setUi({ workspaceOpen: !workspaceOpen })}
            aria-label={workspaceOpen ? 'Hide repository' : 'Show repository'}
            title={`${chat.repo.owner}/${chat.repo.repo}`}
          >
            <FolderGit2 size={18} />
            {changeCount > 0 && <span className="badge">{changeCount}</span>}
          </button>
        )}
        <button className="icon-btn new-chat-shortcut" onClick={()=>useStore.getState().toggleTemporaryChat()} aria-label={isTemporaryChat(chat)?'End incognito chat':'Start incognito chat'} aria-pressed={isTemporaryChat(chat)} title="Incognito · not saved, memory off. Your AI provider still receives messages.">
          <Ghost size={22} />
        </button>
      </header>
      {isTemporaryChat(chat)&&<div className="incognito-note" role="status">Not saved · Memory off · Your selected AI provider receives messages</div>}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</div>

      {!online && (
        <div className="banner offline" role="status">
          You're offline. Your chats are all here; sending messages needs a connection.
        </div>
      )}

      {syncPaused && (
        <div className="banner info" role="status">
          Sync is paused to stay within Firebase's free daily limit. Chats are still saved on this device and will sync {formatUntil(resetAt)}.
        </div>
      )}

      {catalogError && (
        <div className="banner" role="alert" dir="auto">
          Some models couldn't be loaded: {catalogError}
        </div>
      )}

      <div className="conversation-area">
      <div className="messages" ref={scroller} role="region" tabIndex={0} aria-label="Chat messages">
        {empty ? (
          <div className="empty">
            <Sparkles className="welcome-mark" size={42} aria-hidden="true"/><h1>{isTemporaryChat(chat)?'Incognito chat':user?.name&&welcomeSequence%(WELCOME_GREETINGS.length+1)===0?greeting:WELCOME_GREETINGS[(welcomeSequence+(user?.name?WELCOME_GREETINGS.length-1:0)) % WELCOME_GREETINGS.length]}</h1>
          </div>
        ) : (
          chat && <MessageThread key={chat.id} chat={chat} summary={summary} busy={streaming||canvasEditing} compacting={compacting} scroller={scroller} stick={stick} navigationHost={navigationHost}/>
        )}
      </div>
      <div className="message-navigation-host" ref={navigationHost} />
      </div>

      {showDown && (
        <button
          className="to-bottom"
          aria-label="Scroll to latest"
          onClick={() => {
            stick.current = true;
            scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth' });
          }}
        >
          <ArrowDown size={18} />
        </button>
      )}

      <Composer
        model={model}
        modelPicker={<ModelPicker value={model} onChange={setChatModel} align="right" opensUp />}
        meter={chat && (messages.length > 0 || summary) ? <UsageMeter chat={chat} model={model} /> : null}
      />
      {projectModalId && (
        <ProjectManager
          initialProjectId={projectModalId}
          onClose={() => setProjectModalId(null)}
        />
      )}
    </main>
  );
}
