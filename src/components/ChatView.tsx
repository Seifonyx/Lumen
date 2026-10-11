import { FolderGit2, FolderKanban, GitBranch, ArrowDown, FileSpreadsheet, FileText, Menu, PanelLeftOpen, ScrollText, SquarePen } from 'lucide-react';
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { activeSummary } from '../lib/compact';
import { AUTO } from '../lib/routing';
import { isLayoutId } from '../lib/layouts';
import { formatUntil } from '../lib/usage';
import { selectCurrentChat, useStore } from '../store';
import { CompactingNote, CompactNote, UsageMeter } from './CompactNote';
import Composer, { prefillComposer } from './Composer';
import InstallHint from './InstallHint';
import MessageItem from './MessageItem';
import ModelPicker from './ModelPicker';

const SUGGESTIONS = [
  { icon: FileSpreadsheet, title: 'Build an Excel tracker', prompt: 'Create an Excel workbook to track ' },
  { icon: FileText, title: 'Write a Word report', prompt: 'Write a well-formatted Word report about ' },
  { icon: ScrollText, title: 'Summarize a file', prompt: 'Summarize the attached file in clear bullet points, then list the key numbers.' },
];

export default function ChatView({ onExpandSidebar }: { onExpandSidebar: () => void }) {
  const chat = useStore(selectCurrentChat);
  const catalogError = useStore((s) => s.catalogError);
  const streaming = useStore((s) => s.streamingChatId !== null && s.streamingChatId === s.currentId);
  const canvasEditing = useStore(s => s.canvasEditingChatId !== null);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const projects = useStore((s) => s.settings.projects) || [];
  const project = projects.find((p) => p.id === (chat ? chat.projectId : activeProjectId));
  const defaultModel = project?.defaultModel || useStore((s) => s.settings.defaultModel);
  const compacting = useStore((s) => s.compactingChatId !== null && s.compactingChatId === s.currentId);
  const syncPaused = useStore((s) => s.firebaseUsage.level === 'paused' && s.authed === true);
  const resetAt = useStore((s) => s.firebaseUsage.resetAt);
  const online = useStore((s) => s.online);
  const workspaceOpen = useStore((s) => s.workspaceOpen);
  const { setUi, newChat, setChatModel, openProjectManager } = useStore.getState();
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [showDown, setShowDown] = useState(false);

  const model = chat?.model && (chat.model === AUTO || isLayoutId(chat.model) || useStore.getState().settings.enabledModels.includes(chat.model)) ? chat.model : defaultModel;
  const messages = chat?.messages || [];
  const changeCount = Object.keys(chat?.changes || {}).length;
  const summary = chat ? activeSummary(chat) : null;
  const empty = messages.length === 0 && !summary && !chat?.repo;
  const lastText = messages.length ? messages[messages.length - 1].text.length + (messages[messages.length - 1].thinking?.length || 0) : 0;

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
  }, []);

  return (
    <main className={`main${empty ? ' is-empty' : ''}`}>
      <header className="topbar">
        <button className="icon-btn menu-btn" onClick={() => setUi({ sidebarOpen: true })} aria-label="Open chats">
          <Menu size={20} />
        </button>
        <button className="icon-btn expand-sidebar" onClick={onExpandSidebar} aria-label="Expand sidebar" title="Expand sidebar">
          <PanelLeftOpen size={20} />
        </button>
        <ModelPicker value={model} onChange={setChatModel} />
        <div className="spacer" />
        {project && (
          <button
            type="button"
            className="project-topbar-pill"
            onClick={() => openProjectManager(project.id)}
            title={`Project: ${project.name} · Click to configure`}
            aria-label={`Project: ${project.name}`}
          >
            <FolderKanban size={14} />
            <span className="project-topbar-name">{project.name}</span>
            {Boolean(project.files?.length) && <span className="project-topbar-count">{project.files.length}</span>}
          </button>
        )}
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
        <button className="icon-btn new-chat-shortcut" onClick={newChat} aria-label="New chat" title="New chat (Ctrl+Shift+O)">
          <SquarePen size={18} />
        </button>
      </header>

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

      <div className="messages" ref={scroller}>
        {empty ? (
          <div className="empty">
            {project ? (
              <div className="project-landing">
                <div className="project-landing-header">
                  <div className="project-landing-icon">
                    <FolderKanban size={26} />
                  </div>
                  <div className="project-landing-meta">
                    <span className="welcome-eyebrow">Project workspace</span>
                    <h1>{project.name}</h1>
                  </div>
                </div>
                {project.instructions && (
                  <div className="project-landing-instructions">
                    <span className="project-landing-label">Instructions</span>
                    <p className="project-instructions-text">{project.instructions}</p>
                  </div>
                )}
                <div className="project-landing-knowledge">
                  <div className="project-knowledge-head">
                    <span className="project-landing-label">Project knowledge</span>
                    <span className="badge-pill">{project.files?.length || 0} / 5 files</span>
                  </div>
                  {project.files && project.files.length > 0 ? (
                    <div className="project-knowledge-chips">
                      {project.files.map((f) => (
                        <div key={f.id || f.name} className="project-knowledge-chip" title={f.name}>
                          <FileText size={14} />
                          <span>{f.name}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted small">No reference files yet. Upload reference documents or style guides to ground conversations.</p>
                  )}
                  <div className="project-landing-actions">
                    <button type="button" className="btn small" onClick={() => openProjectManager(project.id)}>
                      <FolderKanban size={14} /> Manage project & files
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <span className="welcome-eyebrow">Your space to think and create</span>
                <h1>What would you like to create?</h1>
                <p className="muted">Ask a question, explore an idea, or work with your files.</p>
              </>
            )}
          </div>
        ) : (
          <div className="thread">
            {summary?.upTo === null && <CompactNote chat={chat!} summary={summary} />}
            {messages.map((m, i) => (
              <Fragment key={m.id}>
                <MessageItem message={m} isLast={i === messages.length - 1} busy={streaming || canvasEditing} />
                {summary?.upTo === m.id && <CompactNote chat={chat!} summary={summary} />}
              </Fragment>
            ))}
            {compacting && <CompactingNote />}
          </div>
        )}
      </div>

      {showDown && (
        <button
          className="to-bottom"
          aria-label="Scroll to latest"
          onClick={() => {
            stick.current = true;
            scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
          }}
        >
          <ArrowDown size={18} />
        </button>
      )}

      <Composer
        model={model}
        meter={chat && (messages.length > 0 || summary) ? <UsageMeter chat={chat} model={model} /> : null}
        starterActions={empty ? (
          <>
            <div className="suggestions" aria-label="Ideas to get started">
              {project ? (
                <>
                  <button className="suggestion" onClick={() => prefillComposer(`Summarize the key information and goals of ${project.name} based on the attached files and instructions.`)}>
                    <ScrollText size={18} />
                    <span>Summarize project</span>
                  </button>
                  <button className="suggestion" onClick={() => prefillComposer(`What are the key points in the reference files of this project, and how should we proceed?`)}>
                    <FileText size={18} />
                    <span>Review knowledge files</span>
                  </button>
                  <button className="suggestion" onClick={() => prefillComposer(`Help me plan the next tasks and milestones for ${project.name}.`)}>
                    <FileSpreadsheet size={18} />
                    <span>Plan next tasks</span>
                  </button>
                </>
              ) : (
                <>
                  <button className="suggestion" onClick={() => setUi({ repoPicker: true })}>
                    <GitBranch size={18} />
                    <span>Code on a GitHub repo</span>
                  </button>
                  {SUGGESTIONS.map(({ icon: Icon, title, prompt }) => (
                    <button key={title} className="suggestion" onClick={() => prefillComposer(prompt)}>
                      <Icon size={18} />
                      <span>{title}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
            {!project && <InstallHint />}
          </>
        ) : undefined}
      />
    </main>
  );
}
