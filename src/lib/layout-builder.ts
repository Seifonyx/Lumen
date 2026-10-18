// Builds a layout for a kind of work from the models this account has right now. Every model gets a score for
// the task from what it is (overall strength, coding, reasoning, speed, images, PDFs, web search, long context,
// languages), how new it is in its family, and how it has behaved on this device (failures, limits). The best
// ones are picked so that a backup comes from a different provider when possible, with a reason for each.

import type { ModelInfo } from '../types';
import type { LayoutIcon } from './layouts';
import { modelProblem } from './ai/eligibility.js';
import { interpretWork, type WorkTask } from './work-intent';

import { features, familyOf, versionFamilyOf, versionOf, type Feature } from './model-profile';
export { features, familyOf, strength } from './model-profile';
export type { Feature } from './model-profile';

export interface TaskProfile {
  id: string;
  name: string;
  icon: LayoutIcon;
  description: string;
  mode: 'auto' | 'order';
  weights: Partial<Record<Feature, number>>;
  /** models without this can't do the task at all */
  requires?: 'vision' | 'search';
  requiresAll?: ('vision' | 'search' | 'pdf')[];
  minContext?: number;
  /** Actual input size, leaving the same answer reserve as chat routing. */
  minInputTokens?: number;
  noReasoning?: boolean;
  instructions?: string;
  /** words in a description that point to this task */
  words?: RegExp;
}

export const TASKS: TaskProfile[] = [
  { id: 'coding', name: 'Max coding', icon: 'code', mode: 'order', description: 'The strongest coding models, newest first, with backups from other providers.',
    weights: { strength: 2, coder: 3, reasoner: 0.8, longctx: 0.6, speed: 0.2, slow: -0.4 },
    instructions: 'You are an expert software engineer. Write correct, complete, production-quality code that follows the existing style. Prefer small, focused changes over rewrites. Briefly explain what you changed and why, point out edge cases, and say how to test it.',
    words: /\b(code|coding|program(?:ming)?|debug(?:ging)?|bugs?|developer|software|scripts?|python|javascript|typescript|react|sql|api|apps?)\b/i },
  { id: 'everyday', name: 'Everyday', icon: 'sun', mode: 'auto', description: 'Quick, capable all-rounders for daily questions, writing and planning.',
    weights: { strength: 1, speed: 1.2, languages: 0.8, files: 0.6, search: 0.4, vision: 0.4, slow: -1 } },
  { id: 'thinking', name: 'Deep thinking', icon: 'brain', mode: 'order', description: 'Reasoning models for hard problems, maths, analysis and decisions.',
    weights: { strength: 1.5, reasoner: 3, longctx: 0.3 },
    instructions: 'Think the problem through carefully before answering. Check facts, units and calculations, consider alternatives, and state your assumptions.',
    words: /\b(maths?|reason(?:ing)?|logic|analy[sz](?:e|ing|is)?|decisions?|proof|physics|puzzles?|strategy|hard)\b/i },
  { id: 'fast', name: 'Fastest', icon: 'zap', mode: 'order', description: 'Near-instant replies (Cerebras, Groq, Flash-Lite) for quick questions.',
    weights: { speed: 4, strength: 0.4, slow: -1.5 }, words: /\b(fast|quick|instant|speed)\b/i },
  { id: 'documents', name: 'Documents & files', icon: 'file', mode: 'order', description: 'The most reliable models for Word, Excel, PowerPoint and reading PDFs.',
    weights: { files: 3, pdf: 2, longctx: 1, strength: 0.7 }, words: /\b(documents?|pdfs?|word|excel|powerpoint|spreadsheets?|files?|reports?|slides?)\b/i },
  { id: 'writing', name: 'Writing', icon: 'pen', mode: 'order', description: 'Strong writers for essays, emails, stories and editing.',
    weights: { strength: 1.4, languages: 0.6, longctx: 0.3 },
    instructions: 'Write clearly and naturally, with a tone that fits the reader. Prefer concrete words over filler, vary sentence length, and keep the structure easy to scan.',
    words: /\b(writ|essay|email|story|blog|copy|edit|letter|article|poem)\w*/i },
  { id: 'research', name: 'Research', icon: 'flask', mode: 'order', description: 'Models that can search the web, for current facts and sources.',
    weights: { search: 3, strength: 0.8, longctx: 0.5 }, requires: 'search',
    instructions: 'Search for current information when it helps, cite your sources, and say when sources disagree or are uncertain.',
    words: /\b(research|news|current|latest|sources?|search|facts?)\b/i },
  { id: 'study', name: 'Study & learning', icon: 'graduation', mode: 'auto', description: 'Patient explainers for learning a subject, step by step.',
    weights: { strength: 1, reasoner: 1, speed: 0.6, languages: 0.4 },
    instructions: 'Teach step by step. Start from what the user already knows, use simple examples, check understanding with a short question when useful, and avoid jargon unless you explain it.',
    words: /\b(study|learn|exam|homework|teach|explain|school|university|course)\b/i },
  { id: 'images', name: 'Images & screenshots', icon: 'layers', mode: 'order', description: 'Models that can see images, photos and screenshots.',
    weights: { vision: 2, strength: 1, pdf: 0.5 }, requires: 'vision', words: /\b(images?|photos?|pictures?|screenshots?|charts?|diagrams?|scans?|ocr|vision)\b/i },
  { id: 'languages', name: 'Languages & translation', icon: 'languages', mode: 'order', description: 'Models that write naturally in many languages, for translating and writing in yours.',
    weights: { languages: 3, strength: 0.8 },
    instructions: 'Reply in the language the user writes in. When translating, keep the meaning, tone and formatting, and use natural phrasing rather than word-for-word translation.',
    words: /\b(translat|language|arabic|french|spanish|german|chinese|hindi|turkish|dialect)\w*/i },
];

const PHRASES: Record<Feature, string> = {
  strength: 'strong model-family hint', coder: 'coding model-family hint', reasoner: 'supports reasoning', slow: 'takes time to think', speed: 'speed-oriented model-family hint',
  vision: 'can see images', pdf: 'reads PDFs directly', search: 'can search the web', longctx: 'handles very long inputs',
  languages: 'multilingual model-family hint', files: 'file-handling model-family hint',
};

export interface Context {
  /** model is at its limit now */
  blocked?: (id: string) => boolean;
  /** how often it answered on this device (0–1), or null if unknown */
  reliability?: (id: string) => number | null;
  /** free requests left today, or null */
  left?: (id: string) => number | null;
  latency?: (id: string) => number | null;
  preferProvider?: string;
}

export interface Pick { id: string; score: number; why: string[] }

/** Shared by ranking and saving, so refreshed metadata cannot bypass a task requirement. */
export function modelMeetsTask(task: TaskProfile, model: ModelInfo): boolean {
  const required = [...(task.requires ? [task.requires] : []), ...(task.requiresAll || [])];
  if(modelProblem(model,{image:required.includes('vision'),pdf:required.includes('pdf'),search:required.includes('search'),minContext:task.minContext,minInputTokens:task.minInputTokens}))return false;
  return !task.noReasoning || features(model).slow < 1;
}

/** The best models for a task, best first, each with why it was picked. */
export function rankForTask(task: TaskProfile, catalog: ModelInfo[], ctx: Context = {}, count = 6): Pick[] {
  const seen = new Set<string>();
  const usable = catalog.filter(m => {
    if (seen.has(m.id) || !modelMeetsTask(task, m)) return false;
    seen.add(m.id); return true;
  });
  // Newest of each family: an older version is only a fallback.
  const newest = new Map<string, number>();
  for (const m of usable) newest.set(versionFamilyOf(m), Math.max(newest.get(versionFamilyOf(m)) || 0, versionOf(m)));
  const scored = usable.map((m) => {
    const f = features(m);
    const parts = (Object.keys(task.weights) as Feature[]).map((k) => ({ k, v: (task.weights[k] || 0) * f[k] }));
    let s = parts.reduce((n, p) => n + p.v, 0);
    const why = parts.filter((p) => p.v >= 0.6 && (p.k !== 'strength' || f.strength >= 0.84)).sort((a, b) => b.v - a.v).slice(0, 2).map((p) => p.k === 'coder' && f.coder === 1 ? 'built for code' : PHRASES[p.k]);
    const older = versionOf(m) > 0 && versionOf(m) < (newest.get(versionFamilyOf(m)) || 0);
    if (older) s -= 1.2; else if (versionOf(m) > 0 && usable.some((o) => o !== m && versionOf(o) > 0 && versionFamilyOf(o) === versionFamilyOf(m))) why.push('newest of its family');
    if (m.preview) s -= 0.8;
    const r = ctx.reliability?.(m.id);
    if (r != null) { s += (r - 0.75) * 3; if (r < 0.5) why.push('has failed often here'); }
    const left = ctx.left?.(m.id);
    const blocked = Boolean(ctx.blocked?.(m.id)) || (left != null && left <= 0);
    if (blocked) { s -= 2.5; why.push('at its limit right now'); }
    if (ctx.preferProvider === m.id.split(':')[0]) { s += .25; why.push('from your preferred provider'); }
    if ((task.weights.speed || 0) >= 1) {
      const ms = ctx.latency?.(m.id);
      if (ms != null) s += Math.max(-.6, Math.min(.6, (4000 - ms) / 6000));
    }
    if (left != null && left > 0 && left <= 3) s -= 1.2;
    return { m, s, why, blocked };
  }).sort((a, b) => b.s - a.s);
  // Greedy: each later pick pays a little for sharing a provider (so one provider's limit doesn't stop the
  // whole layout) and a lot for repeating a family.
  const picks: Pick[] = [];
  const providers = new Map<string, number>(), families = new Set<string>();
  const pool = [...scored];
  while (picks.length < count && pool.length) {
    let best = 0, bestScore = -Infinity;
    const ready = pool.some(c => !c.blocked);
    pool.forEach((c, i) => {
      if (ready && c.blocked) return;
      const adj = c.s - (picks.length ? 0.7 * (providers.get(c.m.provider) || 0) : 0) - (families.has(familyOf(c.m)) ? 3 : 0);
      if (adj > bestScore) { bestScore = adj; best = i; }
    });
    const [c] = pool.splice(best, 1);
    const why = [...c.why];
    if (picks.length && !providers.has(c.m.provider)) why.push(`backup from another provider (${c.m.provider === 'google' ? 'Google' : c.m.provider})`);
    picks.push({ id: c.m.id, score: Math.round(bestScore * 10) / 10, why: why.length ? why : ['good all-round fit'] });
    providers.set(c.m.provider, (providers.get(c.m.provider) || 0) + 1);
    families.add(familyOf(c.m));
  }
  return picks;
}

/** The task a description is about (several can mix), e.g. "debugging React apps" → coding. */
export function taskFromText(text: string): TaskProfile {
  const intent = interpretWork(text);
  const hits = TASKS.filter(t => intent.tasks.includes(t.id as WorkTask) && !intent.excluded.includes(t.id as WorkTask));
  const base = hits[0] || TASKS.find(t => t.id === 'everyday')!;
  const weights: Partial<Record<Feature, number>> = {};
  for (const task of (hits.length ? hits : [base])) for (const [key, value] of Object.entries(task.weights) as [Feature, number][]) {
    const previous = weights[key];
    // A negative speed/latency preference must survive mixed tasks.
    weights[key] = previous === undefined ? value : value < 0 || previous < 0 ? Math.min(previous, value) : Math.max(previous, value);
  }
  if (intent.speed) { weights.speed = Math.max(weights.speed || 0, 4); weights.slow = Math.min(weights.slow || 0, -1.5); }
  if (intent.quality) weights.strength = Math.max(weights.strength || 0, 2);
  if (intent.noReasoning) { weights.reasoner = 0; weights.slow = Math.min(weights.slow || 0, -2); }
  if (intent.excluded.includes('research')) weights.search = 0;
  if (intent.excluded.includes('images')) weights.vision = 0;
  if (intent.minContext || intent.minInputTokens) weights.longctx = Math.max(weights.longctx || 0, 2);
  return { ...base, id: hits.length === 1 ? base.id : 'custom', name: titleCase(text) || base.name, description: text, weights, requires: undefined,
    requiresAll: [...new Set(intent.required)], minContext: intent.minContext, minInputTokens: intent.minInputTokens, noReasoning: intent.noReasoning,
    instructions: [...hits.map(t => t.instructions), `Layout purpose and preferences (these take precedence over the general task guidance above): ${text.trim()}\nApply these preferences unless the user's current request asks otherwise.`].filter(Boolean).join('\n\n') };
}

const titleCase = (s: string) => { const t = s.trim().replace(/\s+/g, ' ').slice(0, 40); return t ? t[0].toUpperCase() + t.slice(1) : ''; };
