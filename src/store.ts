import { create } from 'zustand';
import { setKeys } from './lib/ai/providers.js';
import { buildChatBody, fetchCatalog, fetchTitle, streamChat, type WireMessage } from './lib/api';
import { loadKeys, loadRemoteSettings, saveKeys, saveRemoteSettings, signInWithGoogle, signOutUser, watchUser, type ApiKeys } from './lib/firebase';
import { ChatSync } from './lib/sync';
import { db } from './lib/db';
import { applyAppearance, loadSettings, saveSettings } from './lib/settings';
import { modelShortName, uid } from './lib/util';
import type { Attachment, Catalog, Chat, Message, ModelInfo, Settings } from './types';

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
  keys: ApiKeys;
  catalog: Catalog | null;
  catalogError: string | null;
  settings: Settings;
  chats: Chat[];
  currentId: string | null;
  streamingChatId: string | null;
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
  stop(): void;
}

let controller: AbortController | null = null;
let sync: ChatSync | null = null;
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
    const pick = [chat?.model, settings.defaultModel, ...enabled].find((id) => id && enabled.includes(id));
    return pick || enabled[0] || catalog?.defaults[0] || '';
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
    const fallbacks = settings.autoSwitch ? settings.enabledModels.filter((id) => id !== model) : [];
    const wire: WireMessage[] = chat.messages
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
      });

    let body: string;
    try {
      body = buildChatBody({ model, fallbacks, messages: wire, options: { search: settings.webSearch, customInstructions: settings.customInstructions } });
    } catch (e) {
      get().toast((e as Error).message, 'error');
      return;
    }

    const reply: Message = { id: uid(), role: 'assistant', text: '', model, status: 'streaming', createdAt: Date.now() };
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

    try {
      for await (const ev of streamChat(body, controller.signal)) {
        if (ev.t === 'text') reply.text += ev.text;
        else if (ev.t === 'think') reply.thinking = (reply.thinking || '') + ev.text;
        else if (ev.t === 'model') reply.model = ev.id;
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
    flush();
    set({ streamingChatId: null });
    const finished = get().chats.find((c) => c.id === chatId);
    if (!finished) return;
    const updated = { ...finished, updatedAt: Date.now() };
    replaceChat(updated);
    await persist(updated);

    // Name the chat after its first exchange.
    const firstUser = updated.messages.find((m) => m.role === 'user');
    if (get().settings.autoTitle && updated.messages.length <= 2 && firstUser && reply.status === 'done') {
      const title = await fetchTitle(firstUser.text || firstUser.files?.map((f) => f.name).join(', ') || '', reply.model);
      const latest = get().chats.find((c) => c.id === chatId);
      if (title && latest) {
        const named = { ...latest, title };
        replaceChat(named);
        await persist(named);
      }
    }
  };

  return {
    authed: null,
    user: null,
    keys: { gemini: '', openrouter: '' },
    catalog: null,
    catalogError: null,
    settings: loadSettings(),
    chats: [],
    currentId: null,
    streamingChatId: null,
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
        settingsReady = false;
        if (!user) {
          setKeys({ gemini: '', openrouter: '' });
          set({ authed: false, user: null, catalog: null });
          return;
        }
        set({ authed: true, user: { uid: user.uid, email: user.email || '', name: user.displayName || '', photo: user.photoURL || '' } });
        try {
          const [keys, remoteSettings] = await Promise.all([loadKeys(user.uid), loadRemoteSettings(user.uid)]);
          setKeys(keys);
          set({ keys });
          if (remoteSettings) get().updateSettings({ ...remoteSettings, voiceLang: get().settings.voiceLang } as Partial<Settings>);
          settingsReady = true;
          if (!remoteSettings) get().updateSettings({});
        } catch (e) {
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
        const { settings } = get();
        const known = new Set(catalog.models.map((m) => m.id));
        let enabled = settings.enabledModels.filter((id) => known.has(id) || !catalog.models.length);
        if (!enabled.length) enabled = catalog.defaults.filter((id) => known.has(id) || !catalog.models.length);
        const defaultModel = enabled.includes(settings.defaultModel) ? settings.defaultModel : enabled[0] || '';
        set({ catalog, catalogError: catalog.errors.length ? catalog.errors.join(' · ') : null });
        get().updateSettings({ enabledModels: enabled, defaultModel });
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
      const empty = get().chats.find((c) => c.messages.length === 0);
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
      if (get().streamingChatId) return;
      let chat = currentChat();
      if (!chat) {
        chat = newChatObject();
        set((s) => ({ chats: [chat!, ...s.chats], currentId: chat!.id }));
      }
      const msg: Message = { id: uid(), role: 'user', text, files: files.length ? files : undefined, createdAt: Date.now() };
      const title = chat.messages.length === 0 ? (text || files.map((f) => f.name).join(', ')).replace(/\s+/g, ' ').slice(0, 60) || 'New chat' : chat.title;
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
      const updated = { ...chat, model: model || chat.model, messages: chat.messages.slice(0, idx) };
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
      const updated = { ...chat, messages: [...chat.messages.slice(0, idx), edited] };
      replaceChat(updated);
      await persist(updated);
      await runAssistant(chat.id);
    },

    async continueReply() {
      await get().send('Continue exactly where you stopped.', []);
    },

    stop() {
      controller?.abort();
    },
  };
});

export const selectCurrentChat = (s: State) => s.chats.find((c) => c.id === s.currentId) || null;

export function modelInfo(catalog: Catalog | null, id?: string): ModelInfo | undefined {
  return catalog?.models.find((m) => m.id === id);
}

export function modelLabel(catalog: Catalog | null, id?: string): string {
  return modelInfo(catalog, id)?.label || modelShortName(id);
}
