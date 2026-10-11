export type Role = 'user' | 'assistant';

export interface Attachment {
  id: string;
  kind: 'image' | 'pdf' | 'text';
  name: string;
  mime: string;
  size: number;
  /** base64 without the data: prefix (images and PDFs) */
  data?: string;
  /** extracted text (Word, Excel, PowerPoint, text files, large PDFs) */
  text?: string;
  /** small data: URL thumbnail for images */
  thumb?: string;
  /** a repository file the app attached because the request is about it */
  auto?: boolean;
}

export interface Source {
  title: string;
  url: string;
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  files?: Attachment[];
  model?: string;
  /** why Auto picked this model, e.g. "reads images" */
  route?: string;
  /** the layout that answered, e.g. "Max coding" */
  via?: string;
  /** added by the app, not typed by you: repository files a model asked to read */
  auto?: 'files';
  /** code searches the app ran for the model (shown on the auto message) */
  searches?: { query: string; count: number }[];
  thinking?: string;
  sources?: Source[];
  notices?: string[];
  error?: string;
  /** privacy shield: how many details were masked, or that it was sent as is */
  privacy?: { masked: number; unmasked?: boolean };
  /** memories this reply saved or removed */
  memory?: { saved?: { id: string; text: string }[]; forgotten?: string[] };
  status?: 'streaming' | 'done' | 'stopped' | 'error';
  createdAt: number;
}

export interface Chat {
  documents?: CanvasDocument[];
  /** Snapshot: editing/deleting a saved helper never changes this chat's instructions. */
  assistant?: SavedAssistant;
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  tags?: string[];
  model?: string;
  /** Project workspace this chat belongs to. */
  projectId?: string;
  /** last change time on any device, used for syncing (unlike updatedAt it also moves on rename/pin) */
  rev?: number;
  /** a summary that stands in for older messages when the chat gets long */
  summary?: ChatSummary;
  /** coding workspace: the GitHub repository this chat works on */
  repo?: RepoLink;
  /** files included with every message (repository paths) */
  context?: string[];
  /** content fingerprints of context files already sent, so unchanged ones aren't sent again */
  contextSent?: Record<string, string>;
  /** edits not committed yet (kept on this device): path → new text (null = deleted) */
  changes?: Record<string, FileChange>;
  /** coding workspace: the last commit made from this chat (its test results are shown) */
  lastCommit?: { sha: string; url: string; branch: string; prUrl?: string; at: number; dismissed?: boolean };
  messages: Message[];
}

export interface Project {
  id: string;
  name: string;
  instructions: string;
  defaultModel?: string;
  /** Text-extracted references included with every message in the project. */
  files?: Attachment[];
  createdAt: number;
  updatedAt: number;
}

export interface SavedAssistant {
  id: string;
  name: string;
  description: string;
  instructions: string;
  model: string;
}

export interface CanvasDocument {
  id: string;
  name: string;
  content: string;
  updatedAt: number;
}

export interface SavedPrompt {
  id: string;
  title: string;
  text: string;
}

export interface ComparedAnswer {
  model: string;
  text: string;
  status: 'loading' | 'done' | 'error' | 'stopped';
  error?: string;
  sources?: Source[];
}

export interface ComparisonState {
  id: string;
  chatId: string | null;
  projectId?: string;
  prompt: string;
  files?: Attachment[];
  privacyAsIs?: boolean;
  answers: ComparedAnswer[];
}

export interface RepoLink {
  owner: string;
  repo: string;
  branch: string;
  defaultBranch?: string;
}

export interface FileChange {
  /** new text, or null when the file is deleted */
  content: string | null;
  /** the text on GitHub when the change started (null = new file) */
  original: string | null;
}

export interface ChatSummary {
  text: string;
  /** id of the last message the summary covers; null = it covers an earlier chat (continued from) */
  upTo: string | null;
  /** how many messages it replaces */
  count: number;
  /** rough tokens saved per message sent */
  saved: number;
  createdAt: number;
  model?: string;
  /** title of the chat this one continues, if any */
  from?: string;
  auto?: boolean;
}

export interface Memory {
  id: string;
  text: string;
  createdAt: number;
  updatedAt: number;
  /** 'chat' = saved by a model during a chat; 'manual' = added by you */
  source: 'chat' | 'manual';
  chatId?: string;
}

export interface ModelInfo {
  id: string;
  provider: 'google' | 'openrouter' | 'groq' | 'cerebras';
  name: string;
  label: string;
  context: number | null;
  vision: boolean;
  pdf: boolean;
  thinking: boolean;
  search: boolean;
  preview?: boolean;
}

export interface Catalog {
  failedProviders?: string[];
  providers: { google: boolean; openrouter: boolean; groq?: boolean; cerebras?: boolean };
  models: ModelInfo[];
  defaults: string[];
  errors: string[];
}

export type Theme = 'system' | 'light' | 'dark' | 'black';
export type FontSize = 'small' | 'medium' | 'large';

export interface Settings {
  assistants?: SavedAssistant[];
  prompts?: SavedPrompt[];
  /** Models explicitly refused by the provider for this account; reset when its key changes. */
  unavailableModels?: string[];
  /** User workspaces shared across devices with the rest of account settings. */
  projects?: Project[];
  /** ordered: earlier = preferred when switching after a limit */
  enabledModels: string[];
  defaultModel: string;
  autoSwitch: boolean;
  webSearch: boolean;
  showThinking: boolean;
  customInstructions: string;
  theme: Theme;
  fontSize: FontSize;
  enterToSend: boolean;
  autoTitle: boolean;
  /** summarize older messages when a chat gets long */
  autoCompact: boolean;
  /** give models your saved memories */
  memory: boolean;
  /** let models save memories on their own (otherwise only when you ask) */
  memoryAuto: boolean;
  /** hide personal details (phones, IDs, names…) from models */
  privacyShield: boolean;
  /** 'ask' = show what was found before sending; 'auto' = mask without asking */
  privacyMode: 'ask' | 'auto';
  /** put the real values back into replies */
  privacyRestore: boolean;
  /** your own model layouts (recommended ones are built from your models) */
  layouts?: import('./lib/layouts').Layout[];
  /** recommended layouts the user removed */
  hiddenLayouts?: string[];
  /** set once Auto routing has been made the default */
  autoIntroduced?: boolean;
  voiceLang: string;
}
