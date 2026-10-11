import { create } from 'zustand';
import { openRouterDailyLimit, setKeys } from './lib/ai/providers.js';
import { buildChatBody, fetchCatalog, fetchSummary, fetchTitle, streamChat, type WireMessage } from './lib/api';
import { keepModelChoice, isExcludedModel } from './lib/ai/model-status.js';
import { activeSummary, compactLimit, contextTokens, cutPoint, liveMessages, summaryPrompt, withSummary } from './lib/compact';
import { cacheAccountSettings, forgetLocalAccount, isPreviewUser, loadKeys, loadRemoteSettings, saveKeys, saveRemoteSettings, signInPreview, signInWithGoogle, signOutUser, watchUser, type ApiKeys } from './lib/firebase';
import { registerServiceWorker } from './pwa/register';
import { ChatSync } from './lib/sync';
import { commitChanges as ghCommit, openPullRequest, setGitHubToken } from './lib/github';
import { applyEdit, isApplied, normalizeEdits, readRequests, type Edit } from './lib/edits';
import { forgetIndex, indexSoon, projectMap, relevantFiles, repoIndex, searchCode, searchRequests } from './lib/repoindex';
import { asksForFiles, currentFile, filesAsAttachments, fingerprint, forgetRepo, mentionedPaths, originalFile, repoTree, seenPaths, workspaceInstructions } from './lib/workspace';
import { Masker, scan } from './lib/privacy';
import { quota, type QuotaView } from './lib/quota';
import { extractMemoryOps, findMemory, hideMemoryLines, MAX_MEMORIES, memoryInstructions, MemoryStore } from './lib/memory';
import { AUTO, planRoute } from './lib/routing';
import { findLayout, isLayoutId } from './lib/layouts';
import { formatUntil, remaining, UsageTracker, type LimitInfo, type UsageView } from './lib/usage';
import { db } from './lib/db';
import { branchChat, normalizeChatTags } from './lib/chat-tools';
import { normalizeAssistant } from './lib/assistants';
import { canvasFits, canvasEditPrompt, cleanCanvasReply } from './lib/canvas';
import { applyAppearance, loadSettings, saveSettings } from './lib/settings';
import { modelShortName, uid } from './lib/util';
import type { Attachment, Catalog, Chat, ChatSummary, ComparisonState, FileChange, Memory, Message, ModelInfo, Project, RepoLink, SavedAssistant, Settings } from './types';

export interface Toast {
  id: string;
  text: string;
  kind: 'info' | 'error' | 'success';
}

export interface PreviewFile {
  name: string;
  content: string;
}

interface State {
  authed: boolean | null;
  user: { uid: string; email: string; name: string; photo: string } | null;
  /** set when the signed-in Google account isn't on the invite list */
  accessDenied: string | null;
  keys: ApiKeys;
  catalog: Catalog | null;
  usage: UsageView | null;
  /** what models remember about you, newest first */
  memories: Memory[];
  /** this project's use of Firebase's free daily limits */
  firebaseUsage: QuotaView;
  online: boolean;
  /** set when a new version of the app is ready; calling it switches to it */
  updateReady: (() => void) | null;
  /** the coding workspace panel (files, changes, commit) is open */
  workspaceOpen: boolean;
  canvasOpen: boolean;
  canvasDocumentId: string | null;
  canvasEditingChatId: string | null;
  /** choosing a GitHub repository for the chat */
  repoPicker: boolean;
  catalogError: string | null;
  settings: Settings;
  chats: Chat[];
  currentId: string | null;
  activeProjectId: string | null;
  comparing: boolean;
  comparison: ComparisonState | null;
  streamingChatId: string | null;
  /** chat whose older messages are being summarized right now */
  compactingChatId: string | null;
  sidebarOpen: boolean;
  settingsOpen: boolean;
  settingsTab: string;
  preview: PreviewFile | null;
  /** code from a reply being run in the browser */
  runner: { lang: string; code: string } | null;
  toasts: Toast[];

  init(): Promise<void>;
  login(): Promise<void>;
  loginPreview(email?: string): void;
  logout(): void;
  saveApiKeys(keys: ApiKeys): Promise<void>;
  loadCatalog(): Promise<void>;
  updateSettings(patch: Partial<Settings>): void;
  toast(text: string, kind?: Toast['kind']): void;
  dismissToast(id: string): void;
  setUi(patch: Partial<Pick<State, 'sidebarOpen' | 'settingsOpen' | 'settingsTab' | 'preview' | 'runner' | 'workspaceOpen' | 'repoPicker' | 'canvasOpen' | 'canvasDocumentId'>>): void;
  openCanvas(name?: string, content?: string): void;
  saveCanvasDocument(chatId: string, id: string, patch: { name?: string; content?: string }, expectedContent?: string): Promise<boolean>;
  deleteCanvasDocument(chatId: string, id: string): void;
  requestCanvasEdit(chatId: string, id: string, instruction: string, start: number, end: number, signal: AbortSignal, asIs?: boolean): Promise<{ text: string; model: string }>;

  // Coding workspace (GitHub)
  connectRepo(link: RepoLink): void;
  disconnectRepo(): void;
  setContext(chatId: string, paths: string[]): void;
  saveChange(chatId: string, path: string, content: string | null): Promise<void>;
  revertChange(chatId: string, path: string): void;
  /** give the model repository files it named and let it continue */
  loadRepoFiles(chatId: string, paths: string[], searches?: string[]): Promise<void>;
  /** hide the test results of the last commit */
  dismissChecks(chatId: string): void;
  applyEdits(chatId: string, edits: Edit[]): Promise<{ applied: number; failed: string[] }>;
  commitWork(chatId: string, o: { message: string; target: string; pullRequest: boolean }): Promise<{ url: string; prUrl?: string }>;

  newChat(): void;
  startAssistant(assistant: SavedAssistant): void;
  selectChat(id: string): void;
  deleteChat(id: string): Promise<void>;
  renameChat(id: string, title: string): Promise<void>;
  togglePin(id: string): Promise<void>;
  selectProject(id: string | null): void;
  saveProject(project: Project): boolean;
  deleteProject(id: string): void;
  moveChatToProject(chatId: string, projectId: string | null): void;
  branchChatFrom(chatId: string, messageId: string): void;
  setChatTags(chatId: string, tags: string[]): void;
  runComparison(text: string, files: Attachment[], models: string[], opts?: { privacy?: 'asIs' }): Promise<void>;
  cancelComparison(): void;
  clearComparison(): void;
  saveComparisonAnswer(model: string): void;
  setChatModel(model: string): void;
  clearAllChats(): Promise<void>;
  importChats(chats: Chat[]): Promise<number>;

  /** `privacy`: 'asIs' = you chose to send without masking (privacy shield) */
  send(text: string, files: Attachment[], opts?: { privacy?: 'asIs' }): Promise<void>;
  regenerate(messageId: string, model?: string): Promise<void>;
  editAndResend(messageId: string, text: string): Promise<void>;
  continueReply(): Promise<void>;
  /** summarizes older messages now (the /compact command) */
  compact(chatId?: string): Promise<void>;
  undoCompact(chatId: string): Promise<void>;
  /** starts a new chat that carries a summary of this one */
  continueInNewChat(chatId: string): Promise<void>;
  stop(): void;

  addMemory(text: string): Promise<void>;
  updateMemory(id: string, text: string): Promise<void>;
  deleteMemory(id: string): Promise<void>;
  clearMemories(): Promise<void>;
}

let controller: AbortController | null = null;
let compareController: AbortController | null = null;
let compactController: AbortController | null = null;
let canvasController: AbortController | null = null;
const canvasSyncTimers = new Map<string, ReturnType<typeof setTimeout>>();
let sync: ChatSync | null = null;
let usage: UsageTracker | null = null;
let memory: MemoryStore | null = null;
let settingsReady = false;
let settingsTimer: ReturnType<typeof setTimeout> | undefined;
/** the shared settings as last saved or loaded */
let lastSharedSettings = '';

function savedCatalog(): Catalog | null {
  try {
    return JSON.parse(localStorage.getItem('mr.catalog') || 'null');
  } catch {
    return null;
  }
}

const newChatObject = (): Chat => ({ id: uid(), title: 'New chat', createdAt: Date.now(), updatedAt: Date.now(), messages: [] });

export const useStore = create<State>((set, get) => {
  const replaceChat = (chat: Chat) => set((s) => ({ chats: s.chats.some((c) => c.id === chat.id) ? s.chats.map((c) => (c.id === chat.id ? chat : c)) : [chat, ...s.chats] }));
  /** Saves a chat on this device and sends the change to your other devices. */
  const persist = async (chat: Chat) => {
    if (!chat.messages.length && !chat.documents?.length) return;
    const stamped = { ...chat, rev: Date.now() };
    const latest = get().chats.find((c) => c.id === chat.id);
    if (latest === chat) replaceChat(stamped);
    try {
      await db.put(stamped);
    } catch {
      get().toast("Couldn't save this chat on the device (storage may be full).", 'error');
    }
    sync?.push(stamped);
  };
  const currentChat = () => get().chats.find((c) => c.id === get().currentId) || null;
  const clearAssistantDraft = () => { try { localStorage.removeItem(`mr.assistantDraft.${get().user?.uid}`); } catch { /* private mode */ } };
  const currentProjectId = () => get().settings.projects?.some((p) => p.id === get().activeProjectId) ? get().activeProjectId : null;
  const hideUnavailableModel = (id: string) => {
    const { settings, catalog } = get();
    if (settings.unavailableModels?.includes(id)) return;
    if (catalog) set({ catalog: { ...catalog, models: catalog.models.filter((m) => m.id !== id), defaults: catalog.defaults.filter((model) => model !== id) } });
    get().updateSettings({
      unavailableModels: [...(settings.unavailableModels || []), id],
      enabledModels: settings.enabledModels.filter((model) => model !== id),
      ...(settings.defaultModel === id ? { defaultModel: AUTO } : {}),
    });
  };

  /** The model this chat should use, falling back sensibly if it was disabled. */
  const modelFor = (chat: Chat | null): string => {
    const { settings, catalog } = get();
    const enabled = settings.enabledModels.filter((id) => !catalog || catalog.models.some((m) => m.id === id) || !catalog.models.length);
    const layoutOk = (id: string) => isLayoutId(id) && Boolean(findLayout(id, catalog?.models || [], settings.layouts, settings.hiddenLayouts));
    const project = settings.projects?.find((p) => p.id === chat?.projectId);
    const pick = [chat?.model, project?.defaultModel, settings.defaultModel, ...enabled].find((id) => id && (id === AUTO || enabled.includes(id) || layoutOk(id)));
    return pick || enabled[0] || catalog?.defaults[0] || '';
  };

  /** Models to write a summary with: fast Gemini models first, then the user's own models. */
  const summaryModels = (tokens: number): string[] => {
    const { settings, catalog } = get();
    const known = (id: string) => !catalog?.models.length || catalog.models.some((m) => m.id === id);
    const fits = (id: string) => {
      const ctx = modelInfo(catalog, id)?.context;
      return !ctx || ctx > tokens * 1.3 + 9000;
    };
    const fast = ['gemini:gemini-flash-latest', 'gemini:gemini-2.5-flash', 'gemini:gemini-flash-lite-latest', 'gemini:gemini-2.5-flash-lite'].filter(known);
    const ids = [...new Set([...fast, ...settings.enabledModels.filter((id) => id !== AUTO)])].filter(fits);
    const blocked = (id: string) => (usage?.blockedUntil(id) ?? null) !== null;
    return [...ids.filter((id) => !blocked(id)), ...ids.filter(blocked)];
  };

  /**
   * Summarizes the first `cut` live messages (plus any earlier summary). Returns null if no model managed it.
   */
  const writeSummary = async (chat: Chat, cut: number, signal: AbortSignal): Promise<{ summary: ChatSummary; through: Message[] } | null> => {
    const previous = activeSummary(chat);
    const older = liveMessages(chat).slice(0, cut);
    // Privacy shield: the model summarizes placeholders; the summary is stored with the real values.
    const masker = get().settings.privacyShield ? new Masker() : null;
    const prompt = masker ? masker.mask(summaryPrompt(older, previous)).text : summaryPrompt(older, previous);
    const result = await fetchSummary(prompt, summaryModels(Math.ceil(prompt.length / 4)), {
      signal,
      report: (id, info) => {
        usage?.record(id, { requests: 1, input: info.input || 0, output: info.output || 0 });
        if (info.limit) usage?.block(id, info.limit);
      },
    });
    if (!result) return null;
    return {
      through: older,
      summary: {
        text: (masker ? masker.unmask(result.text) : result.text).slice(0, 60_000),
        upTo: older[older.length - 1].id,
        count: (previous?.count || 0) + older.length,
        saved: 0,
        createdAt: Date.now(),
        model: result.model,
        ...(previous?.from ? { from: previous.from } : {}),
      },
    };
  };

  /** Compacts a chat. Returns 'done', 'skipped' (nothing to do / failed) or 'stopped'. */
  const compactChat = async (chatId: string, manual: boolean): Promise<'done' | 'skipped' | 'stopped'> => {
    const chat = get().chats.find((c) => c.id === chatId);
    if (!chat) return 'skipped';
    const cut = cutPoint(liveMessages(chat), manual);
    if (!cut) {
      if (manual) get().toast('Not enough messages yet to compact this chat.');
      return 'skipped';
    }
    compactController = new AbortController();
    set({ compactingChatId: chatId });
    try {
      const out = await writeSummary(chat, cut, compactController.signal);
      if (compactController.signal.aborted) return 'stopped';
      if (!out) {
        get().toast(manual ? "Couldn't summarize this chat right now. Try again in a minute." : "Couldn't summarize the earlier messages right now — the whole chat was sent instead.", 'error');
        return 'skipped';
      }
      const latest = get().chats.find((c) => c.id === chatId);
      if (!latest || !latest.messages.some((m) => m.id === out.summary.upTo)) return 'skipped';
      const before = contextTokens(latest);
      const updated: Chat = { ...latest, summary: { ...out.summary, auto: !manual } };
      updated.summary!.saved = Math.max(0, before - contextTokens(updated));
      replaceChat(updated);
      await persist(updated);
      return 'done';
    } catch {
      return compactController?.signal.aborted ? 'stopped' : 'skipped';
    } finally {
      compactController = null;
      set({ compactingChatId: null });
    }
  };

  /** Takes the memory lines out of a finished reply and saves or removes those memories. */
  const applyMemoryLines = async (reply: Message, raw: string, chatId: string, restore: (t: string) => string = (t) => t) => {
    const ops = extractMemoryOps(restore(raw));
    reply.text = ops.text;
    if (!memory || !get().settings.memory || (!ops.remember.length && !ops.forget.length)) return;
    const saved: { id: string; text: string }[] = [];
    const forgotten: string[] = [];
    try {
      for (const text of ops.forget) {
        const m = findMemory(get().memories, text);
        if (!m) continue;
        await memory.remove(m.id);
        forgotten.push(m.text);
        set((s) => ({ memories: s.memories.filter((x) => x.id !== m.id) }));
      }
      for (const text of ops.remember) {
        if (findMemory(get().memories, text) || get().memories.length >= MAX_MEMORIES) continue;
        const m = await memory.add(text, { source: 'chat', chatId });
        saved.push({ id: m.id, text: m.text });
        set((s) => ({ memories: [m, ...s.memories.filter((x) => x.id !== m.id)] }));
      }
    } catch (e) {
      get().toast(`Couldn't update memory: ${(e as Error).message}`, 'error');
    }
    if (saved.length || forgotten.length) reply.memory = { ...(saved.length ? { saved } : {}), ...(forgotten.length ? { forgotten } : {}) };
  };

  /** Streams an assistant reply for the chat's current messages. */
  const runAssistant = async (chatId: string, modelOverride?: string) => {
    let chat = get().chats.find((c) => c.id === chatId);
    if (!chat) return;
    const { settings } = get();
    const projectFiles = settings.projects?.find((p) => p.id === chat!.projectId)?.files?.filter((f) => Boolean(f.text)) || [];
    const projectTokens = projectFiles.reduce((n, f) => n + Math.ceil((f.text?.length || 0) / 4), 0);
    let model = modelOverride || modelFor(chat);
    if (!model) {
      get().toast('No models are enabled. Open Settings → Models.', 'error');
      return;
    }
    // A layout: its models (best first) answer, Auto-style or in order, with its own instructions.
    const catalogModels = get().catalog?.models || [];
    const layout = isLayoutId(model) ? findLayout(model, catalogModels, settings.layouts, settings.hiddenLayouts) : undefined;
    const usable = (id: string) => catalogModels.some((m) => m.id === id);
    const layoutModels = layout ? layout.models.filter(usable) : [];
    if (layout) model = layout.mode === 'auto' || !layoutModels.length ? AUTO : layoutModels[0];
    const routeModels = layoutModels.length ? layoutModels : settings.enabledModels;
    // Long chat: summarize the older messages first so the model gets a compact version.
    if (settings.autoCompact && contextTokens(chat) + projectTokens > compactLimit(model === AUTO ? undefined : modelInfo(get().catalog, model))) {
      if ((await compactChat(chatId, false)) === 'stopped') return;
      chat = get().chats.find((c) => c.id === chatId);
      if (!chat) return;
    }
    // Pick the model: Auto scores every enabled model for this message; a manual choice is kept
    // unless it can't handle the message. Models at their limit go to the back of the line.
    const blocked = (id: string) => (usage?.blockedUntil(id) ?? null) !== null;
    const lastUser = [...chat.messages].reverse().find((m) => m.role === 'user');
    const plan = planRoute({
      selected: model,
      enabled: routeModels,
      catalog: get().catalog?.models || [],
      text: lastUser?.text || '',
      files: [...(lastUser?.files || []), ...projectFiles],
      conversationTokens: contextTokens(chat) + projectTokens,
      search: settings.webSearch,
      blocked,
      left: (id) => remaining(get().usage, id),
    });
    let chosen = plan.model;
    if (!chosen) {
      get().toast('No models are enabled. Open Settings → Models.', 'error');
      return;
    }
    // After a layout's own models, your other models are the last resort.
    const rest = layoutModels.length ? settings.enabledModels.filter((id) => !layoutModels.includes(id) && id !== plan.model) : [];
    let fallbacks = settings.autoSwitch ? [...plan.fallbacks, ...rest] : [];
    const preNotices: string[] = plan.notice ? [plan.notice] : [];
    if (layout && !layoutModels.length) preNotices.push(`None of the "${layout.name}" models are available with your keys — using your own models.`);
    if (settings.autoSwitch && blocked(chosen)) {
      const next = fallbacks.find((id) => !blocked(id));
      if (next) {
        if (model !== AUTO && !layout) preNotices.push(`${modelLabel(get().catalog, chosen)} reached its limit (available again ${formatUntil(usage!.blockedUntil(chosen)!)}) — using ${modelLabel(get().catalog, next)}.`);
        fallbacks = [...fallbacks.filter((id) => id !== next), chosen];
        chosen = next;
      }
    }
    const wire: WireMessage[] = withSummary(activeSummary(chat), liveMessages(chat)
      .filter((m) => !m.error || m.text)
      .map((m) => {
        // Attachments synced from another device arrive without their contents.
        const usable = (m.files || []).filter((f) => f.data || f.text);
        const missing = (m.files || []).filter((f) => !f.data && !f.text).map((f) => f.name);
        return {
          role: m.role,
          text: missing.length ? `[Attached on another device, not available here: ${missing.join(', ')}]\n${m.text}` : m.text,
          files: usable.map(({ kind, name, mime, data, text }) => ({ kind, name, mime, data, text })),
          asIs: m.privacy?.unmasked,
        } as WireMessage;
      }));
    if (projectFiles.length) {
      const lastUserIndex = wire.findLastIndex((m) => m.role === 'user');
      if (lastUserIndex >= 0) {
        const projectAttachments = projectFiles.map(({ kind, name, mime, text }) => ({ kind, name, mime, text }));
        wire[lastUserIndex] = { ...wire[lastUserIndex], files: [...(wire[lastUserIndex].files || []), ...projectAttachments] };
      }
    }
    // Privacy shield: models see placeholders like [PHONE_1] instead of personal details (the same
    // detail gets the same placeholder throughout the chat), and replies get the real values back.
    const masker = settings.privacyShield ? new Masker() : null;
    if (masker) {
      for (let i = 0; i < wire.length; i++) {
        const w = wire[i];
        if (w.asIs) continue;
        wire[i] = { ...w, text: masker.mask(w.text).text, files: w.files?.map((f) => (f.text ? { ...f, text: masker.mask(f.text).text } : f)) };
      }
    }
    const restore = (t: string) => (masker && settings.privacyRestore ? masker.unmask(t) : t);

    // Coding workspace: the repository's file list and how to read files and propose edits.
    let workspaceNote = '';
    if (chat.repo) {
      const tree = await repoTree(chat.repo).catch(() => null);
      const index = await indexSoon(chat.repo, 6000);
      workspaceNote = workspaceInstructions(chat.repo, tree?.files || [], Boolean(tree?.truncated), chat.context || [], index ? projectMap(chat, index) : '');
    }

    let body: string;
    try {
      const rawMemory = settings.memory ? memoryInstructions(get().memories, settings.memoryAuto) : '';
      const memoryNote = masker ? masker.mask(rawMemory).text : rawMemory;
      const projectInstructions = settings.projects?.find((p) => p.id === chat?.projectId)?.instructions || '';
      const instructions = [settings.customInstructions, projectInstructions, chat.assistant?.instructions, layout?.instructions].filter(Boolean).join('\n\n');
      body = buildChatBody({ model: chosen, fallbacks, messages: wire, options: { search: settings.webSearch, customInstructions: masker ? masker.mask(instructions).text : instructions, memory: memoryNote, workspace: workspaceNote } });
    } catch (e) {
      get().toast((e as Error).message, 'error');
      return;
    }

    const reply: Message = {
      id: uid(),
      role: 'assistant',
      text: '',
      model: chosen,
      route: model === AUTO ? plan.reason || undefined : undefined,
      via: layout?.name,
      status: 'streaming',
      createdAt: Date.now(),
      notices: preNotices.length ? preNotices : undefined,
    };
    chat = { ...chat, messages: [...chat.messages, reply], updatedAt: Date.now() };
    replaceChat(chat);
    controller = new AbortController();
    set({ streamingChatId: chatId });

    // Batch UI updates while text streams in.
    let pending = false;
    const flush = () => {
      pending = false;
      const c = get().chats.find((x) => x.id === chatId);
      if (!c) return;
      replaceChat({ ...c, messages: c.messages.map((m) => (m.id === reply.id ? { ...reply } : m)) });
    };
    const schedule = () => {
      if (!pending) {
        pending = true;
        setTimeout(flush, 40);
      }
    };

    // The full reply text, including any hidden [[remember: …]] lines.
    let raw = '';
    try {
      for await (const ev of streamChat(body, controller.signal)) {
        if (ev.t === 'unavailable') { hideUnavailableModel(ev.id); continue; }
        if (ev.t === 'request') {
          usage?.record(ev.id, { requests: 1 });
          continue;
        }
        if (ev.t === 'usage') {
          usage?.record(ev.id, { input: ev.input, output: ev.output });
          continue;
        }
        if (ev.t === 'limit') {
          usage?.block(ev.id, ev as unknown as LimitInfo);
          continue;
        }
        if (ev.t === 'discard') {
          // The model that was thinking failed; its half-finished thoughts are dropped.
          reply.thinking = undefined;
          schedule();
          continue;
        }
        if (ev.t === 'text') {
          raw += ev.text;
          reply.text = restore(hideMemoryLines(raw));
        }
        else if (ev.t === 'think') reply.thinking = (reply.thinking || '') + ev.text;
        else if (ev.t === 'model') {
          // Auto's reason only describes the model it picked, not a stand-in after a failure.
          if (ev.id !== reply.model) reply.route = undefined;
          reply.model = ev.id;
        }
        else if (ev.t === 'notice') reply.notices = [...(reply.notices || []), ev.text];
        else if (ev.t === 'sources') reply.sources = [...(reply.sources || []), ...ev.items];
        else if (ev.t === 'error') reply.error = ev.text;
        schedule();
      }
      reply.status = reply.error && !reply.text ? 'error' : 'done';
    } catch (e) {
      if ((e as Error).name === 'AbortError') reply.status = 'stopped';
      else {
        reply.error = (e as Error).message;
        reply.status = 'error';
      }
    } finally {
      controller = null;
    }
    if (raw) await applyMemoryLines(reply, raw, chatId, restore);
    flush();
    set({ streamingChatId: null });
    const finished = get().chats.find((c) => c.id === chatId);
    if (!finished) return;
    const updated = { ...finished, updatedAt: Date.now() };
    replaceChat(updated);
    await persist(updated);

    // Name the chat after its first exchange.
    const firstUser = updated.messages.find((m) => m.role === 'user');
    if (get().settings.autoTitle && !updated.summary?.from && updated.messages.length <= 2 && firstUser && reply.status === 'done') {
      const titleMasker = get().settings.privacyShield && !firstUser.privacy?.unmasked ? new Masker() : null;
      const firstText = firstUser.text || firstUser.files?.map((f) => f.name).join(', ') || '';
      const result = await fetchTitle(titleMasker ? titleMasker.mask(firstText).text : firstText, reply.model, (id) => (usage?.blockedUntil(id) ?? null) !== null);
      if (result) usage?.record(result.model, { requests: 1 });
      const latest = get().chats.find((c) => c.id === chatId);
      if (result && latest) {
        const named = { ...latest, title: titleMasker ? titleMasker.unmask(result.title) : result.title };
        replaceChat(named);
        await persist(named);
      }
    }

    // Coding workspace: the model asked to read files ([[read: path]]) → load them and let it continue.
    // Models that ask for files in words instead ("please share src/App.tsx") get them loaded too.
    const now = get().chats.find((c) => c.id === chatId);
    if (now?.repo && reply.status === 'done' && !/`{3,}\s*(edit|delete)[:\s]/i.test(normalizeEdits(reply.text))) {
      let asks = readRequests(reply.text);
      const searches = searchRequests(reply.text);
      if (!asks.length && !searches.length && asksForFiles(reply.text)) {
        const tree = await repoTree(now.repo).catch(() => null);
        const seen = seenPaths(now);
        if (tree) asks = mentionedPaths(reply.text, tree.files).filter((p) => !seen.has(p));
      }
      let rounds = 0;
      for (let i = now.messages.length - 1; i >= 0 && rounds < 9; i--) {
        const m = now.messages[i];
        if (m.role !== 'user') continue;
        if (m.auto !== 'files') break;
        rounds++;
      }
      if ((asks.length || searches.length) && rounds < 6) await get().loadRepoFiles(chatId, asks, searches);
    }
  };

  return {
    authed: null,
    user: null,
    accessDenied: null,
    keys: { gemini: '', openrouter: '', groq: '', cerebras: '', github: '' },
    catalog: null,
    usage: null,
    memories: [],
    firebaseUsage: quota.view(),
    online: navigator.onLine,
    updateReady: null,
    workspaceOpen: false,
    canvasOpen: false,
    canvasDocumentId: null,
    canvasEditingChatId: null,
    repoPicker: false,
    catalogError: null,
    settings: loadSettings(),
    chats: [],
    currentId: null,
    activeProjectId: (() => { try { return localStorage.getItem('mr.activeProject') || null; } catch { return null; } })(),
    comparing: false,
    comparison: null,
    streamingChatId: null,
    compactingChatId: null,
    sidebarOpen: false,
    settingsOpen: false,
    settingsTab: '',
    preview: null,
    runner: null,
    toasts: [],

    async init() {
      applyAppearance(get().settings);
      quota.subscribe((firebaseUsage) => set({ firebaseUsage }));
      registerServiceWorker((apply) => set({ updateReady: apply }));
      const onNet = () => {
        set({ online: navigator.onLine });
        // Back online: refresh the model list if it couldn't load.
        if (navigator.onLine && get().authed && get().catalogError) void get().loadCatalog();
      };
      window.addEventListener('online', onNet);
      window.addEventListener('offline', onNet);
      try {
        const chats = await db.all();
        set({ chats });
      } catch {
        get().toast("Couldn't open saved chats on this device.", 'error');
      }
      watchUser(async (user) => {
        sync?.stop();
        sync = null;
        usage?.stop();
        usage = null;
        memory?.stop();
        memory = null;
        set({ memories: [] });
        await quota.flush();
        quota.stop();
        settingsReady = false;
        if (!user) {
          setKeys({ gemini: '', openrouter: '', groq: '', cerebras: '' });
          setGitHubToken('');
          set({ authed: false, user: null, catalog: null, accessDenied: null });
          return;
        }
        // Stay on the loading screen until we know this account is invited.
        set({ authed: null, accessDenied: null, user: { uid: user.uid, email: user.email || '', name: user.displayName || '', photo: user.photoURL || '' } });
        try {
          const [keys, remoteSettings] = await Promise.all([loadKeys(user.uid), loadRemoteSettings(user.uid)]);
          setKeys(keys);
          setGitHubToken(keys.github);
          set({ keys, authed: true });
          if (remoteSettings) get().updateSettings({ ...remoteSettings, unavailableModels: remoteSettings.unavailableModels || [], assistants: remoteSettings.assistants || [], prompts: remoteSettings.prompts || [], voiceLang: get().settings.voiceLang } as Partial<Settings>);
          else get().updateSettings({ unavailableModels: [], assistants: [], prompts: [] });
          try {
            const draftId = localStorage.getItem(`mr.assistantDraft.${user.uid}`);
            if (draftId && get().chats.some((chat) => chat.id === draftId && chat.assistant && !chat.messages.length)) set({ currentId: draftId });
          } catch { /* private mode */ }
          {
            const { voiceLang: _voice, ...shared } = get().settings;
            lastSharedSettings = remoteSettings ? JSON.stringify(shared) : '';
          }
          settingsReady = true;
          if (!remoteSettings) get().updateSettings({});
        } catch (e) {
          // The database refuses accounts that aren't invited.
          const isInvitedException = isPreviewUser(user.uid) || Boolean(user.email && user.email.toLowerCase() === 'seifeldingamal2021@gmail.com');
          if ((e as { code?: string }).code === 'permission-denied' && !isInvitedException) {
            set({ authed: true, accessDenied: user.email || 'this account', catalog: null });
            return;
          }
          set({ authed: true, accessDenied: null });
          if (!isInvitedException) {
            get().toast(`Couldn't load your settings: ${(e as Error).message}`, 'error');
          }
        }
        void quota.start();
        sync = new ChatSync(user.uid, {
          local: (id) => get().chats.find((c) => c.id === id),
          allLocal: () => get().chats,
          apply: (chat) => {
            replaceChat(chat);
            set((s) => ({ chats: [...s.chats].sort((a, b) => b.updatedAt - a.updatedAt) }));
            void db.put(chat);
          },
          remove: (id) => {
            set((s) => ({ chats: s.chats.filter((c) => c.id !== id), currentId: s.currentId === id ? null : s.currentId }));
            void db.remove(id);
          },
          error: (msg) => get().toast(msg, 'error'),
        });
        sync.start();
        usage = new UsageTracker(user.uid, (view) => set({ usage: view }));
        usage.start();
        memory = new MemoryStore(user.uid, (memories) => set({ memories }), (msg) => get().toast(msg, 'error'));
        memory.start();
        await get().loadCatalog();
      });
    },

    async login() {
      await signInWithGoogle();
    },

    loginPreview(email = 'preview@local.user') {
      signInPreview(email, 'Guest');
    },

    logout() {
      get().stop();
      const id = get().user?.uid;
      if (id) forgetLocalAccount(id);
      void signOutUser();
    },

    async saveApiKeys(keys) {
      const uid = get().user?.uid;
      if (!uid) return;
      const before = get().keys;
      await saveKeys(uid, keys);
      setKeys(keys);
      const clean: ApiKeys = { gemini: keys.gemini.trim(), openrouter: keys.openrouter.trim(), groq: keys.groq.trim(), cerebras: keys.cerebras.trim(), github: (keys.github || '').trim() };
      setGitHubToken(clean.github);
      const changed = (['gemini', 'openrouter', 'groq', 'cerebras'] as const).filter((provider) => clean[provider] !== before[provider]);
      if (changed.length) get().updateSettings({ unavailableModels: (get().settings.unavailableModels || []).filter((id) => !changed.some((provider) => id.startsWith(`${provider}:`))) });
      set({ keys: clean });
      await get().loadCatalog();
      // A newly connected provider: switch on its suggested models so they're ready to use.
      const prefix: Partial<Record<keyof ApiKeys, string>> = { gemini: 'gemini:', openrouter: 'openrouter:', groq: 'groq:', cerebras: 'cerebras:' };
      const added = (Object.keys(prefix) as (keyof ApiKeys)[]).filter((k) => clean[k] && !before[k]);
      const catalog = get().catalog;
      if (added.length && catalog) {
        const extra = catalog.defaults.filter((id) => added.some((k) => id.startsWith(prefix[k]!)) && !get().settings.enabledModels.includes(id));
        if (extra.length) get().updateSettings({ enabledModels: [...get().settings.enabledModels, ...extra] });
      }
    },

    async loadCatalog() {
      const { keys } = get();
      if (!keys.gemini && !keys.openrouter && !keys.groq && !keys.cerebras) {
        set({ catalog: null, catalogError: null, settingsOpen: true, settingsTab: 'keys' });
        return;
      }
      try {
        let catalog = await fetchCatalog(true).catch((e) => {
          if (navigator.onLine || !savedCatalog()) throw e;
          return savedCatalog()!;
        });
        // Offline: use the list from last time so the app stays usable.
        if (catalog.errors.length && !navigator.onLine && savedCatalog()) catalog = savedCatalog()!;
        if (navigator.onLine && !catalog.errors.length) {
          try {
            localStorage.setItem('mr.catalog', JSON.stringify(catalog));
          } catch {
            /* storage full */
          }
        }
        void openRouterDailyLimit().then((n) => usage?.setOpenRouterDaily(n));
        usage?.useProviders((['groq', 'cerebras'] as const).filter((p) => catalog.providers[p]));
        const previous = get().catalog || savedCatalog();
        if (catalog.failedProviders?.length && previous) {
          catalog = { ...catalog, models: [...catalog.models, ...previous.models.filter((m) => catalog.failedProviders!.includes(m.id.split(':')[0]) && !isExcludedModel(m.id))] };
        }
        const unavailable = new Set(get().settings.unavailableModels || []);
        catalog = { ...catalog, models: catalog.models.filter((m) => !isExcludedModel(m.id) && !unavailable.has(m.id)) };
        const { settings } = get();
        const known = new Set(catalog.models.map((m) => m.id));
        let enabled = settings.enabledModels.filter((id) => !unavailable.has(id) && keepModelChoice(id, catalog));
        if (!enabled.length) enabled = catalog.defaults.filter((id) => known.has(id));
        // New chats use Auto (introduced once; you can switch back to a fixed model any time).
        const wanted = settings.autoIntroduced ? settings.defaultModel : AUTO;
        const defaultModel = wanted === AUTO || enabled.includes(wanted) || (isLayoutId(wanted) && findLayout(wanted, catalog.models, settings.layouts, settings.hiddenLayouts)) ? wanted : enabled[0] || '';
        set({ catalog, catalogError: catalog.errors.length ? catalog.errors.join(' · ') : null });
        get().updateSettings({ enabledModels: enabled, defaultModel, autoIntroduced: true });
      } catch (e) {
        set({ catalogError: (e as Error).message });
      }
    },

    updateSettings(patch) {
      const settings = { ...get().settings, ...patch };
      saveSettings(settings);
      applyAppearance(settings);
      const activeProjectId = settings.projects && get().activeProjectId && !settings.projects.some((p) => p.id === get().activeProjectId)
        ? null
        : get().activeProjectId;
      if (activeProjectId !== get().activeProjectId) {
        try { localStorage.removeItem('mr.activeProject'); } catch { /* private mode */ }
      }
      set({ settings, activeProjectId });
      // Share settings with your other devices (voice language stays per device).
      const uid = get().user?.uid;
      if (uid && settingsReady) {
        const { voiceLang: _localVoice, ...localShared } = settings;
        cacheAccountSettings(uid, localShared);
        clearTimeout(settingsTimer);
        settingsTimer = setTimeout(() => {
          const { voiceLang: _voice, ...shared } = get().settings;
          // Only write when something actually changed (saves Firebase's free daily writes).
          const json = JSON.stringify(shared);
          if (json === lastSharedSettings) return;
          lastSharedSettings = json;
          saveRemoteSettings(uid, shared).catch(() => {
            lastSharedSettings = '';
          });
        }, 800);
      }
    },

    toast(text, kind = 'info') {
      const id = uid();
      set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, kind }] }));
      setTimeout(() => get().dismissToast(id), kind === 'error' ? 7000 : 3500);
    },
    dismissToast(id) {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    },
    setUi(patch) {
      set({ ...patch, ...(patch.workspaceOpen ? { canvasOpen: false } : {}), ...(patch.canvasOpen ? { workspaceOpen: false } : {}) });
    },

    openCanvas(name, content = '') {
      let chat = currentChat();
      if (!chat) { chat = { ...newChatObject(), projectId: currentProjectId() || undefined }; replaceChat(chat); set({ currentId: chat.id }); }
      const documents = chat.documents || [];
      const existing = name ? documents.find(doc => doc.name === name && doc.content === content) : documents[0];
      if (existing) { set({ canvasOpen: true, canvasDocumentId: existing.id, workspaceOpen: false, sidebarOpen: false }); return; }
      const doc = { id: uid(), name: name || 'Document.md', content, updatedAt: Date.now() };
      if (!canvasFits([...documents, doc])) { get().toast('A chat can keep 5 canvas documents and 100,000 characters total.', 'error'); return; }
      const updated = { ...chat, title: !chat.messages.length && !documents.length ? doc.name : chat.title, documents: [...documents, doc], updatedAt: Date.now() };
      replaceChat(updated); void persist(updated);
      set({ canvasOpen: true, canvasDocumentId: doc.id, workspaceOpen: false, sidebarOpen: false });
    },
    async saveCanvasDocument(chatId, id, patch, expectedContent) {
      const chat = get().chats.find(c => c.id === chatId);
      const doc = chat?.documents?.find(d => d.id === id);
      if (!chat || !doc) return false;
      if (expectedContent !== undefined && doc.content !== expectedContent) { get().toast('The document changed. Review a fresh edit before applying it.', 'error'); return false; }
      if ((patch.name === undefined || patch.name === doc.name) && (patch.content === undefined || patch.content === doc.content)) return true;
      const documents = chat.documents!.map(d => d.id === id ? { ...d, ...patch, name: (patch.name ?? d.name).slice(0,120), updatedAt: Date.now() } : d);
      if (!canvasFits(documents)) { get().toast('Canvas documents are limited to 100,000 characters per chat.', 'error'); return false; }
      const updated = { ...chat, documents, rev: Date.now(), updatedAt: Date.now() };
      replaceChat(updated);
      // Save locally immediately; coalesce typing before spending a Firebase write.
      try { await db.put(updated); } catch { get().toast("Couldn't save this canvas on the device.", 'error'); return false; }
      clearTimeout(canvasSyncTimers.get(chatId));
      const accountUid = get().user?.uid;
      canvasSyncTimers.set(chatId, setTimeout(() => {
        canvasSyncTimers.delete(chatId);
        const latest = get().chats.find(c => c.id === chatId);
        if (latest && get().user?.uid === accountUid) sync?.push(latest);
      }, 1200));
      return true;
    },
    deleteCanvasDocument(chatId, id) {
      const chat = get().chats.find(c => c.id === chatId);
      if (!chat) return;
      const updated = { ...chat, documents: (chat.documents || []).filter(doc => doc.id !== id), updatedAt: Date.now() };
      replaceChat(updated);
      // Persist deletion of the final document even when the chat has no messages.
      void db.put({ ...updated, rev: Date.now() });
      if (updated.messages.length || updated.documents.length) void persist(updated);
      else sync?.remove(chatId);
      set({ canvasDocumentId: updated.documents[0]?.id || null, canvasOpen: Boolean(updated.documents.length) });
    },
    async requestCanvasEdit(chatId, id, instruction, start, end, signal, asIs) {
      if (get().streamingChatId || get().compactingChatId || get().comparing || get().canvasEditingChatId) throw new Error('Wait for the current reply to finish.');
      if (!navigator.onLine) throw new Error("You're offline. Your canvas stays saved here.");
      const chat = get().chats.find(c => c.id === chatId);
      const doc = chat?.documents?.find(d => d.id === id);
      if (!chat || !doc) throw new Error('This document is no longer available.');
      const { settings, catalog } = get();
      const prompt = canvasEditPrompt(doc, instruction, start, end);
      let selected = modelFor(chat);
      const layout = isLayoutId(selected) ? findLayout(selected, catalog?.models || [], settings.layouts, settings.hiddenLayouts) : undefined;
      const enabled = layout?.models.length ? layout.models : settings.enabledModels;
      if (layout) selected = layout.mode === 'auto' ? AUTO : enabled[0] || AUTO;
      const plan = planRoute({ selected, enabled, catalog: catalog?.models || [], text: prompt, files: [], conversationTokens: Math.ceil(prompt.length / 4), search: false, blocked: id => (usage?.blockedUntil(id) ?? null) !== null, left: id => remaining(get().usage, id) });
      if (!plan.model) throw new Error('No models are enabled. Open Settings → Models.');
      const project = settings.projects?.find(p => p.id === chat.projectId);
      const instructions = [settings.customInstructions, project?.instructions, chat.assistant?.instructions, layout?.instructions, 'You are editing a canvas selection. Return only the replacement text. Do not add memory commands or explanations.'].filter(Boolean).join('\n\n');
      const memoryNote = settings.memory ? memoryInstructions(get().memories, false) : '';
      const masker = settings.privacyShield && !asIs ? new Masker() : null;
      const body = buildChatBody({ model: plan.model, fallbacks: settings.autoSwitch ? plan.fallbacks : [], messages: [{ role: 'user', text: masker ? masker.mask(prompt).text : prompt }], options: { search: false, customInstructions: masker ? masker.mask(instructions).text : instructions, memory: masker ? masker.mask(memoryNote).text : memoryNote } });
      const aborter = new AbortController();
      const abort = () => aborter.abort();
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
      canvasController = aborter; set({ canvasEditingChatId: chatId });
      let text = '', error = '', model = plan.model;
      try {
        for await (const ev of streamChat(body, aborter.signal)) {
          if (ev.t === 'unavailable') hideUnavailableModel(ev.id);
          else if (ev.t === 'request') usage?.record(ev.id, { requests: 1 });
          else if (ev.t === 'usage') usage?.record(ev.id, { input: ev.input, output: ev.output });
          else if (ev.t === 'limit') usage?.block(ev.id, ev as unknown as LimitInfo);
          else if (ev.t === 'model') model = ev.id;
          else if (ev.t === 'text') text += ev.text;
          else if (ev.t === 'discard') { text = ''; error = ''; }
          else if (ev.t === 'error') error = ev.text;
          else if (ev.t === 'notice' && /length limit/i.test(ev.text)) error = 'The edit reached the model’s length limit. Select a smaller section.';
        }
        if (aborter.signal.aborted) throw new DOMException('Stopped', 'AbortError');
        if (error || !text.trim()) throw new Error(error || 'No edit was returned. Try another model.');
        const restored = masker && settings.privacyRestore ? masker.unmask(text) : text;
        return { text: cleanCanvasReply(restored), model };
      } finally {
        signal.removeEventListener('abort', abort);
        if (canvasController === aborter) { canvasController = null; set({ canvasEditingChatId: null }); }
      }
    },

    selectProject(id) {
      clearAssistantDraft();
      set({ canvasOpen: false, canvasDocumentId: null });
      const valid = id && get().settings.projects?.some((p) => p.id === id) ? id : null;
      try { if (valid) localStorage.setItem('mr.activeProject', valid); else localStorage.removeItem('mr.activeProject'); } catch { /* private mode */ }
      set({ activeProjectId: valid, sidebarOpen: false });
      if (valid) {
        const existing = get().chats.find((c) => c.projectId === valid);
        if (existing) set({ currentId: existing.id });
        else get().newChat();
      }
    },
    saveProject(project) {
      const projects = get().settings.projects || [];
      if (!projects.some((p) => p.id === project.id) && projects.length >= 25) {
        get().toast('You can create up to 25 projects.', 'error');
        return false;
      }
      const now = Date.now();
      const files = (project.files || []).filter((f) => f.kind === 'text' && typeof f.text === 'string').slice(0, 5).map((f) => ({ ...f, text: f.text!.slice(0, 20000) }));
      const next = { ...project, files, name: project.name.trim().slice(0, 60), instructions: project.instructions.slice(0, 12000), updatedAt: now };
      if (!next.name) return false;
      const totalText = [...projects.filter((p) => p.id !== project.id), next].reduce((sum, p) => sum + p.instructions.length + (p.files || []).reduce((n, f) => n + (f.text?.length || 0), 0), 0);
      if (totalText > 150_000) {
        get().toast('Project instructions and reference files are limited to 150,000 characters total to keep settings sync small.', 'error');
        return false;
      }
      const updated = projects.some((p) => p.id === next.id) ? projects.map((p) => p.id === next.id ? next : p) : [...projects, { ...next, createdAt: project.createdAt || now }];
      get().updateSettings({ projects: updated });
      return true;
    },
    deleteProject(id) {
      get().updateSettings({ projects: (get().settings.projects || []).filter((p) => p.id !== id) });
      if (get().activeProjectId === id) get().selectProject(null);
      for (const chat of get().chats.filter((c) => c.projectId === id)) {
        const updated = { ...chat, projectId: undefined };
        replaceChat(updated);
        void persist(updated);
      }
    },
    moveChatToProject(chatId, projectId) {
      const chat = get().chats.find((c) => c.id === chatId);
      if (!chat || (projectId && !get().settings.projects?.some((p) => p.id === projectId))) return;
      const updated = { ...chat, projectId: projectId || undefined };
      replaceChat(updated);
      void persist(updated);
    },
    branchChatFrom(chatId, messageId) {
      const chat = get().chats.find((c) => c.id === chatId);
      if (!chat) return;
      const branch = branchChat(chat, messageId, uid());
      if (!branch) return;
      set((s) => ({ chats: [branch, ...s.chats], currentId: branch.id, sidebarOpen: false }));
      void persist(branch);
    },
    setChatTags(chatId, tags) {
      const chat = get().chats.find((c) => c.id === chatId);
      if (!chat) return;
      const unique = normalizeChatTags(tags);
      const updated = { ...chat, tags: unique.length ? unique : undefined };
      replaceChat(updated);
      void persist(updated);
    },

    newChat() {
      clearAssistantDraft();
      set({ canvasOpen: false, canvasDocumentId: null });
      // Reuse an existing empty chat instead of piling them up.
      const projectId = currentProjectId();
      const empty = get().chats.find((c) => c.messages.length === 0 && !c.summary && !c.assistant && !c.documents?.length && c.projectId === projectId);
      if (empty) {
        set({ currentId: empty.id, sidebarOpen: false, settingsOpen: false });
        return;
      }
      const chat = { ...newChatObject(), projectId: projectId || undefined };
      set((s) => ({ chats: [chat, ...s.chats], currentId: chat.id, sidebarOpen: false, settingsOpen: false }));
    },
    startAssistant(value) {
      set({ canvasOpen: false, canvasDocumentId: null });
      const assistant = normalizeAssistant(value);
      if (!assistant) return;
      const { settings, catalog } = get();
      const allowed = assistant.model === AUTO || settings.enabledModels.includes(assistant.model) || (isLayoutId(assistant.model) && findLayout(assistant.model, catalog?.models || [], settings.layouts, settings.hiddenLayouts));
      const chat: Chat = { ...newChatObject(), title: assistant.name, assistant: { ...assistant }, model: allowed ? assistant.model : AUTO, projectId: currentProjectId() || undefined };
      set((state) => ({ chats: [chat, ...state.chats], currentId: chat.id, sidebarOpen: false, settingsOpen: false }));
      void db.put(chat).catch(() => get().toast("Couldn't save the helper chat on this device.", 'error'));
      try { localStorage.setItem(`mr.assistantDraft.${get().user?.uid}`, chat.id); } catch { /* private mode */ }
    },
    selectChat(id) {
      clearAssistantDraft();
      set({ currentId: id, sidebarOpen: false, settingsOpen: false, canvasOpen: false, canvasDocumentId: null });
    },
    async deleteChat(id) {
      if (get().streamingChatId === id) get().stop();
      const removed = get().chats.find((c) => c.id === id);
      const had = removed?.messages.length || removed?.documents?.length;
      set((s) => ({ chats: s.chats.filter((c) => c.id !== id), currentId: s.currentId === id ? null : s.currentId }));
      await db.remove(id);
      if (had) sync?.remove(id);
    },
    async renameChat(id, title) {
      const chat = get().chats.find((c) => c.id === id);
      if (!chat || !title.trim()) return;
      const updated = { ...chat, title: title.trim().slice(0, 100) };
      replaceChat(updated);
      await persist(updated);
    },
    async togglePin(id) {
      const chat = get().chats.find((c) => c.id === id);
      if (!chat) return;
      const updated = { ...chat, pinned: !chat.pinned };
      replaceChat(updated);
      await persist(updated);
    },
    setChatModel(model) {
      get().updateSettings({ defaultModel: model });
      const chat = currentChat();
      if (chat) {
        const updated = { ...chat, model };
        replaceChat(updated);
        void persist(updated);
      }
    },
    async clearAllChats() {
      get().stop();
      const ids = get().chats.filter((c) => c.messages.length || c.documents?.length).map((c) => c.id);
      await db.clear();
      set({ chats: [], currentId: null });
      ids.forEach((id) => sync?.remove(id));
    },
    async importChats(incoming) {
      const valid = incoming.filter((c) => c && typeof c.id === 'string' && Array.isArray(c.messages));
      await db.bulkPut(valid);
      const chats = await db.all();
      set({ chats });
      for (const c of chats) if (valid.some((v) => v.id === c.id)) sync?.push({ ...c, rev: Date.now() });
      return valid.length;
    },

    async runComparison(text, files, models, opts) {
      if (get().comparing || get().streamingChatId || get().compactingChatId || get().canvasEditingChatId) return;
      if (!navigator.onLine) {
        get().toast("You're offline — your message is kept here; send it when you're back online.");
        return;
      }
      const selected = [...new Set(models)].filter((id) => get().settings.enabledModels.includes(id)).slice(0, 3);
      if (selected.length < 2) {
        get().toast('Choose two or three enabled models to compare.', 'error');
        return;
      }
      const chat = currentChat();
      const settings = get().settings;
      const projectId = chat ? chat.projectId : currentProjectId();
      const project = settings.projects?.find((p) => p.id === projectId);
      const projectFiles = project?.files?.filter((f) => Boolean(f.text)) || [];
      const inputWire: WireMessage = {
        role: 'user', text,
        files: files.filter((f) => f.data || f.text).map(({ kind, name, mime, data, text: fileText }) => ({ kind, name, mime, data, text: fileText })),
        asIs: opts?.privacy === 'asIs',
      };
      const wire: WireMessage[] = [
        ...withSummary(chat ? activeSummary(chat) : null, (chat ? liveMessages(chat) : []).filter((m) => !m.error || m.text).map((m) => {
          const usable = (m.files || []).filter((f) => f.data || f.text);
          const missing = (m.files || []).filter((f) => !f.data && !f.text).map((f) => f.name);
          return {
            role: m.role,
            text: missing.length ? `[Attached on another device, not available here: ${missing.join(', ')}]\n${m.text}` : m.text,
            files: usable.map(({ kind, name, mime, data, text: fileText }) => ({ kind, name, mime, data, text: fileText })),
            asIs: m.privacy?.unmasked,
          } as WireMessage;
        })),
        inputWire,
      ];
      const projectTokens = projectFiles.reduce((n, f) => n + Math.ceil((f.text?.length || 0) / 4), 0);
      const lastInput = wire[wire.length - 1];
      if (projectFiles.length) lastInput.files = [...(lastInput.files || []), ...projectFiles.map(({ kind, name, mime, text: fileText }) => ({ kind, name, mime, text: fileText }))];
      const masker = settings.privacyShield ? new Masker() : null;
      if (masker) {
        for (let i = 0; i < wire.length; i++) {
          if (wire[i].asIs) continue;
          wire[i] = { ...wire[i], text: masker.mask(wire[i].text).text, files: wire[i].files?.map((f) => (f.text ? { ...f, text: masker.mask(f.text).text } : f)) };
        }
      }
      let workspace = '';
      if (chat?.repo) {
        const tree = await repoTree(chat.repo).catch(() => null);
        workspace = workspaceInstructions(chat.repo, tree?.files || [], Boolean(tree?.truncated), chat.context || [], '');
      }
      const rawMemory = settings.memory ? memoryInstructions(get().memories, settings.memoryAuto) : '';
      const custom = [settings.customInstructions, project?.instructions, chat?.assistant?.instructions].filter(Boolean).join('\n\n');
      const restore = (value: string) => masker && settings.privacyRestore ? masker.unmask(value) : value;
      const bodyFor = (model: string) => buildChatBody({
        model, fallbacks: [], messages: wire,
        options: {
          search: settings.webSearch,
          customInstructions: masker ? masker.mask(custom).text : custom,
          memory: masker ? masker.mask(rawMemory).text : rawMemory,
          workspace,
          conversationTokens: (chat ? contextTokens(chat) : 0) + projectTokens,
        },
      });
      const comparisonId = uid();
      set({
        comparing: true,
        comparison: { id: comparisonId, chatId: chat?.id || null, projectId: projectId || undefined, prompt: text, files: files.length ? files : undefined, privacyAsIs: opts?.privacy === 'asIs', answers: selected.map((model) => ({ model, text: '', status: 'loading' })) },
      });
      const aborter = new AbortController();
      compareController = aborter;
      const updateAnswer = (model: string, patch: Partial<ComparisonState['answers'][number]>) => set((s) => s.comparison?.id === comparisonId ? ({ comparison: { ...s.comparison, answers: s.comparison.answers.map((a) => a.model === model ? { ...a, ...patch } : a) } }) : {});
      try {
        await Promise.all(selected.map(async (model) => {
          let textOut = '';
          let error = '';
          let sources: NonNullable<ComparisonState['answers'][number]['sources']> = [];
          try {
            for await (const ev of streamChat(bodyFor(model), aborter.signal)) {
              if (ev.t === 'unavailable') hideUnavailableModel(ev.id);
              else if (ev.t === 'request') usage?.record(ev.id, { requests: 1 });
              else if (ev.t === 'usage') usage?.record(ev.id, { input: ev.input, output: ev.output });
              else if (ev.t === 'limit') usage?.block(ev.id, ev as unknown as LimitInfo);
              else if (ev.t === 'text') textOut += ev.text;
              else if (ev.t === 'sources') sources = [...sources, ...ev.items];
              else if (ev.t === 'error') error = ev.text;
              updateAnswer(model, { text: restore(hideMemoryLines(textOut)), ...(sources.length ? { sources } : {}) });
            }
            updateAnswer(model, { status: textOut ? 'done' : aborter.signal.aborted ? 'stopped' : 'error', ...(error && !textOut ? { error } : !textOut ? { error: 'No answer was returned.' } : {}) });
          } catch (e) {
            updateAnswer(model, { status: (e as Error).name === 'AbortError' ? 'stopped' : 'error', error: (e as Error).name === 'AbortError' ? undefined : (e as Error).message });
          }
        }));
      } finally {
        if (compareController === aborter) compareController = null;
        if (get().comparison?.id === comparisonId) set({ comparing: false });
      }
    },
    cancelComparison() {
      compareController?.abort();
      set((s) => ({ comparing: false, comparison: s.comparison ? { ...s.comparison, answers: s.comparison.answers.map((a) => a.status === 'loading' ? { ...a, status: 'stopped' } : a) } : null }));
    },
    clearComparison() {
      compareController?.abort();
      compareController = null;
      set({ comparing: false, comparison: null });
    },
    saveComparisonAnswer(model) {
      const comparison = get().comparison;
      const answer = comparison?.answers.find((a) => a.model === model && a.status === 'done');
      if (!comparison || !answer) return;
      const original = comparison.chatId ? get().chats.find((c) => c.id === comparison.chatId) : undefined;
      const chat = original || { ...newChatObject(), projectId: comparison.projectId };
      const userMessage: Message = { id: uid(), role: 'user', text: comparison.prompt, files: comparison.files, createdAt: Date.now(), ...(comparison.privacyAsIs ? { privacy: { masked: 0, unmasked: true } } : {}) };
      if (!comparison.privacyAsIs && get().settings.privacyShield) {
        const count = scan(comparison.prompt).length + (comparison.files || []).reduce((n, f) => n + (f.text ? scan(f.text).length : 0), 0);
        if (count) userMessage.privacy = { masked: count };
      }
      const assistant: Message = { id: uid(), role: 'assistant', text: answer.text, model: answer.model, status: 'done', sources: answer.sources, createdAt: Date.now() };
      const title = chat.messages.length ? chat.title : comparison.prompt.replace(/\s+/g, ' ').slice(0, 60) || 'Model comparison';
      const updated = { ...chat, title, model: answer.model, messages: [...chat.messages, userMessage, assistant], updatedAt: Date.now() };
      replaceChat(updated);
      set({ currentId: updated.id });
      void persist(updated);
      get().clearComparison();
    },

    async send(text, files, opts) {
      if (get().streamingChatId || get().compactingChatId || get().comparing || get().canvasEditingChatId) return;
      let chat = currentChat();
      if (!chat) {
        chat = { ...newChatObject(), projectId: currentProjectId() || undefined };
        set((s) => ({ chats: [chat!, ...s.chats], currentId: chat!.id }));
      }
      const ownFiles = files.some((f) => f.kind === 'text');
      // Coding workspace: attached repository files go along when they're new or have changed.
      let contextSent = chat.contextSent;
      if (chat.repo && chat.context?.length) {
        const fresh: string[] = [];
        const prints: Record<string, string> = { ...(chat.contextSent || {}) };
        for (const path of chat.context) {
          const t = await currentFile(chat, path).catch(() => null);
          if (t === null) continue;
          const fp = fingerprint(t);
          if (prints[path] !== fp) fresh.push(path);
          prints[path] = fp;
        }
        if (fresh.length) {
          const extra = await filesAsAttachments(chat, fresh);
          files = [...extra.files, ...files];
        }
        contextSent = prints;
      }
      // Coding workspace: files this request is clearly about go along, so the model starts informed.
      if (chat.repo && text.trim() && !ownFiles && !text.trim().startsWith('/')) {
        const tree = await repoTree(chat.repo).catch(() => null);
        if (tree) {
          const seen = seenPaths(chat);
          const paths = relevantFiles(text, tree.files, await indexSoon(chat.repo, 3000)).filter((p) => !seen.has(p));
          if (paths.length) files = [...(await filesAsAttachments(chat, paths)).files.map((f) => ({ ...f, auto: true })), ...files];
        }
      }
      const msg: Message = { id: uid(), role: 'user', text, files: files.length ? files : undefined, createdAt: Date.now() };
      if (get().settings.privacyShield) {
        const found = scan(text).length + files.reduce((n, f) => n + (f.text ? scan(f.text).length : 0), 0);
        if (opts?.privacy === 'asIs') msg.privacy = { masked: 0, unmasked: true };
        else if (found) msg.privacy = { masked: found };
      }
      const title = chat.messages.length === 0 && !chat.summary ? (text || files.map((f) => f.name).join(', ')).replace(/\s+/g, ' ').slice(0, 60) || 'New chat' : chat.title;
      const updated: Chat = { ...chat, title, model: chat.model || modelFor(chat), messages: [...chat.messages, msg], updatedAt: Date.now(), ...(contextSent ? { contextSent } : {}) };
      replaceChat(updated);
      await persist(updated);
      await runAssistant(updated.id);
    },

    connectRepo(link) {
      let chat = currentChat();
      // A chat already working on another repo keeps it; start a fresh chat for this one.
      if (!chat || (chat.repo && (chat.repo.owner !== link.owner || chat.repo.repo !== link.repo))) {
        chat = { ...newChatObject(), projectId: currentProjectId() || undefined };
        set((s) => ({ chats: [chat!, ...s.chats], currentId: chat!.id }));
      }
      const switching = chat.repo && chat.repo.branch !== link.branch;
      const updated: Chat = { ...chat, repo: link, context: switching ? [] : chat.context || [], contextSent: switching ? {} : chat.contextSent, changes: switching ? {} : chat.changes || {}, rev: Date.now() };
      replaceChat(updated);
      void persist(updated);
      void repoIndex(link).catch(() => {});
      set({ workspaceOpen: true });
      set({ canvasOpen: false });
    },
    disconnectRepo() {
      const chat = currentChat();
      if (!chat?.repo) return;
      const updated: Chat = { ...chat, repo: undefined, context: undefined, contextSent: undefined, changes: undefined };
      replaceChat(updated);
      void persist(updated);
      set({ workspaceOpen: false });
    },
    setContext(chatId, paths) {
      const chat = get().chats.find((c) => c.id === chatId);
      if (!chat) return;
      const updated = { ...chat, context: [...new Set(paths)].slice(0, 50) };
      replaceChat(updated);
      void persist(updated);
    },
    async saveChange(chatId, path, content) {
      const chat = get().chats.find((c) => c.id === chatId);
      if (!chat?.repo) return;
      const original = chat.changes?.[path] ? chat.changes[path].original : await originalFile(chat.repo, path).catch(() => null);
      const latest = get().chats.find((c) => c.id === chatId)!;
      const changes: Record<string, FileChange> = { ...(latest.changes || {}) };
      if (content === original) delete changes[path];
      else changes[path] = { content, original };
      const updated = { ...latest, changes };
      replaceChat(updated);
      void persist(updated);
    },
    async loadRepoFiles(chatId, paths, searches = []) {
      const chat = get().chats.find((c) => c.id === chatId);
      if (!chat?.repo || (!paths.length && !searches.length) || get().streamingChatId) return;
      const { files, missing } = await filesAsAttachments(chat, paths);
      const results = searches.length ? await repoIndex(chat.repo).then((index) => searches.map((q) => searchCode(chat, index, q)), () => []) : [];
      const parts = [
        ...results.map((r) => r.text),
        missing.length ? `Couldn't find ${missing.join(', ')} — use exact paths from the file list.${files.length ? ' Here are the others.' : ''}` : '',
        searches.length && !results.length ? "The code couldn't be searched right now." : '',
        files.length || results.length ? (files.length ? 'Here are the files you asked for. Continue.' : 'Continue: read the files you need, or make the change.') : '',
      ];
      const msg: Message = {
        id: uid(),
        role: 'user',
        auto: 'files',
        text: parts.filter(Boolean).join('\n\n'),
        files: files.length ? files : undefined,
        ...(results.length ? { searches: results.map((r) => ({ query: r.query, count: r.count })) } : {}),
        createdAt: Date.now(),
      };
      const latest = get().chats.find((c) => c.id === chatId) || chat;
      const next = { ...latest, messages: [...latest.messages, msg], updatedAt: Date.now() };
      replaceChat(next);
      await persist(next);
      await runAssistant(chatId);
    },

    dismissChecks(chatId) {
      const chat = get().chats.find((c) => c.id === chatId);
      if (!chat?.lastCommit) return;
      const updated = { ...chat, lastCommit: { ...chat.lastCommit, dismissed: true } };
      replaceChat(updated);
      void persist(updated);
    },

    revertChange(chatId, path) {
      const chat = get().chats.find((c) => c.id === chatId);
      if (!chat?.changes?.[path]) return;
      const changes = { ...chat.changes };
      delete changes[path];
      const updated = { ...chat, changes };
      replaceChat(updated);
      void persist(updated);
    },
    async applyEdits(chatId, edits) {
      let applied = 0;
      const failed: string[] = [];
      for (const edit of edits) {
        const chat = get().chats.find((c) => c.id === chatId);
        if (!chat?.repo) break;
        const before = await currentFile(chat, edit.path).catch(() => null);
        if (isApplied(before, edit)) continue; // already done (e.g. applied on its own before "Apply all")
        const result = applyEdit(before, edit);
        if (!result.ok) {
          failed.push(edit.path);
          continue;
        }
        await get().saveChange(chatId, edit.path, 'deleted' in result && result.deleted ? null : result.text);
        applied++;
      }
      return { applied, failed };
    },
    async commitWork(chatId, o) {
      const chat = get().chats.find((c) => c.id === chatId);
      if (!chat?.repo || !chat.changes || !Object.keys(chat.changes).length) throw new Error('There are no changes to commit.');
      const repo = chat.repo;
      const changes = Object.entries(chat.changes).map(([path, c]) => ({ path, content: c.content }));
      const target = o.target.trim() || repo.branch;
      const { url, sha } = await ghCommit({ owner: repo.owner, repo: repo.repo, base: repo.branch, target, message: o.message.trim() || 'Update from Model Router', changes });
      let prUrl: string | undefined;
      if (o.pullRequest && target !== repo.branch) {
        prUrl = await openPullRequest({ owner: repo.owner, repo: repo.repo, head: target, base: repo.branch, title: o.message.split('\n')[0].slice(0, 120) || 'Changes from Model Router', body: 'Made with Model Router.' });
      }
      forgetRepo(repo);
      forgetIndex(repo);
      const latest = get().chats.find((c) => c.id === chatId)!;
      // Keep working on the branch that now has these commits.
      const updated: Chat = { ...latest, changes: {}, repo: { ...repo, branch: target, defaultBranch: repo.defaultBranch || repo.branch }, lastCommit: { sha, url, branch: target, prUrl, at: Date.now() } };
      replaceChat(updated);
      await persist(updated);
      return { url, prUrl };
    },

    async regenerate(messageId, model) {
      const chat = currentChat();
      if (!chat || get().streamingChatId || get().canvasEditingChatId) return;
      const idx = chat.messages.findIndex((m) => m.id === messageId);
      if (idx < 0) return;
      const kept = chat.messages.slice(0, idx);
      const updated = { ...chat, model: model || chat.model, messages: kept, summary: dropStale(chat.summary, kept) };
      replaceChat(updated);
      if (model) get().updateSettings({ defaultModel: model });
      await runAssistant(chat.id, model);
    },

    async editAndResend(messageId, text) {
      const chat = currentChat();
      if (!chat || get().streamingChatId || get().canvasEditingChatId) return;
      const idx = chat.messages.findIndex((m) => m.id === messageId);
      if (idx < 0) return;
      const edited = { ...chat.messages[idx], text };
      // An edited message can't stay inside the summary.
      const updated = { ...chat, messages: [...chat.messages.slice(0, idx), edited], summary: dropStale(chat.summary, chat.messages.slice(0, idx)) };
      replaceChat(updated);
      await persist(updated);
      await runAssistant(chat.id);
    },

    async continueReply() {
      await get().send('Continue exactly where you stopped.', []);
    },

    async compact(chatId) {
      const id = chatId || get().currentId;
      if (!id || get().streamingChatId || get().compactingChatId) return;
      if ((await compactChat(id, true)) === 'done') get().toast('Chat compacted. Older messages are now sent as a summary.', 'success');
    },

    async undoCompact(chatId) {
      const chat = get().chats.find((c) => c.id === chatId);
      if (!chat?.summary || get().streamingChatId) return;
      const updated = { ...chat, summary: undefined };
      replaceChat(updated);
      await persist(updated);
      get().toast('Summary removed — the full chat will be sent again.');
    },

    async continueInNewChat(chatId) {
      const chat = get().chats.find((c) => c.id === chatId);
      if (!chat || get().streamingChatId || get().compactingChatId) return;
      const live = liveMessages(chat);
      if (!live.length) return;
      compactController = new AbortController();
      set({ compactingChatId: chatId });
      try {
        const out = await writeSummary(chat, live.length, compactController.signal);
        if (compactController.signal.aborted) return;
        if (!out) {
          get().toast("Couldn't summarize this chat right now. Try again in a minute.", 'error');
          return;
        }
        const next: Chat = {
          ...newChatObject(),
          title: `${chat.title} (continued)`.slice(0, 100),
          model: chat.model,
          assistant: chat.assistant,
          projectId: chat.projectId,
          documents: chat.documents?.map(doc => ({ ...doc })),
          summary: { ...out.summary, upTo: null, from: chat.title, saved: Math.max(0, contextTokens(chat) - Math.ceil(out.summary.text.length / 4)) },
        };
        set((s) => ({ chats: [next, ...s.chats.filter((c) => !(c.messages.length === 0 && !c.summary && !c.documents?.length))], currentId: next.id, sidebarOpen: false }));
      } catch {
        if (!compactController?.signal.aborted) get().toast("Couldn't summarize this chat right now.", 'error');
      } finally {
        compactController = null;
        set({ compactingChatId: null });
      }
    },

    stop() {
      canvasController?.abort();
      controller?.abort();
      compactController?.abort();
      get().cancelComparison();
    },

    async addMemory(text) {
      if (!memory || !text.trim()) return;
      if (findMemory(get().memories, text)) {
        get().toast('Already in memory.');
        return;
      }
      if (get().memories.length >= MAX_MEMORIES) {
        get().toast(`Memory is full (${MAX_MEMORIES}). Delete some in Settings → Memory.`, 'error');
        return;
      }
      try {
        const m = await memory.add(text);
        set((s) => ({ memories: [m, ...s.memories.filter((x) => x.id !== m.id)] }));
        get().toast('Saved to memory.', 'success');
      } catch (e) {
        get().toast(`Couldn't save: ${(e as Error).message}`, 'error');
      }
    },
    async updateMemory(id, text) {
      if (!memory || !text.trim()) return;
      await memory.update(id, text).catch((e) => get().toast(`Couldn't save: ${(e as Error).message}`, 'error'));
    },
    async deleteMemory(id) {
      if (!memory) return;
      set((s) => ({ memories: s.memories.filter((m) => m.id !== id) }));
      await memory.remove(id).catch((e) => get().toast(`Couldn't delete: ${(e as Error).message}`, 'error'));
    },
    async clearMemories() {
      if (!memory) return;
      const ids = get().memories.map((m) => m.id);
      set({ memories: [] });
      await memory.clear(ids).catch((e) => get().toast(`Couldn't clear memory: ${(e as Error).message}`, 'error'));
    },
  };
});

/** Keeps a summary only if everything it covers is still in the chat. */
function dropStale(summary: ChatSummary | undefined, kept: Message[]): ChatSummary | undefined {
  if (!summary || summary.upTo === null) return summary;
  return kept.some((m) => m.id === summary.upTo) ? summary : undefined;
}

export const selectCurrentChat = (s: State) => s.chats.find((c) => c.id === s.currentId) || null;

export function modelInfo(catalog: Catalog | null, id?: string): ModelInfo | undefined {
  return catalog?.models.find((m) => m.id === id);
}

export function modelLabel(catalog: Catalog | null, id?: string): string {
  if (id === AUTO) return 'Auto';
  if (isLayoutId(id)) return findLayout(id, catalog?.models || [], useStore.getState().settings.layouts, useStore.getState().settings.hiddenLayouts)?.name || 'Layout';
  return modelInfo(catalog, id)?.label || modelShortName(id);
}

