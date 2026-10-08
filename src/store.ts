import { create } from 'zustand';
import { openRouterDailyLimit, setKeys } from './lib/ai/providers.js';
import { buildChatBody, fetchCatalog, fetchSummary, fetchTitle, streamChat, type WireMessage } from './lib/api';
import { activeSummary, compactLimit, contextTokens, cutPoint, liveMessages, summaryPrompt, withSummary } from './lib/compact';
import { loadKeys, loadRemoteSettings, saveKeys, saveRemoteSettings, signInWithGoogle, signOutUser, watchUser, type ApiKeys } from './lib/firebase';
import { ChatSync } from './lib/sync';
import { extractMemoryOps, findMemory, hideMemoryLines, MAX_MEMORIES, memoryInstructions, MemoryStore } from './lib/memory';
import { AUTO, planRoute } from './lib/routing';
import { formatUntil, remaining, UsageTracker, type LimitInfo, type UsageView } from './lib/usage';
import { db } from './lib/db';
import { applyAppearance, loadSettings, saveSettings } from './lib/settings';
import { modelShortName, uid } from './lib/util';
import type { Attachment, Catalog, Chat, ChatSummary, Memory, Message, ModelInfo, Settings } from './types';

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
  catalogError: string | null;
  settings: Settings;
  chats: Chat[];
  currentId: string | null;
  streamingChatId: string | null;
  /** chat whose older messages are being summarized right now */
  compactingChatId: string | null;
  sidebarOpen: boolean;
  settingsOpen: boolean;
  settingsTab: string;
  preview: PreviewFile | null;
  toasts: Toast[];

  init(): Promise<void>;
  login(): Promise<void>;
  logout(): void;
  saveApiKeys(keys: ApiKeys): Promise<void>;
  loadCatalog(): Promise<void>;
  updateSettings(patch: Partial<Settings>): void;
  toast(text: string, kind?: Toast['kind']): void;
  dismissToast(id: string): void;
  setUi(patch: Partial<Pick<State, 'sidebarOpen' | 'settingsOpen' | 'settingsTab' | 'preview'>>): void;

  newChat(): void;
  selectChat(id: string): void;
  deleteChat(id: string): Promise<void>;
  renameChat(id: string, title: string): Promise<void>;
  togglePin(id: string): Promise<void>;
  setChatModel(model: string): void;
  clearAllChats(): Promise<void>;
  importChats(chats: Chat[]): Promise<number>;

  send(text: string, files: Attachment[]): Promise<void>;
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
let compactController: AbortController | null = null;
let sync: ChatSync | null = null;
let usage: UsageTracker | null = null;
let memory: MemoryStore | null = null;
let settingsReady = false;
let settingsTimer: ReturnType<typeof setTimeout> | undefined;

const newChatObject = (): Chat => ({ id: uid(), title: 'New chat', createdAt: Date.now(), updatedAt: Date.now(), messages: [] });

export const useStore = create<State>((set, get) => {
  const replaceChat = (chat: Chat) => set((s) => ({ chats: s.chats.some((c) => c.id === chat.id) ? s.chats.map((c) => (c.id === chat.id ? chat : c)) : [chat, ...s.chats] }));
  /** Saves a chat on this device and sends the change to your other devices. */
  const persist = async (chat: Chat) => {
    if (!chat.messages.length) return;
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

  /** The model this chat should use, falling back sensibly if it was disabled. */
  const modelFor = (chat: Chat | null): string => {
    const { settings, catalog } = get();
    const enabled = settings.enabledModels.filter((id) => !catalog || catalog.models.some((m) => m.id === id) || !catalog.models.length);
    const pick = [chat?.model, settings.defaultModel, ...enabled].find((id) => id && (id === AUTO || enabled.includes(id)));
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
    const prompt = summaryPrompt(older, previous);
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
        text: result.text.slice(0, 60_000),
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
  const applyMemoryLines = async (reply: Message, raw: string, chatId: string) => {
    const ops = extractMemoryOps(raw);
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
    const model = modelOverride || modelFor(chat);
    if (!model) {
      get().toast('No models are enabled. Open Settings → Models.', 'error');
      return;
    }
    // Long chat: summarize the older messages first so the model gets a compact version.
    if (settings.autoCompact && contextTokens(chat) > compactLimit(model === AUTO ? undefined : modelInfo(get().catalog, model))) {
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
      enabled: settings.enabledModels,
      catalog: get().catalog?.models || [],
      text: lastUser?.text || '',
      files: lastUser?.files || [],
      conversationTokens: contextTokens(chat),
      search: settings.webSearch,
      blocked,
      left: (id) => remaining(get().usage, id),
    });
    let chosen = plan.model;
    if (!chosen) {
      get().toast('No models are enabled. Open Settings → Models.', 'error');
      return;
    }
    let fallbacks = settings.autoSwitch ? plan.fallbacks : [];
    const preNotices: string[] = plan.notice ? [plan.notice] : [];
    if (settings.autoSwitch && blocked(chosen)) {
      const next = fallbacks.find((id) => !blocked(id));
      if (next) {
        if (model !== AUTO) preNotices.push(`${modelLabel(get().catalog, chosen)} reached its limit (available again ${formatUntil(usage!.blockedUntil(chosen)!)}) — using ${modelLabel(get().catalog, next)}.`);
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
        };
      }));

    let body: string;
    try {
      const memoryNote = settings.memory ? memoryInstructions(get().memories, settings.memoryAuto) : '';
      body = buildChatBody({ model: chosen, fallbacks, messages: wire, options: { search: settings.webSearch, customInstructions: settings.customInstructions, memory: memoryNote } });
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
          reply.text = hideMemoryLines(raw);
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
    if (raw) await applyMemoryLines(reply, raw, chatId);
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
      const result = await fetchTitle(firstUser.text || firstUser.files?.map((f) => f.name).join(', ') || '', reply.model, (id) => (usage?.blockedUntil(id) ?? null) !== null);
      if (result) usage?.record(result.model, { requests: 1 });
      const latest = get().chats.find((c) => c.id === chatId);
      if (result && latest) {
        const named = { ...latest, title: result.title };
        replaceChat(named);
        await persist(named);
      }
    }
  };

  return {
    authed: null,
    user: null,
    accessDenied: null,
    keys: { gemini: '', openrouter: '' },
    catalog: null,
    usage: null,
    memories: [],
    catalogError: null,
    settings: loadSettings(),
    chats: [],
    currentId: null,
    streamingChatId: null,
    compactingChatId: null,
    sidebarOpen: false,
    settingsOpen: false,
    settingsTab: 'general',
    preview: null,
    toasts: [],

    async init() {
      applyAppearance(get().settings);
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
        settingsReady = false;
        if (!user) {
          setKeys({ gemini: '', openrouter: '' });
          set({ authed: false, user: null, catalog: null, accessDenied: null });
          return;
        }
        // Stay on the loading screen until we know this account is invited.
        set({ authed: null, accessDenied: null, user: { uid: user.uid, email: user.email || '', name: user.displayName || '', photo: user.photoURL || '' } });
        try {
          const [keys, remoteSettings] = await Promise.all([loadKeys(user.uid), loadRemoteSettings(user.uid)]);
          setKeys(keys);
          set({ keys, authed: true });
          if (remoteSettings) get().updateSettings({ ...remoteSettings, voiceLang: get().settings.voiceLang } as Partial<Settings>);
          settingsReady = true;
          if (!remoteSettings) get().updateSettings({});
        } catch (e) {
          // The database refuses accounts that aren't invited.
          if ((e as { code?: string }).code === 'permission-denied') {
            set({ authed: true, accessDenied: user.email || 'this account', catalog: null });
            return;
          }
          set({ authed: true });
          get().toast(`Couldn't load your settings: ${(e as Error).message}`, 'error');
        }
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

    logout() {
      get().stop();
      void signOutUser();
    },

    async saveApiKeys(keys) {
      const uid = get().user?.uid;
      if (!uid) return;
      await saveKeys(uid, keys);
      setKeys(keys);
      set({ keys: { gemini: keys.gemini.trim(), openrouter: keys.openrouter.trim() } });
      await get().loadCatalog();
    },

    async loadCatalog() {
      const { keys } = get();
      if (!keys.gemini && !keys.openrouter) {
        set({ catalog: null, catalogError: null, settingsOpen: true, settingsTab: 'keys' });
        return;
      }
      try {
        const catalog = await fetchCatalog();
        void openRouterDailyLimit().then((n) => usage?.setOpenRouterDaily(n));
        const { settings } = get();
        const known = new Set(catalog.models.map((m) => m.id));
        let enabled = settings.enabledModels.filter((id) => known.has(id) || !catalog.models.length);
        if (!enabled.length) enabled = catalog.defaults.filter((id) => known.has(id) || !catalog.models.length);
        // New chats use Auto (introduced once; you can switch back to a fixed model any time).
        const wanted = settings.autoIntroduced ? settings.defaultModel : AUTO;
        const defaultModel = wanted === AUTO || enabled.includes(wanted) ? wanted : enabled[0] || '';
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
      set({ settings });
      // Share settings with your other devices (voice language stays per device).
      const uid = get().user?.uid;
      if (uid && settingsReady) {
        clearTimeout(settingsTimer);
        settingsTimer = setTimeout(() => {
          const { voiceLang: _voice, ...shared } = get().settings;
          saveRemoteSettings(uid, shared).catch(() => {});
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
      set(patch);
    },

    newChat() {
      // Reuse an existing empty chat instead of piling them up.
      const empty = get().chats.find((c) => c.messages.length === 0 && !c.summary);
      if (empty) {
        set({ currentId: empty.id, sidebarOpen: false });
        return;
      }
      const chat = newChatObject();
      set((s) => ({ chats: [chat, ...s.chats], currentId: chat.id, sidebarOpen: false }));
    },
    selectChat(id) {
      set({ currentId: id, sidebarOpen: false });
    },
    async deleteChat(id) {
      if (get().streamingChatId === id) get().stop();
      const had = get().chats.find((c) => c.id === id)?.messages.length;
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
      const ids = get().chats.filter((c) => c.messages.length).map((c) => c.id);
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

    async send(text, files) {
      if (get().streamingChatId || get().compactingChatId) return;
      let chat = currentChat();
      if (!chat) {
        chat = newChatObject();
        set((s) => ({ chats: [chat!, ...s.chats], currentId: chat!.id }));
      }
      const msg: Message = { id: uid(), role: 'user', text, files: files.length ? files : undefined, createdAt: Date.now() };
      const title = chat.messages.length === 0 && !chat.summary ? (text || files.map((f) => f.name).join(', ')).replace(/\s+/g, ' ').slice(0, 60) || 'New chat' : chat.title;
      const updated: Chat = { ...chat, title, model: chat.model || modelFor(chat), messages: [...chat.messages, msg], updatedAt: Date.now() };
      replaceChat(updated);
      await persist(updated);
      await runAssistant(updated.id);
    },

    async regenerate(messageId, model) {
      const chat = currentChat();
      if (!chat || get().streamingChatId) return;
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
      if (!chat || get().streamingChatId) return;
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
          summary: { ...out.summary, upTo: null, from: chat.title, saved: Math.max(0, contextTokens(chat) - Math.ceil(out.summary.text.length / 4)) },
        };
        set((s) => ({ chats: [next, ...s.chats.filter((c) => !(c.messages.length === 0 && !c.summary))], currentId: next.id, sidebarOpen: false }));
      } catch {
        if (!compactController?.signal.aborted) get().toast("Couldn't summarize this chat right now.", 'error');
      } finally {
        compactController = null;
        set({ compactingChatId: null });
      }
    },

    stop() {
      controller?.abort();
      compactController?.abort();
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
  return modelInfo(catalog, id)?.label || modelShortName(id);
}
