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
  thinking?: string;
  sources?: Source[];
  notices?: string[];
  error?: string;
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
  messages: Message[];
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
  voiceLang: string;
}
