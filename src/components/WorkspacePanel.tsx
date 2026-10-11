import { AlertTriangle, Wrench } from 'lucide-react';
import { checkChanges, problemsMessage, type Problem } from '../lib/precommit';
import { ArrowLeft, Check, ChevronDown, ChevronRight, ExternalLink, File, FileDiff, Folder, GitBranch, GitCommitHorizontal, Loader2, MessageSquarePlus, RefreshCw, RotateCcw, Search, Unplug, X } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { lineStats } from '../lib/edits';
import type { TreeEntry } from '../lib/github';
import { currentFile, repoTree, suggestBranch } from '../lib/workspace';
import { selectCurrentChat, useStore } from '../store';
import type { Chat } from '../types';
import DiffView from './DiffView';
import PullReviewModal from './PullReviewModal';
import CommitUndoModal from './CommitUndoModal';

const CodeEditor = lazy(() => import('./CodeEditor'));

type Node = { name: string; path: string; dir: boolean; children: Node[] };

function buildTree(files: TreeEntry[]): Node[] {
  const root: Node = { name: '', path: '', dir: true, children: [] };
  for (const f of files) {
    const parts = f.path.split('/');
    let at = root;
    parts.forEach((part, i) => {
      const path = parts.slice(0, i + 1).join('/');
      const dir = i < parts.length - 1;
      let next = at.children.find((c) => c.name === part && c.dir === dir);
      if (!next) {
        next = { name: part, path, dir, children: [] };
        at.children.push(next);
      }
      at = next;
    });
  }
  const sort = (n: Node) => {
    n.children.sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1));
    n.children.forEach(sort);
  };
  sort(root);
  return root.children;
}

function FileTree({ chat, onOpen, open, setOpen }: { chat: Chat; onOpen: (path: string) => void; open: Set<string>; setOpen: React.Dispatch<React.SetStateAction<Set<string>>> }) {
  const [tree, setTree] = useState<{ files: TreeEntry[]; truncated: boolean } | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const setContext = useStore((s) => s.setContext);
  const repo = chat.repo!;
  const load = (refresh = false) => {
    setError('');
    repoTree(repo, refresh).then(setTree, (e) => setError((e as Error).message));
  };
  useEffect(() => load(), [repo.owner, repo.repo, repo.branch]); // eslint-disable-line react-hooks/exhaustive-deps

  const nodes = useMemo(() => buildTree(tree?.files || []), [tree]);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? (tree?.files || []).filter((f) => f.path.toLowerCase().includes(q)).slice(0, 200) : [];
  }, [tree, query]);
  const inChat = new Set(chat.context || []);
  const toggleChat = (path: string) => setContext(chat.id, inChat.has(path) ? [...inChat].filter((p) => p !== path) : [...inChat, path]);
  const changed = chat.changes || {};

  const Row = ({ path, name, depth }: { path: string; name: string; depth: number }) => (
    <li className={`ws-row${changed[path] ? ' changed' : ''}`} style={{ paddingInlineStart: 8 + depth * 14 }}>
      <button className="ws-open" onClick={() => onOpen(path)} title={path}>
        <File size={14} />
        <span className="ws-name">{name}</span>
        {changed[path] && <span className="ws-mark">{changed[path].content === null ? 'D' : changed[path].original === null ? 'A' : 'M'}</span>}
      </button>
      <button className={`icon-btn xs${inChat.has(path) ? ' on' : ''}`} onClick={() => toggleChat(path)} aria-label={inChat.has(path) ? `Remove ${path} from chat` : `Add ${path} to chat`} title={inChat.has(path) ? 'In the chat (click to remove)' : 'Add to the chat'}>
        {inChat.has(path) ? <Check size={13} /> : <MessageSquarePlus size={13} />}
      </button>
    </li>
  );
  const walk = (list: Node[], depth: number): React.ReactNode =>
    list.map((n) =>
      n.dir ? (
        <li key={n.path}>
          <button
            className="ws-dir"
            style={{ paddingInlineStart: 8 + depth * 14 }}
            onClick={() => setOpen((s) => {
              const next = new Set(s);
              if (next.has(n.path)) next.delete(n.path);
              else next.add(n.path);
              return next;
            })}
          >
            {open.has(n.path) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <Folder size={14} />
            <span className="ws-name">{n.name}</span>
          </button>
          {open.has(n.path) && <ul>{walk(n.children, depth + 1)}</ul>}
        </li>
      ) : (
        <Row key={n.path} path={n.path} name={n.name} depth={depth} />
      ),
    );

  return (
    <div className="ws-files">
      <div className="ws-tools">
        <label className="search">
          <Search size={14} />
          <input type="search" placeholder="Find a file" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <button className="icon-btn sm" onClick={() => load(true)} aria-label="Reload files" title="Reload from GitHub"><RefreshCw size={14} /></button>
      </div>
      {error && <p className="error-text small pad">{error}</p>}
      {!tree && !error && <p className="muted small pad"><Loader2 size={14} className="spin" /> Loading files…</p>}
      <ul className="ws-tree">
        {query ? matches.map((f) => <Row key={f.path} path={f.path} name={f.path} depth={0} />) : walk(nodes, 0)}
      </ul>
      {tree?.truncated && <p className="muted small pad">Very large repository: some files aren't listed.</p>}
    </div>
  );
}

function FileView({ chat, path, onBack }: { chat: Chat; path: string; onBack: () => void }) {
  const saveChange = useStore((s) => s.saveChange);
  const revertChange = useStore((s) => s.revertChange);
  const setContext = useStore((s) => s.setContext);
  const [text, setText] = useState<string | null | undefined>(undefined);
  const [draft, setDraft] = useState('');
  const change = chat.changes?.[path];
  useEffect(() => {
    let live = true;
    currentFile(chat, path).then((t) => {
      if (!live) return;
      setText(t);
      setDraft(t ?? '');
    }, () => live && setText(null));
    return () => {
      live = false;
    };
    // Reload when the saved version changes (edit applied, reverted).
  }, [path, change?.content]); // eslint-disable-line react-hooks/exhaustive-deps
  const inChat = (chat.context || []).includes(path);
  const dirty = text !== undefined && draft !== (text ?? '');

  return (
    <div className="ws-file">
      <div className="ws-file-head">
        <button className="icon-btn sm" onClick={onBack} aria-label="Back to files"><ArrowLeft size={16} /></button>
        <span className="ws-path" title={path}>{path}</span>
        {change && <span className="ws-mark">{change.content === null ? 'deleted' : change.original === null ? 'new' : 'edited'}</span>}
      </div>
      <div className="ws-file-actions">
        <button className="btn small" onClick={() => setContext(chat.id, inChat ? (chat.context || []).filter((p) => p !== path) : [...(chat.context || []), path])}>
          {inChat ? <Check size={14} /> : <MessageSquarePlus size={14} />} {inChat ? 'In chat' : 'Add to chat'}
        </button>
        <div className="spacer" />
        {change && (
          <button className="btn small ghost" onClick={() => revertChange(chat.id, path)} title="Undo all changes to this file">
            <RotateCcw size={14} /> Revert
          </button>
        )}
        <button className="btn small primary" disabled={!dirty} onClick={() => void saveChange(chat.id, path, draft)}>
          Save
        </button>
      </div>
      <div className="ws-editor">
        {text === undefined ? (
          <p className="muted small pad"><Loader2 size={14} className="spin" /> Opening…</p>
        ) : text === null && !change ? (
          <p className="muted small pad">This file doesn't exist on this branch.</p>
        ) : (
          <Suspense fallback={<p className="muted small pad"><Loader2 size={14} className="spin" /> Loading editor…</p>}>
            <CodeEditor path={path} value={draft} onChange={setDraft} readOnly={change?.content === null} />
          </Suspense>
        )}
      </div>
    </div>
  );
}

function Changes({ chat }: { chat: Chat }) {
  const revertChange = useStore((s) => s.revertChange);
  const commitWork = useStore((s) => s.commitWork);
  const toast = useStore((s) => s.toast);
  const entries = Object.entries(chat.changes || {});
  const lastAsk = [...chat.messages].reverse().find((m) => m.role === 'user' && !m.auto)?.text || '';
  const [message, setMessage] = useState(lastAsk.split('\n')[0].slice(0, 72) || 'Update from Model Router');
  const [target, setTarget] = useState<'new' | 'same'>('new');
  const [branch, setBranch] = useState(suggestBranch(lastAsk));
  const [pr, setPr] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ url: string; prUrl?: string } | null>(null);
  const [diff, setDiff] = useState<string | null>(null);
  const send = useStore((s) => s.send);
  const streaming = useStore((s) => Boolean(s.streamingChatId));
  const [problems, setProblems] = useState<Problem[] | null>(null);
  // Check the changed files whenever they change.
  useEffect(() => {
    let live = true;
    setProblems(null);
    void checkChanges(chat.changes || {}).then((p) => live && setProblems(p));
    return () => {
      live = false;
    };
  }, [chat.changes]);

  if (done && !entries.length) {
    return (
      <div className="ws-done">
        <p className="setting-label"><Check size={16} /> Committed and pushed</p>
        <a href={done.url} target="_blank" rel="noopener noreferrer">See the commit on GitHub <ExternalLink size={12} /></a>
        {done.prUrl && <a href={done.prUrl} target="_blank" rel="noopener noreferrer">Open the pull request <ExternalLink size={12} /></a>}
        <p className="muted small">The chat now works on <b>{chat.repo?.branch}</b>.</p>
        <button className="btn small" onClick={() => setDone(null)}>OK</button>
      </div>
    );
  }
  if (!entries.length) return <p className="muted small pad">No changes yet. Apply an edit from the chat, or edit a file and press Save.</p>;

  return (
    <div className="ws-changes">
      <ul className="ws-change-list">
        {entries.map(([path, c]) => {
          const s = lineStats(c.original ?? '', c.content ?? '');
          return (
            <li key={path} className="ws-change">
              <span className={`ws-badge ${c.content === null ? 'del' : c.original === null ? 'add' : 'mod'}`}>{c.content === null ? 'D' : c.original === null ? 'A' : 'M'}</span>
              <button className="ws-open" onClick={() => setDiff(path)} title="Show the difference">
                <span className="ws-name">{path}</span>
                <span className="add-n">+{s.added}</span>
                <span className="del-n">−{s.removed}</span>
              </button>
              <button className="icon-btn xs" onClick={() => setDiff(path)} aria-label={`Diff ${path}`}><FileDiff size={13} /></button>
              <button className="icon-btn xs" onClick={() => revertChange(chat.id, path)} aria-label={`Revert ${path}`} title="Revert"><RotateCcw size={13} /></button>
            </li>
          );
        })}
      </ul>
      {problems && problems.length > 0 && (
        <div className="ws-problems" role="alert">
          <p className="setting-label"><AlertTriangle size={15} /> {problems.length} problem{problems.length === 1 ? '' : 's'} would break the build</p>
          <ul>
            {problems.map((p, i) => (
              <li key={i}><code>{p.path}{p.line ? `:${p.line}` : ''}</code> {p.message}</li>
            ))}
          </ul>
          <button className="btn small primary" disabled={streaming} onClick={() => void send(problemsMessage(problems), [])}>
            <Wrench size={14} /> Ask the AI to fix
          </button>
        </div>
      )}
      <div className="ws-commit">
        <label className="field-block">
          <span className="setting-label">Commit message</span>
          <input type="text" value={message} onChange={(e) => setMessage(e.target.value)} />
        </label>
        <div className="segmented ws-target">
          <button className={target === 'new' ? 'active' : ''} onClick={() => setTarget('new')}>New branch</button>
          <button className={target === 'same' ? 'active' : ''} onClick={() => setTarget('same')}>Commit to {chat.repo?.branch}</button>
        </div>
        {target === 'new' && (
          <>
            <input type="text" value={branch} onChange={(e) => setBranch(e.target.value.replace(/\s+/g, '-'))} aria-label="New branch name" />
            <label className="check-row">
              <input type="checkbox" checked={pr} onChange={(e) => setPr(e.target.checked)} /> Open a pull request into {chat.repo?.branch}
            </label>
          </>
        )}
        <button
          className={`btn block${problems?.length ? '' : ' primary'}`}
          disabled={busy || !message.trim() || (target === 'new' && !branch.trim())}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await commitWork(chat.id, { message, target: target === 'new' ? branch : chat.repo!.branch, pullRequest: target === 'new' && pr });
              setDone(r);
              toast(r.prUrl ? 'Committed and opened a pull request.' : 'Committed and pushed.', 'success');
            } catch (e) {
              toast(`Couldn't commit: ${(e as Error).message}`, 'error');
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Loader2 size={15} className="spin" /> : <GitCommitHorizontal size={15} />} {problems?.length ? 'Commit anyway' : `Commit ${entries.length} file${entries.length === 1 ? '' : 's'} & push`}
        </button>
      </div>
      {diff && chat.changes?.[diff] && (
        <DiffView
          path={diff}
          before={chat.changes[diff].original}
          after={chat.changes[diff].content}
          onClose={() => setDiff(null)}
          footer={
            <button className="btn small ghost" onClick={() => { revertChange(chat.id, diff); setDiff(null); }}>
              <RotateCcw size={14} /> Revert this file
            </button>
          }
        />
      )}
    </div>
  );
}

/** Side panel (full screen on phones) for the chat's GitHub repository. */
export default function WorkspacePanel() {
  const chat = useStore(selectCurrentChat);
  const open = useStore((s) => s.workspaceOpen);
  const setUi = useStore((s) => s.setUi);
  const disconnectRepo = useStore((s) => s.disconnectRepo);
  const [tab, setTab] = useState<'files' | 'changes'>('files');
  const [reviewOpen,setReviewOpen]=useState(false);
  const [undoOpen,setUndoOpen]=useState(false);
  const accountId=useStore(state=>state.user?.uid);
  const [file, setFile] = useState<string | null>(null);
  // Expanded folders survive opening a file and coming back.
  const [openDirs, setOpenDirs] = useState<Set<string>>(new Set());
  useEffect(() => {
    setFile(null);
    setOpenDirs(new Set());
    setReviewOpen(false);
    setUndoOpen(false);
  }, [chat?.id, chat?.repo?.branch]);
  if (!open || !chat?.repo) return null;
  const count = Object.keys(chat.changes || {}).length;
  const repo = chat.repo;

  return (
    <aside className="workspace" aria-label="Repository">
      <header className="ws-head">
        <div className="ws-title">
          <span className="setting-label" title={`${repo.owner}/${repo.repo}`}>{repo.repo}</span>
          <span className="muted small"><GitBranch size={12} /> {repo.branch}</span>
        </div>
        <div className="spacer" />
        <button className="icon-btn sm" onClick={() => { if (confirm('Disconnect this repository from the chat? Uncommitted changes are discarded.')) disconnectRepo(); }} aria-label="Disconnect repository" title="Disconnect">
          <Unplug size={15} />
        </button>
        <button className="icon-btn sm" onClick={() => setUi({ workspaceOpen: false })} aria-label="Close repository panel"><X size={16} /></button>
      </header>
      <div className="segmented ws-tabs">
        <button className={tab === 'files' ? 'active' : ''} onClick={() => setTab('files')}>Files</button>
        <button className={tab === 'changes' ? 'active' : ''} onClick={() => setTab('changes')}>Changes{count ? ` (${count})` : ''}</button>
      </div>
      <div className="ws-body">
        {!file && <div className="ws-review-action"><button className="btn small" onClick={()=>setReviewOpen(true)}>Review pull request</button><button className="btn ghost small" onClick={()=>setUndoOpen(true)}><RotateCcw size={14}/> Undo last commit</button></div>}
        {tab === 'files' ? (file ? <FileView key={`${file}:${chat.lastCommit?.sha}`} chat={chat} path={file} onBack={() => setFile(null)} /> : <FileTree key={chat.lastCommit?.sha} chat={chat} onOpen={setFile} open={openDirs} setOpen={setOpenDirs} />) : <Changes chat={chat} />}
      </div>
      {reviewOpen && <PullReviewModal key={`${accountId}:${chat.id}:${repo.owner}/${repo.repo}@${repo.branch}`} chat={chat} onClose={()=>setReviewOpen(false)} />}
      {undoOpen && <CommitUndoModal key={`${accountId}:${chat.id}:${repo.owner}/${repo.repo}@${repo.branch}`} chat={chat} onClose={()=>setUndoOpen(false)} />}
    </aside>
  );
}
