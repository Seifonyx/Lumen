// Smart routing: picks the best enabled model for a message and orders the fallbacks.
// "Auto" mode scores every model for the task; a manually chosen model is kept unless it
// can't handle the message (e.g. images sent to a text-only model).

import type { Attachment, ModelInfo } from '../types';
import { hasRtl } from './util';

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
  code: boolean;
  reasoning: boolean;
  files: boolean;
  arabic: boolean;
  long: boolean;
  quick: boolean;
  search: boolean;
}

const CODE = /```|\b(function|class|def|const|import|return|stack ?trace|exception|traceback|bug|debug|compile|syntax|regex|sql|python|javascript|typescript|java|c\+\+|html|css|api|json|code|script)\b|كود|برمج/i;
const REASONING = /\b(prove|proof|solve|calculate|compute|equation|integral|derivative|probability|statistics|optimi[sz]e|step[- ]by[- ]step|why does|explain why|logic|puzzle)\b|[=^√∑∫]\s*\d|\d\s*[+\-*/^]\s*\d|احسب|معادلة|برهن|حل المسألة/i;
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
  const code = CODE.test(text) || files.some((f) => /\.(js|ts|py|java|c|cpp|cs|go|rs|rb|php|sql|css|html?)$/i.test(f.name));
  const reasoning = REASONING.test(text);
  const wantsFile = FILES.test(text) && /\b(make|create|build|generate|write|export|give me|turn|convert|prepare)\b|اعمل|اعملي|أنشئ|انشئ|حول|جهز|اكتب/i.test(text);
  const long = input.conversationTokens > 30_000;
  const quick = !image && !pdf && !files.length && !code && !reasoning && !wantsFile && !long && text.length < 280;
  return { image, pdf, code, reasoning, files: wantsFile, arabic: hasRtl(text), long, quick, search: input.search };
}

/** Name-based hints about a model's size and specialities. */
function traits(m: ModelInfo) {
  const n = m.name.toLowerCase();
  const strong = /(^|[-/:])(pro|ultra|large|max)([-.:]|$)|405b|235b|120b|671b|72b|70b|\b480b/.test(n);
  // Whole name parts only: "gemini" must not count as "mini".
  const light = /(^|[-/:._])(lite|mini|nano|small|tiny|[1-9]b)([-/:._]|$)/.test(n);
  return {
    gemini: m.provider === 'google' && !/gemma/.test(n),
    gemma: /gemma/.test(n),
    power: strong ? 3 : light ? 1 : 2,
    coder: /coder|codestral|devstral|code/.test(n),
    reasoner: m.thinking || /\br1\b|-r1|reason|think|qwq/.test(n),
  };
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
  ['quick', 'fast for quick replies'],
];

function score(m: ModelInfo, task: Task, tokens: number, index: number, total: number, left: number | null): number {
  const t = traits(m);
  let s = (total - index) * 0.4; // respect the user's order as a tie-breaker
  // Big "Pro" models have the smallest free limits, so they only get an edge on heavy work.
  const heavy = task.code || task.reasoning || task.files || task.long;
  s += t.power === 1 ? 1 : 2;
  if (t.power === 3) s += heavy ? 1.5 : -1;
  if (m.preview) s -= 0.5;
  if (task.image) s += m.vision ? 4 : -50;
  if (task.pdf && t.gemini) s += 2;
  if (task.search) s += m.search ? 6 : -2;
  if (task.code) s += (t.coder ? 4 : 0) + (t.gemini ? 1 : 0);
  if (task.reasoning) s += t.reasoner ? 3 : 0;
  if (task.files) s += (t.gemini ? 3 : 0) + (t.power === 1 ? -1 : 0);
  if (task.arabic) s += t.gemini ? 2 : t.gemma ? 1 : 0;
  if (task.long) s += (m.context || 0) >= 500_000 ? 3 : 0;
  // Save the scarce "Pro" limits for when they matter.
  if (task.quick) s += t.power === 1 ? 2 : t.power === 2 ? 1.5 : -2;
  if (m.context && tokens > m.context * 0.85) s -= 100;
  if (left !== null && left <= 3) s -= 3;
  return s;
}

/** Can this model handle the message at all? */
function capable(m: ModelInfo | undefined, task: Task, tokens: number): string | null {
  if (!m) return null;
  if (task.image && !m.vision) return "can't read images";
  if (m.context && tokens > m.context * 0.95) return 'is too small for this much text';
  return null;
}

export function planRoute(input: RouteInput): RoutePlan {
  const info = new Map(input.catalog.map((m) => [m.id, m]));
  const tokens = input.conversationTokens;
  const task = analyze(input);
  const known = input.enabled.filter((id) => info.has(id));
  const ranked = known
    .map((id, i) => ({ id, s: score(info.get(id)!, task, tokens, i, known.length, input.left(id)) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.id);
  // Models at their limit go last; they're kept only as a final resort.
  const order = [...ranked.filter((id) => !input.blocked(id)), ...ranked.filter((id) => input.blocked(id))];
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
