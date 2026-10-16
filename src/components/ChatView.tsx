import { flySent, motionOff } from '../lib/motion';
import { watchGlassInsets } from '../lib/glass';
import { FolderGit2, FolderKanban, ArrowDown, FileText, Menu, PanelLeftOpen, EyeOff } from 'lucide-react';
import WelcomeStars from './WelcomeStars';
import { modKey } from '../lib/util';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { isTemporaryChat } from '../lib/temporary-chat';
import { activeSummary } from '../lib/compact';
import { AUTO } from '../lib/routing';
import { isLayoutId } from '../lib/layouts';
import { formatUntil } from '../lib/usage';
import { modelLabel, selectCurrentChat, useStore } from '../store';
import { UsageMeter } from './CompactNote';
import Composer from './Composer';
import { WELCOME_GREETINGS } from '../lib/welcome';
import MessageThread from './MessageThread';
import ModelPicker from './ModelPicker';
import ProjectManager from './ProjectManager';
import ProjectWorkspace from './ProjectWorkspace';

/** How far from the latest message you were in each chat (this session), to come back to the same spot. */
type Anchor = { id: string; offset: number };
let restoredTo = -1;
const positions = new Map<string, Anchor | null>();
/** The message at the top of the view and how far its top is from the view's top. */
function topAnchor(el: HTMLElement): Anchor | null {
  const top = el.getBoundingClientRect().top;
  for (const row of el.querySelectorAll<HTMLElement>('[data-message-id]')) {
    const r = row.getBoundingClientRect();
    if (r.bottom > top + 1) return { id: row.dataset.messageId!, offset: r.top - top };
  }
  return null;
}
/** Scroll so that message is back where it was; false if it isn't on the page (yet). */
function restoreAnchor(el: HTMLElement, a: Anchor) {
  const row = el.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(a.id)}"]`);
  if (!row) return false;
  el.scrollTop += row.getBoundingClientRect().top - el.getBoundingClientRect().top - a.offset;
  restoredTo = el.scrollTop;
  return true;
}

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
  const catalog = useStore((s) => s.catalog);
  const enabledCount = useStore((s) => s.settings.enabledModels.length);
  const { setUi, setChatModel } = useStore.getState();
  const scroller = useRef<HTMLDivElement>(null);
  const navigationHost = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [showDown, setShowDown] = useState(false);
  // A reply that's being written or just finished below where you're reading.
  const [unseen, setUnseen] = useState(false);
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

  // Switching chats: back where you were in that chat (this session), otherwise on the latest message.
  const hold = useRef<Anchor | null>(null);
  useLayoutEffect(() => {
    const el = scroller.current;
    hold.current = (chat && positions.get(chat.id)) || null;
    stick.current = hold.current === null;
    if (!el) return;
    // (Older messages fill in over the next frames; until the remembered one is there, start from the top.)
    if (hold.current) { if (!restoreAnchor(el, hold.current)) { el.scrollTop = 0; restoredTo = 0; } }
    else el.scrollTop = el.scrollHeight;
  }, [chat?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (streaming && !stick.current) setUnseen(true); }, [lastText, streaming]);
  // While a reply streams, the page knows (the iPhone glass look draws lighter then, so text arrives smoothly).
  useEffect(() => {
    document.documentElement.classList.toggle('streaming', streaming);
    return () => document.documentElement.classList.remove('streaming');
  }, [streaming]);
  // iPhone glass look: the chat scrolls under the floating bars.
  useEffect(() => watchGlassInsets(scroller.current?.closest('.main') as HTMLElement | null), [projectWorkspaceOpen, chat?.id]);
  useEffect(() => setUnseen(false), [chat?.id]);

  // While a reply streams, the view glides after the new text instead of jumping down a line at a time.
  const glide = useRef({ frame: 0, ours: -1 });
  const toBottom = (el: HTMLElement, smooth: boolean) => {
    if (!smooth || motionOff()) { cancelAnimationFrame(glide.current.frame); glide.current.frame = 0; el.scrollTop = el.scrollHeight; return; }
    if (glide.current.frame) return;
    const step = () => {
      const target = el.scrollHeight - el.clientHeight, d = target - el.scrollTop;
      if (d <= 0.5 || !stick.current) { glide.current.frame = 0; return; }
      el.scrollTop += Math.max(1, d * 0.2);
      glide.current.ours = el.scrollTop;
      glide.current.frame = requestAnimationFrame(step);
    };
    glide.current.frame = requestAnimationFrame(step);
  };
  useEffect(() => () => cancelAnimationFrame(glide.current.frame), []);

  // Follow streaming text while the user is at the bottom; sending a message always brings you to it.
  const lastRole = messages.at(-1)?.role;
  const seenLength = useRef(messages.length);
  useLayoutEffect(() => {
    const el = scroller.current;
    const added = messages.length > seenLength.current ? messages.slice(seenLength.current) : [];
    if (messages.length > seenLength.current && lastRole === 'user') stick.current = true;
    seenLength.current = messages.length;
    if (el && stick.current) toBottom(el, streaming && !added.length);
    const sent = added.findLast((m) => m.role === 'user');
    if (sent) flySent(el?.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(sent.id)}"] .bubble`));
  }, [messages.length, lastText, lastRole]);

  // Content that settles after the first paint (older messages, code colouring, images) keeps the view on
  // the latest message instead of leaving it just above.
  useEffect(() => {
    const el = scroller.current;
    const content = el?.querySelector('.thread') ?? el?.firstElementChild;
    if (!el || !content) return;
    // (While older messages fill in above a remembered spot, it stays put.)
    const observer = new ResizeObserver(() => { if (stick.current) toBottom(el, useStore.getState().streamingChatId === chat?.id); else if (hold.current) restoreAnchor(el, hold.current); });
    observer.observe(content);
    return () => observer.disconnect();
  }, [chat?.id, empty]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onScroll = () => {
      const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
      // (The glide's own steps don't count as you scrolling away, even while it's catching up.)
      const gliding = glide.current.frame && Math.abs(el.scrollTop - glide.current.ours) < 2;
      stick.current = gap < 80 || Boolean(gliding);
      // Your own scrolling takes over from a remembered spot; where you are is saved once you stop.
      if (hold.current && Math.abs(el.scrollTop - restoredTo) > 1) hold.current = null;
      clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => { if (chat) positions.set(chat.id, stick.current ? null : topAnchor(el)); }, 150);
      setShowDown(gap > 400);
      // The top bar gets a soft edge once the conversation scrolls under it.
      el.closest('.main')?.querySelector('.topbar')?.classList.toggle('scrolled', el.scrollTop > 6);
      if (gap < 80) setUnseen(false);
    };
    let saveTimer = 0;
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { clearTimeout(saveTimer); el.removeEventListener('scroll', onScroll); };
  }, [chat?.id, projectWorkspaceOpen, empty]);

  if (currentProject && projectWorkspaceOpen) {
    return (
      <main className="main project-workspace-main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setUi({ sidebarOpen: true })} aria-label="Open chats">
            <Menu size={20} />
          </button>
          <button className="icon-btn expand-sidebar" onClick={onExpandSidebar} aria-label="Expand sidebar" title={`Expand sidebar (${modKey}⇧S)`}>
            <PanelLeftOpen size={20} />
          </button>
          <button type="button" className="chat-heading project-crumb" onClick={() => setUi({ page: 'projects' })} title="All projects">Projects</button>
          <span className="project-crumb-sep" aria-hidden="true">/</span>
          <span className="project-crumb-name">{currentProject.name}</span>
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
        <button className="icon-btn expand-sidebar" onClick={onExpandSidebar} aria-label="Expand sidebar" title={`Expand sidebar (${modKey}⇧S)`}>
          <PanelLeftOpen size={20} />
        </button>
        <div className="topbar-center">
        {empty ? (
          <span className="topbar-route welcome-route" title={isTemporaryChat(chat) ? 'Incognito: not saved, memory off' : model === AUTO ? 'Auto picks the best model for each message' : undefined}>
            <span className={`route-dot${isTemporaryChat(chat) ? ' off' : ''}`} aria-hidden="true" />
            {isTemporaryChat(chat) ? <><b>Incognito</b><span className="route-sep">·</span>not saved</> : model === AUTO ? <><b>Auto</b><span className="route-sep">·</span>{enabledCount} model{enabledCount === 1 ? '' : 's'}</> : <><span className="route-label-muted">Routing to</span><b>{modelLabel(catalog, model)}</b></>}
          </span>
        ) : <span className="chat-heading" title={chat?.title}>{chat?.title || 'Chat'}</span>}
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
        </div>
        <div className="spacer" />
        <div className="topbar-trailing">
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
        {(empty || isTemporaryChat(chat)) && (
          <button className="icon-btn new-chat-shortcut" onClick={()=>useStore.getState().toggleTemporaryChat()} aria-label={isTemporaryChat(chat)?'End incognito chat':'Start incognito chat'} aria-pressed={isTemporaryChat(chat)} title="Incognito · not saved, memory off. Your AI provider still receives messages.">
          <EyeOff size={19} />
        </button>
        )}
        </div>
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
            <span className="welcome-mark" aria-hidden="true"><WelcomeStars /></span>
            <h1>{isTemporaryChat(chat)?'Incognito chat':user?.name&&welcomeSequence%(WELCOME_GREETINGS.length+1)===0?greeting:WELCOME_GREETINGS[(welcomeSequence+(user?.name?WELCOME_GREETINGS.length-1:0)) % WELCOME_GREETINGS.length]}</h1>
          </div>
        ) : (
          chat && <MessageThread key={chat.id} chat={chat} summary={summary} busy={streaming||canvasEditing} compacting={compacting} scroller={scroller} stick={stick} navigationHost={navigationHost}/>
        )}
      </div>
      <div className="message-navigation-host" ref={navigationHost} />
      </div>

      {(showDown || unseen) && (
        <button
          className={`to-bottom${unseen ? ' labelled' : ''}`}
          aria-label={unseen ? (streaming ? 'Reply being written, scroll to it' : 'New reply, scroll to it') : 'Scroll to latest'}
          onClick={() => {
            const el = scroller.current;
            if (!el) return;
            stick.current = true;
            setUnseen(false);
            // From far up, jump to the last screenful first, then glide the rest (like tapping the top of an iPhone).
            const end = el.scrollHeight - el.clientHeight;
            if (end - el.scrollTop > el.clientHeight * 1.5 && !motionOff()) el.scrollTop = end - el.clientHeight * 1.2;
            el.scrollTo({ top: end, behavior: motionOff() ? 'auto' : 'smooth' });
          }}
        >
          {unseen && <span>{streaming ? 'Writing…' : 'New reply'}</span>}
          <ArrowDown size={18} />
        </button>
      )}

      <Composer
        model={model}
        modelPicker={<ModelPicker value={model} onChange={setChatModel} opensUp />}
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
