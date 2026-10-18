// Smart routing: picks the best enabled model for a message and orders the fallbacks.
// "Auto" mode scores every model for the task; a manually chosen model is kept unless it
// can't handle the message (e.g. images sent to a text-only model).

import type { Attachment, ModelInfo } from '../types';
import { hasRtl } from './util';
import { isCoolingDown, reliability, replyLatency } from './ai/health.js';
import { contentTokens, fitsContext, UNKNOWN_CONTEXT } from './ai/context-budget.js';
import { versionFamilyOf, features, strength, versionOf } from './model-profile';
import { contextualWork, interpretWork } from './work-intent';
import { modelProblem } from './ai/eligibility.js';
import { choosePreference, compareKnownCost, estimatedCost } from './ai/preferences.js';

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
  /** Instructions, memory and workspace content sent outside conversation messages. */
  instructionTokens?: number;
  /** Recent user intent, consulted only for a short follow-up such as "do it". */
  recentText?: string;
  search: boolean;
  /** true when a model is at its limit until it resets */
  blocked: (id: string) => boolean;
  /** requests left today, if known */
  left: (id: string) => number | null;
  /** the model that answered the previous message in this chat, if it worked */
  previous?: string;
  /** models Auto must not pick (manual choice still allowed) */
  excluded?: string[];
  /** provider Auto leans towards when models are close */
  preferProvider?: string;
  /** Substitution requires explicit user authorization (the automatic-switching setting). */
  allowFallback?: boolean;
  /** IDs known absent or denied in the current credential-scoped registry. */
  unavailable?: string[];
  preference?: 'balanced' | 'quality' | 'speed' | 'cost';
  preserveOrder?: boolean;
  disabledFallbackHint?: string;
}

export interface RoutePlan {
  model: string;
  /** remaining models, best first */
  fallbacks: string[];
  /** why this model was picked (Auto mode), e.g. "reads images" */
  reason: string | null;
  /** explanation when a manual choice was overridden */
  notice: string | null;
  error?: string;
  /** Auto only: why the chosen model won, and the next models in line */
  detail?: { why: string[]; next: string[] };
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
  speed: boolean;
  quality: boolean;
  cost: boolean;
  noReasoning: boolean;
}

const FILES = /\b(word|docx|excel|xlsx|spreadsheet|sheet|workbook|powerpoint|pptx|slides?|presentation|deck|pdf|report|csv|table|chart)\b|ملف|عرض تقديمي|تقرير|جدول|إكسل|اكسل|وورد|باوربوينت/i;

/** Conservative estimate with extra allowance for non-ASCII text, images and PDF pages. */
export function estimateTokens(text: string, files: Attachment[] = []): number {
  return contentTokens(text, files);
}

export function intentText(text: string, recent = ''): string {
  return contextualWork(text, recent);
}

export function analyze(input: Pick<RouteInput, 'text' | 'files' | 'conversationTokens' | 'search' | 'recentText'>): Task {
  const { files } = input;
  const text = intentText(input.text, input.recentText);
  const intent = interpretWork(text);
  const image = files.some((f) => f.kind === 'image' && !f.text);
  const pdf = files.some((f) => f.kind === 'pdf');
  const rawPdf = files.some((f) => f.kind === 'pdf' && !f.text);
  const code = intent.tasks.includes('coding') || (!intent.excluded.includes('coding') && files.some((f) => /\.(jsx?|tsx?|mjs|cjs|vue|svelte|py|java|kt|swift|dart|c|cpp|cs|go|rs|rb|php|sql|css|html?)$/i.test(f.name)));
  const reasoning = intent.tasks.includes('thinking') && !intent.noReasoning;
  const wantsFile = FILES.test(text) && /\b(make|create|build|generate|write|export|give me|turn|convert|prepare)\b|اعمل|اعملي|أنشئ|انشئ|حول|جهز|اكتب/i.test(text);
  const long = input.conversationTokens > 30_000;
  const writing = intent.tasks.includes('writing') || (!code && text.length > 600);
  const quick = !image && !pdf && !files.length && !code && !reasoning && !wantsFile && !long && !writing && text.length < 280;
  return { image, pdf, rawPdf, code, reasoning, files: wantsFile, arabic: hasRtl(text), long, quick, search: input.search && !intent.excluded.includes('research'), writing, speed: intent.speed, quality: intent.quality, cost:intent.cost, noReasoning: intent.noReasoning };
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
    reasoner: features(m).reasoner > 0,
  };
}

/** A model's family (name without version/size) and version, to prefer the newest of a family. */
function family(m: ModelInfo): { key: string; version: number } {
  return { key: versionFamilyOf(m), version: versionOf(m) };
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

function score(m: ModelInfo, task: Task, tokens: number, index: number, total: number, left: number | null, extra: { newest: boolean; previous: boolean; preferred: boolean }, why: string[] = []): number {
  const t = traits(m);
  let s = total ? ((total - index) / total) * 1.6 : 0; // bounded tie-breaker even with hundreds of models
  // Big "Pro" models have the smallest free limits, so they only get an edge on heavy work.
  const heavy = task.code || task.reasoning || task.files || task.long;
  const profile = features(m);
  s += t.power === 1 ? 1 : 2;
  if (t.power === 3) s += heavy || task.quality ? 1.5 : -1;
  if (heavy || task.writing) s += (strength(m) / 10 - .6) * 4;
  if (m.preview) s -= 0.5;
  if (task.image) s += m.vision ? 4 : -50;
  if (task.pdf && t.gemini) s += 2;
  if (task.rawPdf && m.pdf === false) s -= 50;
  if (task.search) s += m.search ? 6 : -2;
  if (task.code) s += (t.coder ? 4 : 0) + (t.gemini ? 1 : 0) + profile.coder * 1.5;
  if (task.reasoning) s += t.reasoner ? 3 : 0;
  if (task.files) s += (t.gemini ? 3 : 0) + (t.power === 1 ? -1 : 0);
  if (task.arabic) s += t.gemini ? 2 : t.gemma ? 1 : 0;
  if (task.long) s += (m.context || 0) >= 500_000 ? 3 : 0;
  // Save the scarce "Pro" limits for when they matter.
  if (task.quick) s += (t.power === 1 ? 2 : t.power === 2 ? 1.5 : -2) + (t.fast ? 1.5 : 0);
  // A name or provider is only a hint: use recent first-answer timings as a bounded
  // tie-breaker. Heavy tasks retain their capability and quality ranking.
  if (task.quick) {
    if(t.coder) s-=2; // ambiguous everyday requests favor a generalist over a narrow specialist
    if (t.reasoner && !t.gemini && !t.fast) s -= 2;
    const ms = replyLatency(m.id);
    if (ms !== null) { s += Math.max(-1.5, Math.min(1.5, (4000 - ms) / 3000)); if (ms < 2500) why.push(`starts answering in about ${(ms / 1000).toFixed(1)} s`); }
  }
  if (task.writing) s += (t.power >= 2 ? 1 : 0) + (t.gemini ? 1 : 0) + (task.arabic && t.gemini ? 1 : 0);
  if (task.writing && !task.code && t.coder) s -= 2;
  if (task.speed && !task.quality) s += profile.speed * 3 - profile.slow * 2;
  if (task.quality) s += profile.strength * 10;
  if (task.noReasoning) s -= profile.slow * 8;
  // Newest version within a family (e.g. 2.5 over 2.0) gets a small edge.
  if (extra.newest) { s += 1; why.push('newest version of its family'); }
  if (extra.preferred) { s += 1.5; why.push('from your preferred provider'); }
  // Proven track record on this device: models that keep failing sink, reliable ones rise.
  const rel = reliability(m.id);
  if (rel !== null) { s += Math.max(-5, Math.min(2, (rel - 0.75) * 8)); if (rel >= 0.85) why.push(`answers reliably (${Math.round(rel * 100)}% recently)`); }
  // Favor continuity only among close matches; every request still carries the full active context.
  if (extra.previous && (rel === null || rel >= 0.5)) { s += 1; why.push('answered your last message'); }
  if (m.context && tokens > m.context * 0.85) s -= 100;
  // Save models that are almost out of today's free requests.
  if (left !== null) s -= left <= 3 ? 3 : left <= 10 ? 1 : 0;
  if (t.fast && task.quick) why.push('very fast provider');
  return s;
}

/** Can this model handle the message at all? */
function capable(m: ModelInfo | undefined, task: Task, tokens: number): string | null {
  return modelProblem(m,{image:task.image,pdf:task.rawPdf,tokens});
}

export function planRoute(input: RouteInput): RoutePlan {
  const info = new Map(input.catalog.map((m) => [m.id, m]));
  const tokens = input.conversationTokens + (input.instructionTokens || 0) + 100;
  const task = analyze(input);
  const preference=choosePreference(input.preference,task);
  if(preference==='quality') {task.quality=true;task.quick=false;}
  if(preference==='speed') task.speed=true;
  const auto = input.selected === AUTO || !input.selected;
  const excluded = new Set(auto ? input.excluded || [] : []);
  const unavailable = new Set(input.unavailable || []);
  const usable = input.enabled.filter((id) => !excluded.has(id) && !unavailable.has(id));
  const pool = [...new Set(usable)];
  const manualProblem=unavailable.has(input.selected)?'is not available from your connected provider':capable(info.get(input.selected),task,tokens);
  if(!auto && manualProblem && input.allowFallback===false) {
    return {model:'',fallbacks:[],reason:null,notice:null,error:`${info.get(input.selected)?.label || input.selected} ${manualProblem}. ${input.disabledFallbackHint || 'Automatic switching is off. Choose a compatible model or enable switching in Settings → Models.'}`};
  }
  if(auto && !pool.length && input.enabled.length && input.enabled.every(id=>excluded.has(id)||unavailable.has(id)) && excluded.size) {
    return {model:'',fallbacks:[],reason:null,notice:null,error:'Your models are excluded from Auto or unavailable. Choose a model manually or review Auto exclusions in Settings → Models.'};
  }
  const reasoningAllowed = (id: string) => !auto || !task.noReasoning || !info.has(id) || features(info.get(id)!).slow < 1;
  const known = pool.filter((id) => info.has(id) && reasoningAllowed(id) && !capable(info.get(id), task, tokens));
  const whyOf = new Map<string, string[]>();
  // The newest version of each family among the candidates.
  const newestOf = new Map<string, number>();
  for (const id of known) { const f = family(info.get(id)!); newestOf.set(f.key, Math.max(newestOf.get(f.key) || 0, f.version)); }
  const scored = known
    .map((id, i) => { const f = family(info.get(id)!); const why: string[] = []; whyOf.set(id, why); return { id, s: score(info.get(id)!, task, tokens, i, known.length, input.left(id), { newest: f.version > 0 && f.version === newestOf.get(f.key) && known.some((o) => o !== id && family(info.get(o)!).key === f.key && family(info.get(o)!).version > 0), previous: id === input.previous, preferred: Boolean(input.preferProvider) && id.split(':')[0] === input.preferProvider }, why) }; })
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
  const blocked = (id: string) => input.blocked(id) || (input.left(id) ?? Infinity) <= 0 || isCoolingDown(id);
  const unknown = pool.filter((id) => !info.has(id) && !capable(undefined, task, tokens));
  // Capabilities and availability take priority over continuity, quality hints, and
  // provider diversity. Keep non-search models as an honest last resort.
  const all = [...ranked, ...unknown].sort((a, b) => Number(blocked(a)) - Number(blocked(b))
    || (input.preserveOrder?input.enabled.indexOf(a)-input.enabled.indexOf(b):0)
    || (auto && task.search ? Number(Boolean(info.get(b)?.search)) - Number(Boolean(info.get(a)?.search)) : 0)
    || (preference==='cost'?compareKnownCost(estimatedCost(info.get(a),tokens),estimatedCost(info.get(b),tokens)):0));
  const name = (id: string) => info.get(id)?.label || id.split(':').slice(1).join(':');

  if(!auto && manualProblem && !all.length) return {model:'',fallbacks:[],reason:null,notice:null,error:`${name(input.selected)} ${manualProblem}. No eligible backup is available. Choose a compatible model or reconnect the provider in Settings.`};

  if (!all.length && (auto || manualProblem)) {
    const context = pool.some(id => !fitsContext(info.has(id) ? info.get(id)?.context : UNKNOWN_CONTEXT, tokens));
    return { model: '', fallbacks: [], reason: null, notice: null, error: !pool.length ? 'No models are enabled for this request. Check Settings → Models.' : context
      ? 'This chat exceeds the context available in your models. Compact the chat, continue in a new chat with a summary, or choose a model with a larger context window.'
      : task.noReasoning && pool.every(id => !reasoningAllowed(id)) ? 'Your enabled models require reasoning before answering. Enable a model with optional reasoning in Settings → Models, or allow reasoning for this request.'
      : 'None of your enabled models have verified support for these attachments. Refresh Models or enable a model that supports them in Settings → Models.' };
  }

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
    const why = [...(reason !== 'best available' ? [reason] : []), ...(whyOf.get(model) || []).filter((w) => w !== reason)];
    if(preference==='cost') why.unshift(estimatedCost(m,tokens)===null?'prices are unknown; using task fit':'lower reported price among compatible available choices');
    else if(preference==='quality') why.unshift('quality priority, estimated from model-family hints');
    else if(preference==='speed') why.unshift('speed priority');
    if (blocked(model)) why.push('every better match is at its limit right now');
    return { model, fallbacks: input.allowFallback===false?[]:all.slice(1), reason, notice:null, detail: { why: why.length ? why.slice(0, 5) : ['best overall match among your models'], next: all.slice(1, 4) } };
  }

  // Manual choice: keep it unless it can't handle this message.
  const problem = manualProblem;
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
  return { model: input.selected, fallbacks: input.allowFallback===false?[]:all.filter((id) => id !== input.selected), reason: null, notice: null };
}
