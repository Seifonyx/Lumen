// Builds a layout for a kind of work from the models this account has right now. Every model gets a score for
// the task from what it is (overall strength, coding, reasoning, speed, images, PDFs, web search, long context,
// languages), how new it is in its family, and how it has behaved on this device (failures, limits). The best
// ones are picked so that a backup comes from a different provider when possible, with a reason for each.

import type { ModelInfo } from '../types';
import type { LayoutIcon } from './layouts';

export type Feature = 'strength' | 'coder' | 'reasoner' | 'slow' | 'speed' | 'vision' | 'pdf' | 'search' | 'longctx' | 'languages' | 'files';

export interface TaskProfile {
  id: string;
  name: string;
  icon: LayoutIcon;
  description: string;
  mode: 'auto' | 'order';
  weights: Partial<Record<Feature, number>>;
  /** models without this can't do the task at all */
  requires?: 'vision' | 'search';
  instructions?: string;
  /** words in a description that point to this task */
  words?: RegExp;
}

export const TASKS: TaskProfile[] = [
  { id: 'coding', name: 'Max coding', icon: 'code', mode: 'order', description: 'The strongest coding models, newest first, with backups from other providers.',
    weights: { strength: 2, coder: 3, reasoner: 0.8, longctx: 0.6, speed: 0.2, slow: -0.4 },
    instructions: 'You are an expert software engineer. Write correct, complete, production-quality code that follows the existing style. Prefer small, focused changes over rewrites. Briefly explain what you changed and why, point out edge cases, and say how to test it.',
    words: /\b(code|coding|program|debug|bug|developer|software|script|python|javascript|typescript|react|sql|api|app)\b/i },
  { id: 'everyday', name: 'Everyday', icon: 'sun', mode: 'auto', description: 'Quick, capable all-rounders for daily questions, writing and planning.',
    weights: { strength: 1, speed: 1.2, languages: 0.8, files: 0.6, search: 0.4, vision: 0.4, slow: -1 } },
  { id: 'thinking', name: 'Deep thinking', icon: 'brain', mode: 'order', description: 'Reasoning models for hard problems, maths, analysis and decisions.',
    weights: { strength: 1.5, reasoner: 3, longctx: 0.3 },
    instructions: 'Think the problem through carefully before answering. Check facts, units and calculations, consider alternatives, and state your assumptions.',
    words: /\b(math|maths|reason|logic|analy[sz]|decision|proof|physics|puzzle|strategy|hard)\b/i },
  { id: 'fast', name: 'Fastest', icon: 'zap', mode: 'order', description: 'Near-instant replies (Cerebras, Groq, Flash-Lite) for quick questions.',
    weights: { speed: 4, strength: 0.4, slow: -1.5 }, words: /\b(fast|quick|instant|speed)\b/i },
  { id: 'documents', name: 'Documents & files', icon: 'file', mode: 'order', description: 'The most reliable models for Word, Excel, PowerPoint and reading PDFs.',
    weights: { files: 3, pdf: 2, longctx: 1, strength: 0.7 }, words: /\b(document|pdf|word|excel|powerpoint|spreadsheet|file|report|slides)\b/i },
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
    weights: { vision: 2, strength: 1, pdf: 0.5 }, requires: 'vision', words: /\b(image|photo|picture|screenshot|chart|diagram|scan|ocr|vision)\b/i },
  { id: 'languages', name: 'Languages & translation', icon: 'languages', mode: 'order', description: 'Models that write naturally in many languages, for translating and writing in yours.',
    weights: { languages: 3, strength: 0.8 },
    instructions: 'Reply in the language the user writes in. When translating, keep the meaning, tone and formatting, and use natural phrasing rather than word-for-word translation.',
    words: /\b(translat|language|arabic|french|spanish|german|chinese|hindi|turkish|dialect)\w*/i },
];

/** Overall strength (0–10) from what's known about model families, else from size in the name. */
const KNOWN: [RegExp, number][] = [
  [/gemini-(?:[3-9][\d.]*|2\.5)-pro|gemini-pro-latest/, 9.2],
  [/qwen-?3[\w.-]*coder|qwen3-coder/, 8.8],
  [/kimi-k2/, 8.7],
  [/deepseek[\w.-]*(r1|v3|v4|chat|reasoner)/, 8.6],
  [/gpt-oss-120b/, 8.4],
  [/glm-(4\.[5-9]|[5-9])/, 8.3],
  [/qwen-?3[\w.-]*(235b|max)/, 8.3],
  [/gemini-flash-latest|gemini-[\d.]+-flash(?!-lite)/, 7.8],
  [/llama-4-maverick/, 7.4],
  [/mistral-large|magistral|command-a|mistral-medium/, 7.2],
  [/qwq/, 7.2],
  [/devstral|codestral/, 7],
  [/llama-?3\.3-70b/, 6.8],
  [/gpt-oss-20b/, 6.5],
  [/gemini[\w.-]*flash-lite/, 6.2],
  [/llama-4-scout/, 6.2],
  [/gemma/, 6],
  [/mistral-small|ministral/, 5.5],
];

const lower = (m: ModelInfo) => `${m.provider}:${m.name}`.toLowerCase();
const params = (n: string) => Number(/(?:^|[-/:._])(\d{1,4}(?:\.\d)?)b(?=[-/:._]|$)/.exec(n)?.[1]) || 0;

export function strength(m: ModelInfo) {
  const n = lower(m);
  const known = KNOWN.find(([re]) => re.test(n));
  if (known) return known[1];
  const p = params(n);
  if (p >= 200) return 8; if (p >= 65) return 7; if (p >= 30) return 6; if (p >= 12) return 5; if (p > 0) return 3.5;
  return /(^|[-/:._])(pro|ultra|large|max|opus)([-/:._]|$)/.test(n) ? 7.5 : /(^|[-/:._])(lite|mini|nano|small|tiny)([-/:._]|$)/.test(n) ? 4.5 : 5.5;
}

/** What a model is good at, each 0–1. */
export function features(m: ModelInfo): Record<Feature, number> {
  const n = lower(m), p = params(n), gemini = m.provider === 'google' && !/gemma/.test(n);
  const light = /(^|[-/:._])(lite|mini|nano|small|tiny|instant)([-/:._]|$)/.test(n) || (p > 0 && p <= 12);
  return {
    strength: strength(m) / 10,
    coder: /coder|codestral|devstral/.test(n) ? 1 : /kimi-k2|glm-(4\.[5-9]|[5-9])|gpt-oss|deepseek[\w.-]*(v3|v4|chat)|gemini-(?:[3-9][\d.]*|2\.5)-pro|qwen-?3/.test(n) ? 0.6 : 0.15,
    reasoner: /\br1\b|-r1|reason|think|qwq|magistral/.test(n) ? 1 : m.thinking ? (strength(m) >= 8.5 ? 1 : 0.7) : 0,
    // Reasoning-only models think at length before every answer.
    slow: /\br1\b|-r1|reasoner|thinking|qwq|magistral/.test(n) ? 1 : 0,
    speed: m.provider === 'cerebras' ? 1 : m.provider === 'groq' ? 0.9 : light ? 0.65 : /flash/.test(n) ? 0.55 : p >= 200 || /pro|large|max/.test(n) ? 0.1 : 0.35,
    vision: m.vision ? 1 : 0,
    pdf: m.pdf ? 1 : 0,
    search: m.search ? 1 : 0,
    longctx: (m.context || 0) >= 1e6 ? 1 : (m.context || 0) >= 200_000 ? 0.6 : (m.context || 0) >= 128_000 ? 0.35 : 0.1,
    languages: gemini ? 1 : /qwen|gemma|command|mistral|llama-4|glm|deepseek|kimi/.test(n) ? 0.65 : 0.35,
    files: gemini ? 1 : strength(m) >= 8 ? 0.5 : 0.2,
  };
}

const PHRASES: Record<Feature, string> = {
  strength: 'one of the strongest models you have', coder: 'built for code', reasoner: 'thinks step by step', slow: 'takes time to think', speed: 'very fast',
  vision: 'can see images', pdf: 'reads PDFs directly', search: 'can search the web', longctx: 'handles very long inputs',
  languages: 'strong in many languages', files: 'reliable at making files',
};

export interface Context {
  /** model is at its limit now */
  blocked?: (id: string) => boolean;
  /** how often it answered on this device (0–1), or null if unknown */
  reliability?: (id: string) => number | null;
  /** free requests left today, or null */
  left?: (id: string) => number | null;
}

/** A model's family without version or size, to keep only the newest of each. */
export function familyOf(m: ModelInfo) {
  const n = m.name.toLowerCase().replace(/:free$/, '');
  return `${m.provider}:${n.replace(/\d+(?:\.\d+)?b\b/g, '#').replace(/\d+(?:\.\d+)*/g, 'v').replace(/-?(latest|preview|exp|instruct|it|versatile|\d{4,})/g, '')}`;
}
const versionOf = (m: ModelInfo) => /latest/.test(m.name) ? 99 : Number(/(\d+(?:\.\d+)?)/.exec(m.name.toLowerCase().replace(/\d{1,4}b\b/g, ''))?.[1]) || 0;

export interface Pick { id: string; score: number; why: string[] }

/** The best models for a task, best first, each with why it was picked. */
export function rankForTask(task: TaskProfile, catalog: ModelInfo[], ctx: Context = {}, count = 6): Pick[] {
  const usable = catalog.filter((m) => !task.requires || m[task.requires]);
  // Newest of each family: an older version is only a fallback.
  const newest = new Map<string, number>();
  for (const m of usable) newest.set(familyOf(m), Math.max(newest.get(familyOf(m)) || 0, versionOf(m)));
  const scored = usable.map((m) => {
    const f = features(m);
    const parts = (Object.keys(task.weights) as Feature[]).map((k) => ({ k, v: (task.weights[k] || 0) * f[k] }));
    let s = parts.reduce((n, p) => n + p.v, 0);
    const why = parts.filter((p) => p.v >= 0.6 && (p.k !== 'strength' || f.strength >= 0.84)).sort((a, b) => b.v - a.v).slice(0, 2).map((p) => PHRASES[p.k]);
    const older = versionOf(m) < (newest.get(familyOf(m)) || 0);
    if (older) s -= 1.2; else if (versionOf(m) > 0 && usable.some((o) => o !== m && familyOf(o) === familyOf(m))) why.push('newest of its family');
    if (m.preview) s -= 0.8;
    const r = ctx.reliability?.(m.id);
    if (r != null) { s += (r - 0.75) * 3; if (r < 0.5) why.push('has failed often here'); }
    if (ctx.blocked?.(m.id)) { s -= 2.5; why.push('at its limit right now'); }
    const left = ctx.left?.(m.id);
    if (left != null && left <= 3) s -= 1.2;
    return { m, s, why };
  }).sort((a, b) => b.s - a.s);
  // Greedy: each later pick pays a little for sharing a provider (so one provider's limit doesn't stop the
  // whole layout) and a lot for repeating a family.
  const picks: Pick[] = [];
  const providers = new Map<string, number>(), families = new Set<string>();
  const pool = [...scored];
  while (picks.length < count && pool.length) {
    let best = 0, bestScore = -Infinity;
    pool.forEach((c, i) => {
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
  const hits = TASKS.filter((t) => t.words?.test(text));
  if (!hits.length) return { ...TASKS.find((t) => t.id === 'everyday')!, id: 'custom', name: titleCase(text), description: text };
  if (hits.length === 1) return { ...hits[0], name: titleCase(text) || hits[0].name, description: text };
  const weights: Partial<Record<Feature, number>> = {};
  for (const t of hits) for (const [k, v] of Object.entries(t.weights) as [Feature, number][]) weights[k] = Math.max(weights[k] || 0, v);
  return { ...hits[0], id: 'custom', name: titleCase(text), description: text, weights, requires: hits.find((h) => h.requires)?.requires, instructions: hits.map((h) => h.instructions).filter(Boolean).join('\n\n') || undefined };
}

const titleCase = (s: string) => { const t = s.trim().replace(/\s+/g, ' ').slice(0, 40); return t ? t[0].toUpperCase() + t.slice(1) : ''; };
