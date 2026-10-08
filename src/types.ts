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
  thinking?: string;
  sources?: Source[];
  notices?: string[];
  error?: string;
  /** memories this reply saved or removed */
  memory?: { saved?: { id: string; text: string }[]; forgotten?: string[] };
  status?: 'streaming' | 'done' | 'stopped' | 'error';
  createdAt: number;
}

export interface Chat {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  model?: string;
  /** last change time on any device, used for syncing (unlike updatedAt it also moves on rename/pin) */
  rev?: number;
  /** a summary that stands in for older messages when the chat gets long */
  summary?: ChatSummary;
  messages: Message[];
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
  provider: 'google' | 'openrouter';
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
  providers: { google: boolean; openrouter: boolean };
  models: ModelInfo[];
  defaults: string[];
  errors: string[];
}

export type Theme = 'system' | 'light' | 'dark';
export type FontSize = 'small' | 'medium' | 'large';

export interface Settings {
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
  /** set once Auto routing has been made the default */
  autoIntroduced?: boolean;
  voiceLang: string;
}
