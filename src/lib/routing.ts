// Smart routing: picks the best enabled model for a message and orders the fallbacks.
// "Auto" mode scores every model for the task; a manually chosen model is kept unless it
// can't handle the message (e.g. images sent to a text-only model).

import type { Attachment, ModelInfo } from '../types';
import { hasRtl } from './util';
import { isCoolingDown, reliability, replyLatency } from './ai/health.js';

export const AUTO = 'auto';

export interface RouteInput {
  /** the model the user chose, or AUTO */
  selected: string;
  /** enabled models in the user's order */
  enabled: string[];
  catalog: ModelInfo[];
  text: string;
  files: Attachment[];
  /** rough size of the whole conversation, in tokens */
  conversationTokens: number;
  search: boolean;
  /** true when a model is at its limit until it resets */
  blocked: (id: string) => boolean;
  /** requests left today, if known */
  left: (id: string) => number | null;
  /** the model that answered the previous message in this chat, if it worked */
  previous?: string;
}

export interface RoutePlan {
  model: string;
  /** remaining models, best first */
  fallbacks: string[];
  /** why this model was picked (Auto mode), e.g. "reads images" */
  reason: string | null;
  /** explanation when a manual choice was overridden */
  notice: string | null;
}

export interface Task {
  image: boolean;
  pdf: boolean;
  /** a PDF that has to be read as a file (no extracted text) */
  rawPdf: boolean;
  code: boolean;
  reasoning: boolean;
  files: boolean;
  arabic: boolean;
  long: boolean;
  quick: boolean;
  search: boolean;
  /** writing, rewriting, translating or summarising prose */
  writing: boolean;
}

const CODE = /```|\b(function|class|def|const|import|return|stack ?trace|exception|traceback|bug|debug|compile|syntax|regex|sql|python|javascript|typescript|java|c\+\+|html|css|api|json|code|script)\b|كود|برمج/i;
const REASONING = /\b(prove|proof|solve|calculate|compute|equation|integral|derivative|probability|statistics|optimi[sz]e|step[- ]by[- ]step|why does|explain why|logic|puzzle)\b|[=^√∑∫]\s*\d|\d\s*[+\-*/^]\s*\d|احسب|معادلة|برهن|حل المسألة/i;
const WRITING = /\b(write|rewrite|draft|compose|essay|email|e-mail|letter|cover letter|article|blog|story|poem|summar(?:y|ise|ize)|paraphrase|proofread|translate|translation|tone|formal|polish)\b|اكتب|أعد صياغة|لخص|ترجم|رسالة|مقال/i;
const FILES = /\b(word|docx|excel|xlsx|spreadsheet|sheet|workbook|powerpoint|pptx|slides?|presentation|deck|pdf|report|csv|table|chart)\b|ملف|عرض تقديمي|تقرير|جدول|إكسل|اكسل|وورد|باوربوينت/i;

/** Rough token estimate: ~4 characters per token, fixed costs for images and PDF pages. */
export function estimateTokens(text: string, files: Attachment[] = []): number {
  let n = Math.ceil(text.length / 4);
  for (const f of files) {
    if (f.kind === 'image') n += 300;
    else if (f.kind === 'pdf') n += Math.ceil((f.size || 0) / 3000) * 260 + 300;
    else n += Math.ceil((f.text?.length || 0) / 4);
  }
  return n;
}

export function analyze(input: Pick<RouteInput, 'text' | 'files' | 'conversationTokens' | 'search'>): Task {
  const { text, files } = input;
  const image = files.some((f) => f.kind === 'image');
  const pdf = files.some((f) => f.kind === 'pdf');
  const rawPdf = files.some((f) => f.kind === 'pdf' && !f.text);
  const code = CODE.test(text) || files.some((f) => /\.(js|ts|py|java|c|cpp|cs|go|rs|rb|php|sql|css|html?)$/i.test(f.name));
  const reasoning = REASONING.test(text);
  const wantsFile = FILES.test(text) && /\b(make|create|build|generate|write|export|give me|turn|convert|prepare)\b|اعمل|اعملي|أنشئ|انشئ|حول|جهز|اكتب/i.test(text);
  const long = input.conversationTokens > 30_000;
  const writing = WRITING.test(text) || text.length > 600;
  const quick = !image && !pdf && !files.length && !code && !reasoning && !wantsFile && !long && !writing && text.length < 280;
  return { image, pdf, rawPdf, code, reasoning, files: wantsFile, arabic: hasRtl(text), long, quick, search: input.search, writing };
}

/** Name-based hints about a model's size and specialities. */
function traits(m: ModelInfo) {
  const n = m.name.toLowerCase();
  // Parameter count from names like "llama-3.3-70b" or "qwen3-235b-a22b" (the first, total size).
  const params = Number(/(?:^|[-/:._])(\d{1,4}(?:\.\d)?)b(?=[-/:._]|$)/.exec(n)?.[1]) || 0;
  const strong = /(^|[-/:])(pro|ultra|large|max|opus)([-.:]|$)/.test(n) || params >= 65;
  // Whole name parts only: "gemini" must not count as "mini".
  const light = /(^|[-/:._])(lite|mini|nano|small|tiny|haiku)([-/:._]|$)/.test(n) || (params > 0 && params < 20);
  return {
    gemini: m.provider === 'google' && !/gemma/.test(n),
    // Groq and Cerebras answer in a fraction of a second.
    fast: m.provider === 'groq' || m.provider === 'cerebras',
    gemma: /gemma/.test(n),
    power: strong ? 3 : light ? 1 : 2,
    coder: /coder|codestral|devstral|code/.test(n),
    reasoner: m.thinking || /\br1\b|-r1|reason|think|qwq/.test(n),
  };
}

/** A model's family (name without version/size) and version, to prefer the newest of a family. */
function family(m: ModelInfo): { key: string; version: number } {
  const n = m.name.toLowerCase().replace(/:free$/, '');
  const version = Number(/(\d+(?:\.\d+)?)/.exec(n.replace(/\d{1,4}b\b/g, ''))?.[1]) || 0;
  const key = `${m.provider}:${n.replace(/\d+(?:\.\d+)?b?/g, '#').replace(/-?(latest|preview|exp|\d{2,})/g, '')}`;
  return { key, version };
}

const REASONS: [keyof Task, string][] = [
  ['image', 'reads images'],
  ['search', 'can search the web'],
  ['long', 'handles long conversations'],
  ['pdf', 'reads PDFs directly'],
  ['files', 'reliable at making files'],
  ['code', 'good at code'],
  ['reasoning', 'thinks step by step'],
  ['arabic', 'strong in Arabic'],
  ['writing', 'strong writer'],
  ['quick', 'fast for quick replies'],
];

function score(m: ModelInfo, task: Task, tokens: number, index: number, total: number, left: number | null, extra: { newest: boolean; previous: boolean }): number {
  const t = traits(m);
  let s = total ? ((total - index) / total) * 1.6 : 0; // bounded tie-breaker even with hundreds of models
  // Big "Pro" models have the smallest free limits, so they only get an edge on heavy work.
  const heavy = task.code || task.reasoning || task.files || task.long;
  s += t.power === 1 ? 1 : 2;
  if (t.power === 3) s += heavy ? 1.5 : -1;
  if (m.preview) s -= 0.5;
  if (task.image) s += m.vision ? 4 : -50;
  if (task.pdf && t.gemini) s += 2;
  if (task.rawPdf && m.pdf === false) s -= 50;
  if (task.search) s += m.search ? 6 : -2;
  if (task.code) s += (t.coder ? 4 : 0) + (t.gemini ? 1 : 0);
  if (task.reasoning) s += t.reasoner ? 3 : 0;
  if (task.files) s += (t.gemini ? 3 : 0) + (t.power === 1 ? -1 : 0);
  if (task.arabic) s += t.gemini ? 2 : t.gemma ? 1 : 0;
  if (task.long) s += (m.context || 0) >= 500_000 ? 3 : 0;
  // Save the scarce "Pro" limits for when they matter.
  if (task.quick) s += (t.power === 1 ? 2 : t.power === 2 ? 1.5 : -2) + (t.fast ? 1.5 : 0);
  // A name or provider is only a hint: use recent first-answer timings as a bounded
  // tie-breaker. Heavy tasks retain their capability and quality ranking.
  if (task.quick) {
    if (t.reasoner && !t.gemini && !t.fast) s -= 2;
    const ms = replyLatency(m.id);
    if (ms !== null) s += Math.max(-1.5, Math.min(1.5, (4000 - ms) / 3000));
  }
  if (task.writing) s += (t.power >= 2 ? 1 : 0) + (t.gemini ? 1 : 0) + (task.arabic && t.gemini ? 1 : 0);
  // Newest version within a family (e.g. 2.5 over 2.0) gets a small edge.
  if (extra.newest) s += 1;
  // Proven track record on this device: models that keep failing sink, reliable ones rise.
  const rel = reliability(m.id);
  if (rel !== null) s += Math.max(-5, Math.min(2, (rel - 0.75) * 8));
  // Stay with the model that answered the last message: steadier tone, and it already knows the chat.
  if (extra.previous && (rel === null || rel >= 0.5)) s += 2.5;
  if (m.context && tokens > m.context * 0.85) s -= 100;
  // Save models that are almost out of today's free requests.
  if (left !== null) s -= left <= 3 ? 3 : left <= 10 ? 1 : 0;
  return s;
}

/** Can this model handle the message at all? */
function capable(m: ModelInfo | undefined, task: Task, tokens: number): string | null {
  if (!m) return null;
  if (task.image && !m.vision) return "can't read images";
  if (task.rawPdf && m.pdf === false) return "can't read PDFs";
  if (m.context && tokens > m.context * 0.95) return 'is too small for this much text';
  return null;
}

export function planRoute(input: RouteInput): RoutePlan {
  const info = new Map(input.catalog.map((m) => [m.id, m]));
  const tokens = input.conversationTokens;
  const task = analyze(input);
  const known = input.enabled.filter((id) => info.has(id) && !capable(info.get(id), task, tokens));
  // The newest version of each family among the candidates.
  const newestOf = new Map<string, number>();
  for (const id of known) { const f = family(info.get(id)!); newestOf.set(f.key, Math.max(newestOf.get(f.key) || 0, f.version)); }
  const scored = known
    .map((id, i) => { const f = family(info.get(id)!); return { id, s: score(info.get(id)!, task, tokens, i, known.length, input.left(id), { newest: f.version > 0 && f.version === newestOf.get(f.key) && [...known].some((o) => o !== id && family(info.get(o)!).key === f.key), previous: id === input.previous }) }; })
    .sort((a, b) => b.s - a.s);
  // Backups alternate providers when they're close in score, so one provider's outage or rate
  // limit doesn't take out the next few attempts too.
  const provider = (id: string) => id.split(':')[0];
  const ranked: string[] = [];
  const rest = [...scored];
  while (rest.length) {
    const last = ranked.length ? provider(ranked[ranked.length - 1]) : '';
    const i = ranked.length && rest[0] && provider(rest[0].id) === last ? rest.findIndex((x) => provider(x.id) !== last && x.s >= rest[0].s - 2.5) : 0;
    ranked.push(rest.splice(i < 0 ? 0 : i, 1)[0].id);
  }
  // Models at their limit go last; they're kept only as a final resort.
  const blocked = (id: string) => input.blocked(id) || isCoolingDown(id);
  const order = [...ranked.filter((id) => !blocked(id)), ...ranked.filter(blocked)];
  const unknown = input.enabled.filter((id) => !info.has(id));
  const all = [...order, ...unknown];
  const name = (id: string) => info.get(id)?.label || id.split(':').slice(1).join(':');

  if (input.selected === AUTO || !input.selected) {
    const model = all[0] || '';
    const m = info.get(model);
    const t = m ? traits(m) : null;
    const reason =
      REASONS.find(([k]) => {
        if (!task[k] || !m || !t) return false;
        if (k === 'image') return m.vision;
        if (k === 'search') return m.search;
        if (k === 'pdf' || k === 'files') return t.gemini;
        if (k === 'code') return t.coder || t.power === 3 || t.gemini;
        if (k === 'reasoning') return t.reasoner;
        if (k === 'arabic') return t.gemini || t.gemma;
        if (k === 'long') return (m.context || 0) >= 500_000;
        if (k === 'writing') return t.power >= 2;
        return true;
      })?.[1] || 'best available';
    return { model, fallbacks: all.slice(1), reason, notice: null };
  }

  // Manual choice: keep it unless it can't handle this message.
  const chosen = info.get(input.selected);
  const problem = capable(chosen, task, tokens);
  if (problem) {
    const alt = all.find((id) => id !== input.selected && !capable(info.get(id), task, tokens));
    if (alt) {
      return {
        model: alt,
        fallbacks: all.filter((id) => id !== alt && id !== input.selected),
        reason: null,
        notice: `${name(input.selected)} ${problem} — using ${name(alt)} for this message.`,
      };
    }
  }
  return { model: input.selected, fallbacks: all.filter((id) => id !== input.selected), reason: null, notice: null };
}
