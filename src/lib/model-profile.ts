// Shared model-family hints. Capability metadata remains authoritative; these are heuristics, not benchmarks.
import type { ModelInfo } from '../types';

export type Feature = 'strength' | 'coder' | 'reasoner' | 'slow' | 'speed' | 'vision' | 'pdf' | 'search' | 'longctx' | 'languages' | 'files';

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

/** A model's family without version or size, to keep only the newest of each. */
export function familyOf(m: ModelInfo) {
  const n = m.name.toLowerCase().replace(/:free$/, '');
  return `${m.provider}:${n.replace(/\d+(?:\.\d+)?b\b/g, '#').replace(/\d+(?:\.\d+)*/g, 'v').replace(/-?(latest|preview|exp|instruct|it|versatile|\d{4,})/g, '')}`;
}
export const versionOf = (m: ModelInfo) => /latest/.test(m.name) ? 99 : Number(/(\d+(?:\.\d+)?)/.exec(m.name.toLowerCase().replace(/\d{1,4}b\b/g, ''))?.[1]) || 0;

