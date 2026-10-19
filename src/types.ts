export type Role = 'user' | 'assistant';

export interface Attachment {
  knowledgeSources?: KnowledgeSource[];
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
  /** Public YouTube URL passed as video input to Gemini, never a text-only fallback. */
  videoUri?: string;
  /** The original file (small ones only) is also saved to the account, so other devices can use it. */
  stored?: boolean;
}

export interface Source {
  title: string;
  url: string;
}

export interface ResearchStep {
  query: string;
  status: 'waiting' | 'searching' | 'done' | 'failed';
  /** what the search found (kept only while the report is written) */
  notes?: string;
  sources?: Source[];
}

/** Deep research: the searches behind a report and how far along it is. */
export interface Research {
  phase: 'planning' | 'searching' | 'writing' | 'done' | 'stopped' | 'failed';
  steps: ResearchStep[];
}

export interface KnowledgeSource { docId:string; page:number; title:string; excerpt:string; }

export interface Message {
  knowledgeSources?: KnowledgeSource[];
  coding?: { id: string; phase: 'plan' | 'work'; repo: string };
  codeExecution?: boolean;
  /** you asked for deep research (several web searches, then a cited report) */
  deepResearch?: boolean;
  /** deep research behind this reply */
  research?: Research;
  id: string;
  role: Role;
  text: string;
  files?: Attachment[];
  model?: string;
  /** why Auto picked this model, e.g. "reads images" */
  route?: string;
  /** Auto: why this model was chosen and which were next in line */
  routeDetail?: { why: string[]; next: string[] };
  /** the layout that answered, e.g. "Max coding" */
  via?: string;
  /** added by the app, not typed by you: repository files a model asked to read */
  auto?: 'files' | 'repository';
  /** code searches the app ran for the model (shown on the auto message) */
  searches?: { query: string; count: number }[];
  thinking?: string;
  sources?: Source[];
  notices?: string[];
  error?: string;
  /** A request to create an image (the reply carries the image as an attachment). */
  imagePrompt?: boolean;
  /** privacy shield: how many details were masked, or that it was sent as is */
  privacy?: { masked: number; unmasked?: boolean };
  /** memories this reply saved or removed */
  memory?: { saved?: { id: string; text: string }[]; forgotten?: string[] };
  status?: 'streaming' | 'done' | 'stopped' | 'error';
  createdAt: number;
}

export interface Chat {
  /** Device-local individual proposal decisions, never uploaded. */
  editReviews?: Record<string, import('./lib/edit-review').EditReview>;
  /** Device-local approval, like uncommitted repository changes. */
  codingPlan?: CodingPlan;
  codingPlanMode?: boolean;
  task?: { id: string; name: string; occurrence: string; search: boolean };
  documents?: CanvasDocument[];
  /** Snapshot: editing/deleting a saved helper never changes this chat's instructions. */
  assistant?: SavedAssistant;
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  /** hidden from the sidebar (still in All chats → Archived, and search) */
  archived?: boolean;
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

export interface CodingPlan {
  id: string;
  repo: string;
  baseline: string;
  messageId?: string;
  status: 'planning' | 'awaiting' | 'approved' | 'review' | 'stopped' | 'failed' | 'rejected' | 'completed';
  steps: { title: string; files: string[] }[];
  checked: number[];
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  instructions: string;
  defaultModel?: string;
  color?: string;
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

export interface ScheduledTask {
  id: string;
  name: string;
  prompt: string;
  kind: 'reminder' | 'assistant';
  model: string;
  search: boolean;
  enabled: boolean;
  schedule: { kind: 'once'; at: number } | { kind: 'daily'; time: string; timeZone: string };
  createdAt: number;
  updatedAt: number;
  lastOccurrence?: string;
  lastRun?: { key: string; token: string; at: number; status: 'running' | 'done' | 'error' | 'review' | 'interrupted'; chatId?: string; error?: string };
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
  /** "Combine": one answer written from all of them */
  combined?: { text: string; status: 'loading' | 'done' | 'error' | 'stopped'; model?: string; error?: string };
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
  /** only for chats in this project (otherwise every chat) */
  projectId?: string;
  chatId?: string;
}

export interface ModelInfo {
  id: string;
  provider: 'google' | 'openrouter' | 'groq' | 'cerebras' | 'mistral' | 'cohere' | 'nvidia' | 'huggingface' | 'deepseek' | 'alibaba' | 'cloudflare' | 'aion' | 'openai' | 'anthropic' | 'xai' | 'perplexity' | 'together' | 'fireworks' | 'deepinfra' | 'sambanova' | 'novita' | 'hyperbolic' | 'nebius' | 'scaleway' | 'ovh' | 'siliconflow' | 'chutes' | 'featherless' | 'zai' | 'moonshot' | 'venice' | 'baseten';
  name: string;
  label: string;
  context: number | null;
  vision: boolean;
  pdf: boolean;
  thinking: boolean;
  search: boolean;
  preview?: boolean;
  endpoint?: string;
  outputLimit?: number | null;
  modalities?: { input: string[] | null; output: string[] | null };
  tools?: boolean | null;
  structuredOutput?: boolean | null;
  streaming?: boolean | null;
  pricing?: { input: number | null; output: number | null; currency: 'USD'; unit: 'token' };
  metadata?: {
    source?: 'api' | 'documented' | 'user';
    fields?: Partial<Record<'context' | 'outputLimit' | 'vision' | 'pdf' | 'thinking' | 'search' | 'tools' | 'structuredOutput' | 'streaming', 'api' | 'documented' | 'user' | 'inferred' | 'unknown'>>;
    verification?: 'unchecked';
    declaredFields?: string[];
    refreshedAt?: number;
    stale?: boolean;
  };
}

export interface ModelDeclaration {
  id: string;
  provider: string;
  endpoint: string;
  name: string;
  label?: string;
  accountId?: string;
  context?: number;
  outputLimit?: number;
  vision?: boolean;
  pdf?: boolean;
  thinking?: boolean;
  search?: boolean;
  tools?: boolean;
  structuredOutput?: boolean;
  streaming?: boolean;
}

export interface Catalog {
  deniedModelIds?: string[];
  failedProviders?: string[];
  providerStatus?: Record<string, {
    state: 'ready' | 'stale' | 'error';
    lastAttempt: number;
    lastSuccess: number | null;
    nextRefresh: number;
    error?: string;
    errorKind?: 'auth' | 'rate-limit' | 'provider' | 'timeout' | 'network' | 'invalid';
  }>;
  providers: Partial<Record<ModelInfo['provider'], boolean>>;
  models: ModelInfo[];
  defaults: string[];
  errors: string[];
}

export type Theme = 'system' | 'light' | 'dark' | 'black';
export type FontSize = 'auto' | 'small' | 'medium' | 'large';

export interface Settings {
  assistants?: SavedAssistant[];
  prompts?: SavedPrompt[];
  /** Models explicitly refused by the provider for this account; reset when its key changes. */
  unavailableModels?: string[];
  /** Why and when each unavailable model was removed (shown in Settings → Models). */
  unavailableInfo?: Record<string, { reason: string; at: number; label?: string; by?: 'check' | 'chat' | 'auto' }>;
  /** Models Auto never picks (you can still choose them yourself). */
  autoExcluded?: string[];
  /** Provider Auto leans towards when models are otherwise close. */
  autoPreferProvider?: string;
  /** User workspaces shared across devices with the rest of account settings. */
  projects?: Project[];
  /** ordered: earlier = preferred when switching after a limit */
  modelDeclarations?: ModelDeclaration[];
  enabledModels: string[];
  defaultModel: string;
  autoSwitch: boolean;
  /** Automated ranking preference; compatible manual and fixed assignments remain authoritative. */
  routingPreference?: 'balanced' | 'quality' | 'speed' | 'cost';
  webSearch: boolean;
  showThinking: boolean;
  customInstructions: string;
  theme: Theme;
  fontSize: FontSize;
  enterToSend: boolean;
  /** short vibrations for gestures and switches (phones) */
  haptics?: boolean;
  /** a soft sound when you send */
  sendSound?: boolean;
  /** a notification when a reply finishes while you're in another app or tab */
  notifyReplies?: boolean;
  /** "About me": what you've written about yourself, sent to models with your memories */
  aboutMe?: string;
  /** reply in this language ('' = the language you write in) */
  replyLanguage?: string;
  /** how long answers should be */
  answerLength?: 'auto' | 'short' | 'detailed';
  /** the jump-to-message lines beside long chats (unset: on computers, off on phones) */
  messageNavigator?: boolean;
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
